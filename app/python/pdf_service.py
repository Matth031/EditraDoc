from __future__ import annotations

import json
import os
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

# Python embeddable (installateur Windows) n'ajoute pas le dossier du script à sys.path.
_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
if _SERVICE_DIR not in sys.path:
    sys.path.insert(0, _SERVICE_DIR)

# Service local uniquement (127.0.0.1) — pas d'exposition réseau ; les entrées JSON
# sont traitées par pdf_ops après validation des chemins dans les handlers.

from pdf_ops import (
    apply_annotations,
    compress_pdf,
    images_to_pdf,
    merge_pdfs,
    protect_pdf,
    split_pdf,
    split_pdf_groups,
    unprotect_pdf,
)
from contract_validation import validate_pdf_validate_request, validate_apply_annotations_request
from pdf_validation import validate_pdf_path

LOG_VERBOSE = os.environ.get("MANI_PDF_PY_LOGS") != "0"
MAX_POST_BODY_BYTES = 64 * 1024 * 1024


def _legacy_routes_enabled() -> bool:
    return os.environ.get("MANI_PDF_ENABLE_LEGACY_ROUTES") == "1"


_SENSITIVE_LOG_KEYS = frozenset({"password", "token", "secret", "src_base64"})


def _redact_payload_for_log(payload: object) -> object:
    """Masque les champs sensibles avant journalisation verbose."""
    if not isinstance(payload, dict):
        return payload
    redacted: dict = {}
    for key, value in payload.items():
        if str(key).lower() in _SENSITIVE_LOG_KEYS:
            redacted[key] = "***"
        elif isinstance(value, dict):
            redacted[key] = _redact_payload_for_log(value)
        elif isinstance(value, list):
            redacted[key] = [
                _redact_payload_for_log(item) if isinstance(item, dict) else item for item in value
            ]
        else:
            redacted[key] = value
    return redacted


def _sync_log_env_from_headers(handler: BaseHTTPRequestHandler) -> None:
    """Aligne le journal Python sur le chemin effectif du processus Electron (requête courante)."""
    log_path = str(handler.headers.get("X-Editradoc-Log-Path") or "").strip()
    if log_path:
        os.environ["EDITRADOC_LOG_PATH"] = log_path
        os.environ["MANI_PDF_LOG_PATH"] = log_path
    audit = str(handler.headers.get("X-Editradoc-Export-Audit") or "").strip()
    if audit in ("0", "1"):
        os.environ["EDITRADOC_EXPORT_AUDIT"] = audit


