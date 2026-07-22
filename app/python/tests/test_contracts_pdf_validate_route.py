"""
P1 — double frontière : POST /validate rejette via jsonschema AVANT validate_pdf_path.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer
from unittest import mock

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfWriter

from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-p1-validate-contract-token"


class TestValidateContractBoundary(unittest.TestCase):
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
        conn.request("POST", "/validate", body=body, headers=headers)
        resp = conn.getresponse()
        data = resp.read().decode("utf8")
        conn.close()
        return resp.status, json.loads(data or "{}")

    def _create_pdf(self, path: str) -> None:
        writer = PdfWriter()
        writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def test_golden_validate_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "a.pdf")
            self._create_pdf(p)
            status, data = self._post({"path": p})
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])

    def test_invalid_path_number_rejected_with_contract_code(self):
        status, data = self._post({"path": 42})
        self.assertEqual(status, 400)
        self.assertFalse(data["ok"])
        self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
        self.assertIn("Contrat invalide", data.get("error", ""))

    def test_invalid_empty_path_rejected(self):
        status, data = self._post({"path": ""})
        self.assertEqual(status, 400)
        self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")

    def test_invalid_missing_path_rejected(self):
        status, data = self._post({"file": "a.pdf"})
        self.assertEqual(status, 400)
        self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")

    def test_schema_runs_before_validate_pdf_path(self):
        """Preuve double frontière : jsonschema coupe avant validate_pdf_path."""
        with mock.patch("pdf_service.validate_pdf_path") as mocked:
            mocked.side_effect = AssertionError("validate_pdf_path ne doit pas être appelé")
            status, data = self._post({"path": 42})
            self.assertEqual(status, 400)
            self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
            mocked.assert_not_called()


if __name__ == "__main__":
    unittest.main()
