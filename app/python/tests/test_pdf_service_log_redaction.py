"""E-AUDIT-01.5 — redaction des champs sensibles dans les logs verbose."""

import io
import logging
import os
import sys
import unittest
from contextlib import redirect_stderr
from unittest.mock import patch

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pdf_service import _redact_payload_for_log


class TestPdfServiceLogRedaction(unittest.TestCase):
    def test_redacts_password_and_token(self):
        payload = {
            "input_path": "/tmp/a.pdf",
            "password": "secret123",
            "token": "abc",
            "nested": {"secret": "x", "ok": 1},
        }
        redacted = _redact_payload_for_log(payload)
        self.assertEqual(redacted["password"], "***")
        self.assertEqual(redacted["token"], "***")
        self.assertEqual(redacted["nested"]["secret"], "***")
        self.assertEqual(redacted["nested"]["ok"], 1)
        self.assertEqual(redacted["input_path"], "/tmp/a.pdf")

    def test_verbose_post_log_masks_password(self):
        from pdf_service import Handler

        buf = io.StringIO()
        with patch.dict(os.environ, {"MANI_PDF_PY_LOGS": "1"}, clear=False):
            with redirect_stderr(buf):
                with self.assertLogs("root", level="INFO") as captured:
                    logging.info(
                        "POST %s payload=%s",
                        "/protect",
                        _redact_payload_for_log(
                            {"input_path": "a.pdf", "output_path": "b.pdf", "password": "1234"}
                        ),
                    )
        joined = " ".join(captured.output)
        self.assertIn("***", joined)
        self.assertNotIn("1234", joined)


if __name__ == "__main__":
    unittest.main()
