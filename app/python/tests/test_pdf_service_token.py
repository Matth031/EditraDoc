"""E-AUDIT-01.3 — authentification POST via header X-Mani-Pdf-Token."""

import json
import os
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfWriter

from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-audit-service-token"


class TestPdfServiceToken(unittest.TestCase):
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

    def _post(self, route: str, payload: dict, *, token: str | None = TEST_SERVICE_TOKEN):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        body = json.dumps(payload)
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["X-Mani-Pdf-Token"] = token
        conn.request("POST", route, body=body, headers=headers)
        resp = conn.getresponse()
        data = json.loads(resp.read().decode("utf8") or "{}")
        conn.close()
        return resp.status, data

    def _create_pdf(self, path: str) -> None:
        writer = PdfWriter()
        writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def test_rejects_post_without_token(self):
        status, data = self._post("/validate", {"path": "x.pdf"}, token=None)
        self.assertEqual(status, 401)
        self.assertFalse(data.get("ok"))

    def test_rejects_post_with_wrong_token(self):
        status, data = self._post("/validate", {"path": "x.pdf"}, token="wrong-token")
        self.assertEqual(status, 401)
        self.assertFalse(data.get("ok"))

    def test_accepts_post_with_valid_token(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "a.pdf")
            self._create_pdf(p)
            status, data = self._post("/validate", {"path": p})
            self.assertEqual(status, 200)
            self.assertTrue(data.get("ok"))


if __name__ == "__main__":
    unittest.main()
