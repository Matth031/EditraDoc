"""
P1 — apply-annotations : golden peek→IPC (mêmes fixtures Node) + rejet avant apply_annotations.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer
from pathlib import Path
from unittest import mock

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from contract_validation import validate_apply_annotations_request
from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-p1-apply-annotations-token"
APP_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_DIR = APP_ROOT / "node-tests" / "fixtures" / "p1-export-golden"
GOLDEN_FILES = [
    "01-style-export-shape-image.peek.json",
    "02-soft-wrap.peek.json",
    "03-explicit-enter-two-lines.peek.json",
    "04-packaged-image-only.peek.json",
]


def peek_payload_to_ipc_request(peek: dict, output_path: str) -> dict:
    """
    Mapping peek→IPC (identique au helper Node `peek-to-ipc.js`).

    peekExportPayloadForTest expose camelCase sans output_path ;
    le contrat IPC / POST utilise snake_case + output_path.
    Contenu annotations/canvases inchangé — pas de reconstruction manuelle.
    """
    return {
        "input_path": str(peek.get("inputPath") or ""),
        "output_path": str(output_path or ""),
        "canvases_px_by_page": peek.get("canvases") or {},
        "annotations_by_page": peek.get("annotationsByPage") or {},
    }


class TestApplyAnnotationsContract(unittest.TestCase):
    def test_golden_payloads_pass_jsonschema(self) -> None:
        for name in GOLDEN_FILES:
            path = GOLDEN_DIR / name
            self.assertTrue(path.is_file(), f"fixture manquante: {path}")
            captured = json.loads(path.read_text(encoding="utf-8"))
            ipc = peek_payload_to_ipc_request(
                captured["payload"],
                r"C:\tmp\editradoc-golden-export.pdf",
            )
            ok, err = validate_apply_annotations_request(ipc)
            self.assertTrue(ok, f"{name}: {err}")

    def test_invalid_input_path_type_rejected(self) -> None:
        ok, err = validate_apply_annotations_request(
            {
                "input_path": 42,
                "output_path": "out.pdf",
                "canvases_px_by_page": {},
                "annotations_by_page": {},
            }
        )
        self.assertFalse(ok)
        self.assertTrue(err)


class TestApplyAnnotationsRouteBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._prev_token = os.environ.get("MANI_PDF_SERVICE_TOKEN")
        os.environ["MANI_PDF_SERVICE_TOKEN"] = TEST_SERVICE_TOKEN
        cls.server = HTTPServer(("127.0.0.1", 0), Handler)
        cls.host, cls.port = cls.server.server_address
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        if cls._prev_token is None:
            os.environ.pop("MANI_PDF_SERVICE_TOKEN", None)
        else:
            os.environ["MANI_PDF_SERVICE_TOKEN"] = cls._prev_token

    def _post(self, payload):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        body = json.dumps(payload)
        headers = {
            "Content-Type": "application/json",
            "X-Mani-Pdf-Token": TEST_SERVICE_TOKEN,
        }
        conn.request("POST", "/apply-annotations", body=body, headers=headers)
        resp = conn.getresponse()
        data = resp.read().decode("utf8")
        conn.close()
        return resp.status, json.loads(data or "{}")

    def test_schema_runs_before_apply_annotations(self):
        with mock.patch("pdf_service.apply_annotations") as mocked:
            mocked.side_effect = AssertionError("apply_annotations ne doit pas être appelé")
            status, data = self._post(
                {
                    "input_path": 42,
                    "output_path": "out.pdf",
                    "canvases_px_by_page": {},
                    "annotations_by_page": {},
                }
            )
            self.assertEqual(status, 400)
            self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
            mocked.assert_not_called()


if __name__ == "__main__":
    unittest.main()
