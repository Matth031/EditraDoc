"""Tests journal diagnostic export (EDITRADOC_EXPORT_AUDIT)."""

from __future__ import annotations

import os
import tempfile
import unittest

from pdf_ops import _export_audit_log, _redact_text_preview_for_log


class ExportAuditLogTests(unittest.TestCase):
    def test_redact_text_preview_no_readable_content(self) -> None:
        out = _redact_text_preview_for_log("Texte secret du document")
        self.assertIn("len=", out)
        self.assertNotIn("secret", out)

    def test_export_audit_log_skipped_when_flag_off(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log_path = os.path.join(tmp, "audit.log")
            prev_audit = os.environ.get("EDITRADOC_EXPORT_AUDIT")
            prev_log = os.environ.get("EDITRADOC_LOG_PATH")
            try:
                os.environ["EDITRADOC_EXPORT_AUDIT"] = "0"
                os.environ["EDITRADOC_LOG_PATH"] = log_path
                _export_audit_log("should_not_write", {"plain_preview": "x"})
                self.assertFalse(os.path.exists(log_path))
            finally:
                if prev_audit is None:
                    os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
                else:
                    os.environ["EDITRADOC_EXPORT_AUDIT"] = prev_audit
                if prev_log is None:
                    os.environ.pop("EDITRADOC_LOG_PATH", None)
                else:
                    os.environ["EDITRADOC_LOG_PATH"] = prev_log

    def test_export_audit_log_no_write_when_flag_unset(self) -> None:
        """Régression S19 : sans EDITRADOC_EXPORT_AUDIT=1, aucune ligne audit."""
        with tempfile.TemporaryDirectory() as tmp:
            log_path = os.path.join(tmp, "audit_unset.log")
            prev_audit = os.environ.get("EDITRADOC_EXPORT_AUDIT")
            prev_log = os.environ.get("EDITRADOC_LOG_PATH")
            try:
                os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
                os.environ["EDITRADOC_LOG_PATH"] = log_path
                _export_audit_log("must_not_write", {"page": 1})
                self.assertFalse(os.path.exists(log_path))
            finally:
                if prev_audit is None:
                    os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
                else:
                    os.environ["EDITRADOC_EXPORT_AUDIT"] = prev_audit
                if prev_log is None:
                    os.environ.pop("EDITRADOC_LOG_PATH", None)
                else:
                    os.environ["EDITRADOC_LOG_PATH"] = prev_log

    def test_export_audit_log_writes_when_flag_on(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log_path = os.path.join(tmp, "audit.log")
            prev_audit = os.environ.get("EDITRADOC_EXPORT_AUDIT")
            prev_log = os.environ.get("EDITRADOC_LOG_PATH")
            try:
                os.environ["EDITRADOC_EXPORT_AUDIT"] = "1"
                os.environ["EDITRADOC_LOG_PATH"] = log_path
                _export_audit_log(
                    "text_draw",
                    {"plain_preview": "contenu confidentiel", "page": 1},
                )
                self.assertTrue(os.path.exists(log_path))
                body = open(log_path, encoding="utf-8").read()
                self.assertIn("text_draw", body)
                self.assertNotIn("confidentiel", body)
                self.assertIn("len=", body)
            finally:
                if prev_audit is None:
                    os.environ.pop("EDITRADOC_EXPORT_AUDIT", None)
                else:
                    os.environ["EDITRADOC_EXPORT_AUDIT"] = prev_audit
                if prev_log is None:
                    os.environ.pop("EDITRADOC_LOG_PATH", None)
                else:
                    os.environ["EDITRADOC_LOG_PATH"] = prev_log


if __name__ == "__main__":
    unittest.main()
