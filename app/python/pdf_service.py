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
    merge_pdfs,
    protect_pdf,
    split_pdf,
    split_pdf_groups,
    unprotect_pdf,
)
from pdf_validation import validate_pdf_path

LOG_VERBOSE = os.environ.get("MANI_PDF_PY_LOGS") != "0"
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

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        payload = json.loads(body or "{}")
        if LOG_VERBOSE:
            logging.info("POST %s payload=%s", self.path, payload)
        try:
            if self.path == "/validate":
                result = validate_pdf_path(payload.get("path", ""))
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
                output = compress_pdf(payload.get("input_path", ""), payload.get("output_path", ""))
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/protect":
                output = protect_pdf(
                    payload.get("input_path", ""),
                    payload.get("output_path", ""),
                    payload.get("password", ""),
                )
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/unprotect":
                output = unprotect_pdf(
                    payload.get("input_path", ""),
                    payload.get("output_path", ""),
                    payload.get("password", ""),
                )
                self._json_response(200, {"ok": True, "output_path": output})
                return

            if self.path == "/apply-annotations":
                output = apply_annotations(
                    payload.get("input_path", ""),
                    payload.get("output_path", ""),
                    payload.get("canvases_px_by_page", {}) or {},
                    payload.get("annotations_by_page", {}) or {},
                )
                self._json_response(200, {"ok": True, "output_path": output})
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
            try:
                import pypdf  # type: ignore  # noqa: F401

                self._json_response(200, {"ok": True, "pypdf": True})
            except Exception:
                self._json_response(200, {"ok": True, "pypdf": False})
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
