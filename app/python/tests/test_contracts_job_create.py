"""
P1 — job:create / merge / split-groups : schémas + rejet avant ops (mock assert_not_called).
S1 : hors schéma — pdf_ops._assert_output_in_same_directory_as_input inchangé.
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

from contract_validation import (
    validate_merge_request,
    validate_split_groups_request,
    validate_split_request,
)
from pdf_service import Handler

TEST_SERVICE_TOKEN = "test-p1-job-create-token"
APP_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_DIR = APP_ROOT / "node-tests" / "fixtures" / "p1-job-create"


class TestJobPayloadSchemas(unittest.TestCase):
    def test_golden_merge_payload_passes(self) -> None:
        ipc = json.loads((GOLDEN_DIR / "01-merge.json").read_text(encoding="utf-8"))
        ok, err = validate_merge_request(ipc["payload"])
        self.assertTrue(ok, err)

    def test_golden_split_groups_payload_passes(self) -> None:
        ipc = json.loads((GOLDEN_DIR / "02-split-groups.json").read_text(encoding="utf-8"))
        ok, err = validate_split_groups_request(ipc["payload"])
        self.assertTrue(ok, err)

    def test_golden_split_legacy_payload_passes(self) -> None:
        ipc = json.loads((GOLDEN_DIR / "03-split-legacy.json").read_text(encoding="utf-8"))
        ok, err = validate_split_request(ipc["payload"])
        self.assertTrue(ok, err)

    def test_merge_single_input_rejected(self) -> None:
        ok, err = validate_merge_request({"inputs": ["a.pdf"], "output_path": "out.pdf"})
        self.assertFalse(ok)
        self.assertTrue(err)

    def test_split_groups_missing_page_indices_rejected(self) -> None:
        ok, err = validate_split_groups_request(
            {"input_path": "a.pdf", "groups": [{"output_path": "out.pdf"}]}
        )
        self.assertFalse(ok)


class TestMergeSplitRouteBoundary(unittest.TestCase):
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

    def _post(self, route: str, payload: dict):
        conn = HTTPConnection(self.host, self.port, timeout=5)
        body = json.dumps(payload)
        headers = {
            "Content-Type": "application/json",
            "X-Mani-Pdf-Token": TEST_SERVICE_TOKEN,
        }
        conn.request("POST", route, body=body, headers=headers)
        resp = conn.getresponse()
        data = resp.read().decode("utf8")
        conn.close()
        return resp.status, json.loads(data or "{}")

    def test_merge_schema_runs_before_merge_pdfs(self):
        with mock.patch("pdf_service.merge_pdfs") as mocked:
            mocked.side_effect = AssertionError("merge_pdfs ne doit pas être appelé")
            status, data = self._post(
                "/merge",
                {"inputs": ["only-one.pdf"], "output_path": "out.pdf"},
            )
            self.assertEqual(status, 400)
            self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
            mocked.assert_not_called()

    def test_split_groups_schema_runs_before_split_pdf_groups(self):
        with mock.patch("pdf_service.split_pdf_groups") as mocked:
            mocked.side_effect = AssertionError("split_pdf_groups ne doit pas être appelé")
            status, data = self._post(
                "/split-groups",
                {"input_path": 42, "groups": []},
            )
            self.assertEqual(status, 400)
            self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
            mocked.assert_not_called()

    def test_split_legacy_schema_runs_before_split_pdf(self):
        with mock.patch("pdf_service.split_pdf") as mocked:
            mocked.side_effect = AssertionError("split_pdf ne doit pas être appelé")
            status, data = self._post(
                "/split",
                {
                    "input_path": "a.pdf",
                    "output_path": "b.pdf",
                    # from_page / to_page manquants → contrat
                },
            )
            self.assertEqual(status, 400)
            self.assertEqual(data.get("errorCode"), "CONTRACT_INVALID")
            mocked.assert_not_called()


if __name__ == "__main__":
    unittest.main()
