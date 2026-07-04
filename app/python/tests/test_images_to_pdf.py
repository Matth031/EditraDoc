import os
import shutil
import sys
import tempfile
import unittest

from pypdf import PdfReader

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pdf_ops import (
    IMAGE_TO_PDF_MARGIN_PT,
    _fit_image_on_page,
    _page_size_for_image,
    images_to_pdf,
)

REPO_TESTS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests"))
RAPTOR_PNG = os.path.join(REPO_TESTS, "raptor.png")


class TestImagesToPdfHelpers(unittest.TestCase):
    def test_page_size_landscape_when_wider(self):
        w, h = _page_size_for_image(2000, 1000)
        self.assertGreater(w, h)

    def test_page_size_portrait_when_taller(self):
        w, h = _page_size_for_image(1000, 2000)
        self.assertLess(w, h)

    def test_fit_preserves_aspect_ratio(self):
        page_w, page_h = 842.0, 595.0
        x, y, dw, dh = _fit_image_on_page(4000, 2000, page_w, page_h, IMAGE_TO_PDF_MARGIN_PT)
        self.assertAlmostEqual(dw / dh, 2.0, places=5)
        self.assertLessEqual(dw, page_w - 2 * IMAGE_TO_PDF_MARGIN_PT + 0.01)
        self.assertLessEqual(dh, page_h - 2 * IMAGE_TO_PDF_MARGIN_PT + 0.01)
        self.assertAlmostEqual(x + dw / 2, page_w / 2, places=3)
        self.assertAlmostEqual(y + dh / 2, page_h / 2, places=3)


@unittest.skipUnless(os.path.isfile(RAPTOR_PNG), f"fixture manquante: {RAPTOR_PNG}")
class TestImagesToPdfIntegration(unittest.TestCase):
    def _fixture_in_tmp(self, tmp_dir: str, name: str = "raptor.png") -> str:
        dest = os.path.join(tmp_dir, name)
        shutil.copy2(RAPTOR_PNG, dest)
        return dest

    def test_single_png_to_pdf(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self._fixture_in_tmp(tmp)
            out = os.path.join(tmp, "raptor.pdf")
            result = images_to_pdf([src], out)
            self.assertEqual(result, out)
            self.assertTrue(os.path.isfile(out))
            self.assertGreater(os.path.getsize(out), 100)
            reader = PdfReader(out)
            self.assertEqual(len(reader.pages), 1)

    def test_multiple_images_multipage(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = self._fixture_in_tmp(tmp)
            out = os.path.join(tmp, "album.pdf")
            paths = [src, src]
            images_to_pdf(paths, out)
            reader = PdfReader(out)
            self.assertEqual(len(reader.pages), 2)

    def test_rejects_unsupported_extension(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = os.path.join(tmp, "x.gif")
            with open(bad, "wb") as f:
                f.write(b"GIF89a")
            out = os.path.join(tmp, "x.pdf")
            with self.assertRaises(ValueError):
                images_to_pdf([bad], out)

    def test_rejects_empty_selection(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "empty.pdf")
            with self.assertRaises(ValueError):
                images_to_pdf([], out)


if __name__ == "__main__":
    unittest.main()
