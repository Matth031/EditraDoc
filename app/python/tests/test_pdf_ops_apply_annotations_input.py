"""E-AUDIT-01.8 — validation PDF source pour apply_annotations (sortie flexible)."""

import os
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfWriter

from pdf_ops import apply_annotations


class TestApplyAnnotationsInputValidation(unittest.TestCase):
    def _create_pdf(self, path: str) -> None:
        writer = PdfWriter()
        writer.add_blank_page(width=595, height=842)
        with open(path, "wb") as f:
            writer.write(f)

    def test_rejects_missing_input_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "out.pdf")
            with self.assertRaises(RuntimeError) as ctx:
                apply_annotations(
                    os.path.join(tmp, "missing.pdf"),
                    out,
                    {},
                    {},
                )
            self.assertIn("n'existe pas", str(ctx.exception))

    def test_allows_output_in_other_directory(self) -> None:
        with tempfile.TemporaryDirectory() as src_dir:
            with tempfile.TemporaryDirectory() as out_dir:
                src = os.path.join(src_dir, "source.pdf")
                out = os.path.join(out_dir, "exported.pdf")
                self._create_pdf(src)
                result = apply_annotations(src, out, {"1": {"w": 100, "h": 100}}, {})
                self.assertEqual(result, out)
                self.assertTrue(os.path.isfile(out))


if __name__ == "__main__":
    unittest.main()
