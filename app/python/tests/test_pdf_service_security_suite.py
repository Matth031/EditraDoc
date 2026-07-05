"""E-AUDIT-01.7 — regroupement et smoke des tests durcissement service Python."""

import os
import sys
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Modules de tests introduits par E-AUDIT-01 (découverte documentée).
E_AUDIT_01_TEST_MODULES = (
    "test_pdf_ops_output_path_guard",
    "test_pdf_service_body_limit",
    "test_pdf_service_token",
    "test_pdf_service_log_redaction",
    "test_pdf_ops_annotation_image_limit",
)


class TestEAudit01TestSuiteRegistered(unittest.TestCase):
    def test_audit_modules_importable(self):
        import importlib

        for name in E_AUDIT_01_TEST_MODULES:
            importlib.import_module(name)


if __name__ == "__main__":
  unittest.main()
