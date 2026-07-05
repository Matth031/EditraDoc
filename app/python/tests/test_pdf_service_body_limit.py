"""E-AUDIT-01.2 — limite de taille des corps POST HTTP."""

import json
import os
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pdf_service import Handler, MAX_POST_BODY_BYTES

TEST_SERVICE_TOKEN = "test-audit-service-token"


class TestPdfServiceBodyLimit(unittest.TestCase):
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

    def test_rejects_content_length_above_max(self):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        oversize = MAX_POST_BODY_BYTES + 1
        headers = {
            "Content-Type": "application/json",
            "Content-Length": str(oversize),
            "X-Mani-Pdf-Token": TEST_SERVICE_TOKEN,
        }
        conn.request("POST", "/validate", body="{}", headers=headers)
        resp = conn.getresponse()
        data = json.loads(resp.read().decode("utf8") or "{}")
        conn.close()
        self.assertEqual(resp.status, 413)
        self.assertFalse(data.get("ok"))
        self.assertIn("64 Mo", data.get("error", ""))


if __name__ == "__main__":
    unittest.main()
