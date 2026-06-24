"""Vérifie que pdf_service.py démarre sans le dossier courant dans sys.path (Python embeddable)."""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parents[1]
SERVICE_SCRIPT = SERVICE_DIR / "pdf_service.py"


class PdfServiceEmbeddedImportTest(unittest.TestCase):
    def test_import_pdf_ops_when_cwd_differs_from_service_dir(self) -> None:
        """Simule Python embeddable : cwd étranger et dossier service absent de sys.path."""
        with tempfile.TemporaryDirectory() as tmp:
            code = (
                "import os, runpy, sys; "
                f"service = {str(SERVICE_SCRIPT)!r}; "
                f"svc_dir = {str(SERVICE_DIR)!r}; "
                "sys.path = ["
                "p for p in sys.path "
                "if os.path.normcase(os.path.abspath(p)) "
                "!= os.path.normcase(os.path.abspath(svc_dir))"
                "]; "
                f"os.chdir({tmp!r}); "
                "runpy.run_path(service, run_name='__not_main__')"
            )
            proc = subprocess.run(
                [sys.executable, "-c", code],
                cwd=tmp,
                capture_output=True,
                text=True,
                timeout=30,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        self.assertEqual(
            proc.returncode,
            0,
            msg=f"stderr={proc.stderr!r} stdout={proc.stdout!r}",
        )


if __name__ == "__main__":
    unittest.main()
