"""E-AUDIT-01.1 — refus des chemins de sortie hors du dossier source (pdf_ops)."""

import os
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfWriter

from pdf_ops import compress_pdf, merge_pdfs, protect_pdf, split_pdf, unprotect_pdf


class TestPdfOpsOutputPathGuard(unittest.TestCase):
    """Chaque opération d'écriture refuse un output_path hors du répertoire du PDF source."""

    def _create_pdf(self, path: str, pages: int = 1) -> None:
        writer = PdfWriter()
        for _ in range(pages):
            writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def _bad_output_in_nested_dir(self, tmp: str, basename: str = "out.pdf") -> str:
        sub = os.path.join(tmp, "nested")
        os.makedirs(sub, exist_ok=True)
        return os.path.join(sub, basename)

    def test_merge_rejects_output_outside_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src_a = os.path.join(tmp, "a.pdf")
            src_b = os.path.join(tmp, "b.pdf")
            out_bad = self._bad_output_in_nested_dir(tmp)
            self._create_pdf(src_a)
            self._create_pdf(src_b)
            with self.assertRaises(RuntimeError):
                merge_pdfs([src_a, src_b], out_bad)

    def test_split_rejects_output_outside_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out_bad = self._bad_output_in_nested_dir(tmp)
            self._create_pdf(src, 2)
            with self.assertRaises(RuntimeError):
                split_pdf(src, 1, 1, out_bad)

    def test_compress_rejects_output_outside_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out_bad = self._bad_output_in_nested_dir(tmp)
            self._create_pdf(src)
            with self.assertRaises(RuntimeError):
                compress_pdf(src, out_bad)

    def test_protect_rejects_output_outside_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out_bad = self._bad_output_in_nested_dir(tmp)
            self._create_pdf(src)
            with self.assertRaises(RuntimeError):
                protect_pdf(src, out_bad, "secret")

    def test_unprotect_rejects_output_outside_source_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            protected = os.path.join(tmp, "protected.pdf")
            out_bad = self._bad_output_in_nested_dir(tmp)
            self._create_pdf(src)
            protect_pdf(src, protected, "secret")
            with self.assertRaises(RuntimeError):
                unprotect_pdf(protected, out_bad, "secret")


if __name__ == "__main__":
    unittest.main()
