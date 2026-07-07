import os
import re
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pypdf import PdfReader, PdfWriter

from pdf_ops import _rl_font_name, _text_has_markup, apply_annotations


class TestPdfExportAnnotations(unittest.TestCase):
    def _create_blank_pdf(self, path: str, width: float = 595.0, height: float = 842.0, rotate: int = 0):
        writer = PdfWriter()
        writer.add_blank_page(width=width, height=height)
        if rotate:
            writer.pages[0].rotate(rotate)
        with open(path, "wb") as f:
            writer.write(f)

    def _pdf_bytes(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def test_rl_font_name_mapping(self):
        self.assertEqual(_rl_font_name("Arial"), "Helvetica")
        self.assertEqual(_rl_font_name("Times New Roman"), "Times-Roman")
        self.assertEqual(_rl_font_name("Courier New"), "Courier")

    def test_text_has_markup(self):
        self.assertTrue(_text_has_markup("<b>x</b>", "x"))
        self.assertFalse(_text_has_markup("simple", "simple"))
        self.assertTrue(_text_has_markup('<span style="font-weight:bold">x</span>', "x"))

    def test_apply_annotations_text_style_times_and_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src)

            apply_annotations(
                src,
                out,
                {"1": {"w": 400, "h": 300, "rotation": 0}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 50,
                            "y": 100,
                            "w": 220,
                            "h": 80,
                            "text": "EXPORT_STYLE",
                            "textHtml": "EXPORT_STYLE",
                            "fontFamily": "Times New Roman",
                            "fontSize": 28,
                            "padding": 8,
                            "textColor": "#cc0000",
                        }
                    ]
                },
            )

            raw = self._pdf_bytes(out).decode("latin1", errors="ignore")
            reader = PdfReader(out)
            text = (reader.pages[0].extract_text() or "").replace("\n", "")
            self.assertIn("EXPORT_STYLE", text)
            self.assertRegex(raw, r"/Times(-Roman)?")
            self.assertTrue(re.search(r"(?:28|4[01])(?:\.\d+)?\s+Tf", raw))

    def test_apply_annotations_text_html_bold(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src)

            apply_annotations(
                src,
                out,
                {"1": {"w": 400, "h": 300, "rotation": 0}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 40,
                            "y": 120,
                            "w": 200,
                            "h": 60,
                            "text": "GRAS",
                            "textHtml": "<b>GRAS</b>",
                            "fontFamily": "Arial",
                            "fontSize": 18,
                            "padding": 6,
                            "textColor": "#111111",
                        }
                    ]
                },
            )

            raw = self._pdf_bytes(out).decode("latin1", errors="ignore")
            self.assertIn("GRAS", raw)
            self.assertTrue("Helvetica-Bold" in raw or re.search(r"/[A-Z]+\+Helvetica-Bold", raw))

    def test_apply_annotations_rotated_page_pdf_user_coords(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "rot90.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src, width=842.0, height=595.0, rotate=90)

            cw, ch = 595, 842
            page_w, page_h = 842.0, 595.0
            sx = page_h / cw
            sy = page_w / ch
            w, h = 180, 36
            apply_annotations(
                src,
                out,
                {"1": {"w": cw, "h": ch, "rotation": 90}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 120 * sx,
                            "y": 60 * sy,
                            "w": w,
                            "h": h,
                            "canvas_w": w,
                            "canvas_h": h,
                            "pdf_ex": [0.0, -w * sx],
                            "pdf_ey": [h * sy, 0.0],
                            "coords_space": "pdf_user",
                            "text": "ROT90_OK",
                            "textHtml": "ROT90_OK",
                            "fontFamily": "Arial",
                            "fontSize": 16,
                            "padding": 4,
                            "textColor": "#111111",
                        }
                    ]
                },
            )

            reader = PdfReader(out)
            text = (reader.pages[0].extract_text() or "").replace("\n", " ")
            self.assertIn("ROT90_OK", text)

    def test_apply_annotations_writes_page_rotate_from_canvas_meta(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src)

            apply_annotations(
                src,
                out,
                {"1": {"w": 400, "h": 300, "rotation": 90}},
                {},
            )

            reader = PdfReader(out)
            rot = int(reader.pages[0].get("/Rotate", 0) or 0) % 360
            self.assertEqual(rot, 90)

    def test_apply_annotations_cumulative_source_and_user_rotate(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src90.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src, rotate=90)

            apply_annotations(
                src,
                out,
                {"1": {"w": 300, "h": 400, "rotation": 180}},
                {},
            )

            reader = PdfReader(out)
            rot = int(reader.pages[0].get("/Rotate", 0) or 0) % 360
            self.assertEqual(rot, 180)

    def test_apply_annotations_text_narrow_width_wrap_height(self):
        """Régression : texte ~17 car. à w≈162 ne doit pas disparaître (zone fils morte ReportLab)."""
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src, width=760, height=1074)

            apply_annotations(
                src,
                out,
                {"1": {"w": 760, "h": 1074, "rotation": 0}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 80,
                            "y": 80,
                            "w": 162,
                            "h": 33,
                            "text": "UI_OVERWRITE_TEST",
                            "textHtml": "UI_OVERWRITE_TEST",
                            "fontFamily": "Arial",
                            "fontSize": 14,
                            "padding": 6,
                            "textColor": "#111111",
                        }
                    ]
                },
            )

            reader = PdfReader(out)
            text = (reader.pages[0].extract_text() or "").replace("\n", " ")
            self.assertIn("UI_OVERWRITE_TEST", text)


    def test_apply_annotations_text_multiline_html_format(self):
        """Régression : 2 lignes + gras/italique/souligné/couleur conservés à l'export."""
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src, width=760, height=1074)
            html = (
                "<div><i>on ajoute</i> <u>un texte</u> <b><u>voir</u></b></div>"
                "<div><b><u>si</u></b> ça marche <font color=\"#00aa00\">encore !</font></div>"
            )
            plain = "on ajoute un texte voir\nsi ça marche encore !"
            apply_annotations(
                src,
                out,
                {"1": {"w": 760, "h": 1074, "rotation": 0}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 80,
                            "y": 80,
                            "w": 320,
                            "h": 80,
                            "text": plain,
                            "textHtml": html,
                            "fontFamily": "Arial",
                            "fontSize": 14,
                            "padding": 6,
                            "textColor": "#e87c7c",
                        }
                    ]
                },
            )
            raw = self._pdf_bytes(out).decode("latin1", errors="ignore")
            reader = PdfReader(out)
            text = (reader.pages[0].extract_text() or "").replace("\n", " ")
            self.assertIn("on ajoute", text)
            self.assertIn("encore", text)
            self.assertTrue("Helvetica-Bold" in raw or re.search(r"/[A-Z]+\+Helvetica-Bold", raw))
            self.assertTrue("Helvetica-Oblique" in raw or re.search(r"/[A-Z]+\+Helvetica-Oblique", raw))

    def test_apply_annotations_text_soft_wrap_br_narrow_width(self):
        """Régression : <br> issu du soft-wrap UI ne doit pas être aplati sur une seule ligne."""
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            self._create_blank_pdf(src, width=760, height=1074)
            html = (
                "<div><i>on ajoute</i> <u>un texte</u> <b><u>voir si</u></b><br>"
                "<b>ça marche </b><font color=\"#00aa00\"><b>encore</b> !</font></div>"
            )
            plain = "on ajoute un texte voir si\nça marche encore !"
            apply_annotations(
                src,
                out,
                {"1": {"w": 760, "h": 1074, "rotation": 0}},
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 80,
                            "y": 80,
                            "w": 200,
                            "h": 60,
                            "text": plain,
                            "textHtml": html,
                            "fontFamily": "Arial",
                            "fontSize": 14,
                            "padding": 6,
                            "textColor": "#e87c7c",
                        }
                    ]
                },
            )
            reader = PdfReader(out)
            text = (reader.pages[0].extract_text() or "").replace("\n", " ")
            self.assertIn("voir si", text)
            self.assertIn("encore", text)
            self.assertIn("!", text)
            self.assertNotRegex(text, r"encore\s*!$")

    def test_apply_annotations_text_multipage_page1_and_page4(self):
        """Régression : annotations texte sur pages 1 et 4 exportées toutes les deux."""
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.pdf")
            out = os.path.join(tmp, "out.pdf")
            writer = PdfWriter()
            for _ in range(4):
                writer.add_blank_page(width=760, height=1074)
            with open(src, "wb") as f:
                writer.write(f)

            apply_annotations(
                src,
                out,
                {
                    "1": {"w": 760, "h": 1074, "rotation": 0},
                    "4": {"w": 760, "h": 1074, "rotation": 0},
                },
                {
                    "1": [
                        {
                            "type": "text",
                            "x": 80,
                            "y": 80,
                            "w": 220,
                            "h": 40,
                            "text": "TEXTE_EXPORT_PAGE_1",
                            "textHtml": "TEXTE_EXPORT_PAGE_1",
                            "fontFamily": "Arial",
                            "fontSize": 14,
                            "padding": 6,
                            "textColor": "#111111",
                        }
                    ],
                    "4": [
                        {
                            "type": "text",
                            "x": 80,
                            "y": 120,
                            "w": 220,
                            "h": 40,
                            "text": "TEXTE_EXPORT_PAGE_4",
                            "textHtml": "TEXTE_EXPORT_PAGE_4",
                            "fontFamily": "Arial",
                            "fontSize": 14,
                            "padding": 6,
                            "textColor": "#111111",
                        }
                    ],
                },
            )

            reader = PdfReader(out)
            self.assertGreaterEqual(len(reader.pages), 4)
            all_text = " ".join(
                (p.extract_text() or "").replace("\n", " ") for p in reader.pages
            )
            self.assertIn("TEXTE_EXPORT_PAGE_1", all_text)
            self.assertIn("TEXTE_EXPORT_PAGE_4", all_text)

if __name__ == "__main__":
    unittest.main()