logging.basicConfig(level=logging.INFO, format="%(asctime)s [pdf_service] %(message)s")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        if LOG_VERBOSE:
            logging.info("http: " + format, *args)
        return

    def _json_response(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _reject_unauthorized_post(self) -> bool:
        """Refuse les POST sans token valide (header X-Mani-Pdf-Token). Retourne True si rejeté."""
        expected = os.environ.get("MANI_PDF_SERVICE_TOKEN", "")
        if not expected:
            self._json_response(503, {"ok": False, "error": "Service non configuré (token manquant)."})
            return True
        got = self.headers.get("X-Mani-Pdf-Token", "")
        if got != expected:
            self._json_response(401, {"ok": False, "error": "Token d'authentification invalide."})
            return True
        return False

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except (TypeError, ValueError):
            length = 0
        if length > MAX_POST_BODY_BYTES:
            self._json_response(
                413,
                {"ok": False, "error": "Corps de requête trop volumineux (max 64 Mo)."},
            )
            return
        if self._reject_unauthorized_post():
            return
        body = self.rfile.read(length).decode("utf-8")
        payload = json.loads(body or "{}")
        if LOG_VERBOSE:
            logging.info("POST %s payload=%s", self.path, _redact_payload_for_log(payload))
        try:
            if self.path == "/validate":
                # Frontière contrat (jsonschema) AVANT validate_pdf_path.
                schema_ok, schema_err = validate_pdf_validate_request(payload)
                if not schema_ok:
                    self._json_response(
                        400,
                        {
                            "ok": False,
                            "error": f"Contrat invalide: {schema_err}",
                            "errorCode": "CONTRACT_INVALID",
                        },
                    )
                    return
                result = validate_pdf_path(str(payload["path"]))
                if result.ok:
                    self._json_response(200, {"ok": True})
                else:
                    self._json_response(400, {"ok": False, "error": result.error})
                return

            if self.path == "/merge":
                output = merge_pdfs(payload.get("inputs", []), payload.get("output_path", ""))
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/split":
                output = split_pdf(
                    payload.get("input_path", ""),
                    int(payload.get("from_page", 1)),
                    int(payload.get("to_page", 1)),
                    payload.get("output_path", ""),
                )
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/split-groups":
                outputs = split_pdf_groups(
                    payload.get("input_path", ""),
                    payload.get("groups", []) or [],
                )
                self._json_response(200, {"ok": True, "output_paths": outputs})
                return

            if self.path == "/compress":
                if not _legacy_routes_enabled():
                    self._json_response(404, {"ok": False, "error": "Route désactivée."})
                    return
                output = compress_pdf(payload.get("input_path", ""), payload.get("output_path", ""))
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/protect":
                if not _legacy_routes_enabled():
                    self._json_response(404, {"ok": False, "error": "Route désactivée."})
                    return
                output = protect_pdf(
                    payload.get("input_path", ""),
                    payload.get("output_path", ""),
                    payload.get("password", ""),
                )
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/unprotect":
                if not _legacy_routes_enabled():
                    self._json_response(404, {"ok": False, "error": "Route désactivée."})
                    return
                output = unprotect_pdf(
                    payload.get("input_path", ""),
                    payload.get("output_path", ""),
                    payload.get("password", ""),
                )
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/apply-annotations":
                _sync_log_env_from_headers(self)
                # Frontière contrat (jsonschema) AVANT apply_annotations.
                schema_ok, schema_err = validate_apply_annotations_request(payload)
                if not schema_ok:
                    self._json_response(
                        400,
                        {
                            "ok": False,
                            "error": f"Contrat invalide: {schema_err}",
                            "errorCode": "CONTRACT_INVALID",
                        },
                    )
                    return
                input_path = str(payload.get("input_path", "") or "")
                output_path = str(payload.get("output_path", "") or "")
                ann = payload.get("annotations_by_page", {}) or {}
                ann_count = sum(len(v or []) for v in ann.values() if isinstance(v, list))
                if LOG_VERBOSE:
                    logging.info(
                        "apply-annotations input=%s output=%s annotations=%s",
                        input_path,
                        output_path,
                        ann_count,
                    )
                output = apply_annotations(
                    input_path,
                    output_path,
                    payload.get("canvases_px_by_page", {}) or {},
                    ann,
                )
                if LOG_VERBOSE:
                    logging.info("apply-annotations ok output=%s", output)
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/images-to-pdf":
                raw_paths = payload.get("input_paths", []) or []
                paths = [str(p) for p in raw_paths if p]
                output = images_to_pdf(paths, str(payload.get("output_path", "") or ""))
                self._json_response(200, {"ok": True, "output_path": output, "page_count": len(paths)})
                return

            self._json_response(404, {"ok": False, "error": "Route inconnue"})
        except Exception as exc:
            if LOG_VERBOSE:
                logging.exception("POST %s failed", self.path)
            self._json_response(400, {"ok": False, "error": str(exc)})

    def do_GET(self) -> None:  # noqa: N802
        if LOG_VERBOSE:
            logging.info("GET %s", self.path)
        if self.path == "/health":
            pypdf_ok = False
            reportlab_ok = False
            try:
                import pypdf  # type: ignore  # noqa: F401

                pypdf_ok = True
            except Exception:
                pass
            try:
                import reportlab  # type: ignore  # noqa: F401

                reportlab_ok = True
            except Exception:
                pass
            self._json_response(
                200,
                {
                    "ok": True,
                    "pypdf": pypdf_ok,
                    "reportlab": reportlab_ok,
                    "export_ready": pypdf_ok and reportlab_ok,
                },
            )
            return
        self._json_response(404, {"ok": False, "error": "Route inconnue"})


def run() -> int:
    server = HTTPServer(("127.0.0.1", 8765), Handler)
    if LOG_VERBOSE:
        logging.info("service starting on 127.0.0.1:8765")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()


if __name__ == "__main__":
    sys.exit(run())
