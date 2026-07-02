"""Non-régression : écrasement d'un PDF existant (même chemin ou chemin distinct)."""
from __future__ import annotations

import hashlib
import os
import shutil
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pdf_ops import apply_annotations


class PdfOverwriteTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.mkdtemp(prefix="editradoc_ow_")
        self.src = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "tests", "formulaire_test.pdf"
        )
        self.src = os.path.abspath(self.src)
        if not os.path.isfile(self.src):
            self.skipTest(f"fixture manquant: {self.src}")

    def tearDown(self) -> None:
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def _copy_fixture(self, name: str) -> str:
        out = os.path.join(self._tmpdir, name)
        shutil.copy(self.src, out)
        return out

    def test_overwrite_same_path_changes_content(self) -> None:
        target = self._copy_fixture("same.pdf")
        before = hashlib.md5(open(target, "rb").read()).hexdigest()
        ann = {
            "1": [
                {
                    "id": "r1",
                    "type": "rect",
                    "x": 40,
                    "y": 40,
                    "w": 120,
                    "h": 80,
                    "fillColor": "#007acc",
                    "fillAlpha": 0.35,
                }
            ]
        }
        apply_annotations(target, target, {"1": {"w": 595, "h": 842}}, ann)
        after = hashlib.md5(open(target, "rb").read()).hexdigest()
        self.assertNotEqual(before, after)

    def test_overwrite_other_existing_file(self) -> None:
        source = self._copy_fixture("source.pdf")
        target = self._copy_fixture("target.pdf")
        before = hashlib.md5(open(target, "rb").read()).hexdigest()
        ann = {
            "1": [
                {
                    "id": "t1",
                    "type": "text",
                    "x": 80,
                    "y": 80,
                    "w": 200,
                    "h": 40,
                    "text": "OVERWRITE_OK",
                    "fontSize": 14,
                    "padding": 6,
                    "textColor": "#111111",
                }
            ]
        }
        apply_annotations(source, target, {"1": {"w": 595, "h": 842}}, ann)
        after = hashlib.md5(open(target, "rb").read()).hexdigest()
        self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
