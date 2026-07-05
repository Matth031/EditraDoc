import json
import os
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfReader, PdfWriter

from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-audit-service-token"


class TestPdfServiceRoutes(unittest.TestCase):
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

    def request(self, method, route, payload=None, *, token=TEST_SERVICE_TOKEN):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        body = json.dumps(payload or {})
        headers = {"Content-Type": "application/json"}
        if method == "POST" and token is not None:
            headers["X-Mani-Pdf-Token"] = token
        conn.request(method, route, body=body if method == "POST" else None, headers=headers)
        resp = conn.getresponse()
        data = resp.read().decode("utf8")
        conn.close()
        return resp.status, json.loads(data or "{}")

    def _create_pdf(self, path):
        writer = PdfWriter()
        writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def _create_pdf_pages(self, path: str, pages: int) -> None:
        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def test_health(self):
        status, data = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])

    def test_validate(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "a.pdf")
            self._create_pdf(p)
            status, data = self.request("POST", "/validate", {"path": p})
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])

    def test_protect_unprotect(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            protected = os.path.join(tmp, "protected.pdf")
            unprotected = os.path.join(tmp, "unprotected.pdf")
            self._create_pdf(src)

            status, data = self.request(
                "POST", "/protect", {"input_path": src, "output_path": protected, "password": "1234"}
            )
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])
            self.assertTrue(PdfReader(protected).is_encrypted)

            status, data = self.request(
                "POST", "/unprotect", {"input_path": protected, "output_path": unprotected, "password": "1234"}
            )
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])
            self.assertFalse(PdfReader(unprotected).is_encrypted)

    def test_split_groups(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out_a = os.path.join(tmp, "a.pdf")
            out_b = os.path.join(tmp, "b.pdf")
            self._create_pdf_pages(src, 4)
            status, data = self.request(
                "POST",
                "/split-groups",
                {
                    "input_path": src,
                    "groups": [
                        {"output_path": out_a, "page_indices": [1, 2]},
                        {"output_path": out_b, "page_indices": [3, 4]},
                    ],
                },
            )
            self.assertEqual(status, 200)
            self.assertTrue(data["ok"])
            self.assertEqual(len(data.get("output_paths", [])), 2)
            self.assertEqual(len(PdfReader(out_a).pages), 2)
            self.assertEqual(len(PdfReader(out_b).pages), 2)


if __name__ == "__main__":
    unittest.main()
