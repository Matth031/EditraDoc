from __future__ import annotations

import logging
import os
import re
import tempfile
from html import unescape
from html.parser import HTMLParser
from typing import Iterable
from xml.sax.saxutils import escape

logger = logging.getLogger(__name__)


def _require_pypdf():
    try:
        from pypdf import PdfReader, PdfWriter  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Le module 'pypdf' est requis pour les operations PDF. Installez-le avec: pip install pypdf"
        ) from exc
    return PdfReader, PdfWriter


def _require_reportlab():
    try:
        from reportlab.pdfgen import canvas  # type: ignore  # noqa: F401
        from reportlab.lib.utils import ImageReader  # type: ignore  # noqa: F401
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Le module 'reportlab' est requis pour l'export avec annotations. Installez-le avec: pip install reportlab"
        ) from exc


def _html_to_plain(raw: str) -> str:
    if not raw:
        return ""
    s = unescape(str(raw))
    s = re.sub(r"(?i)<\s*br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.replace("\r\n", "\n").strip()


def _num(v, default: float) -> float:
    if v is None:
        return float(default)
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)


def _normalize_rl_color(val: str) -> str:
    """Couleur CSS -> #rrggbb pour les attributs <font color=...> de ReportLab."""
    val = (val or "").strip().strip('"').strip("'")
    m = re.match(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)", val, re.I)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"#{r:02x}{g:02x}{b:02x}"
    return val


class _AnnoHtmlToReportLab(HTMLParser):
    """Convertit un sous-ensemble du HTML Chromium (contenteditable) vers le mini-HTML de Paragraph."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip = 0
        self._span_stack: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._skip:
            self._skip += 1
            return
        t = tag.lower()
        ad = {str(k).lower(): (v or "") for k, v in attrs}
        if t in ("script", "style"):
            self._skip = 1
            return
        if t == "br":
            self.out.append("<br/>")
            return
        if t in ("b", "strong"):
            self.out.append("<b>")
            return
        if t in ("i", "em"):
            self.out.append("<i>")
            return
        if t == "u":
            self.out.append("<u>")
            return
        if t == "font":
            col = ad.get("color")
            layers: list[str] = []
            if col:
                cnorm = _normalize_rl_color(str(col))
                self.out.append(f'<font color="{escape(cnorm)}">')
                layers.append("font")
            self._span_stack.append(layers)
            return
        if t == "span":
            st = ad.get("style", "") or ""
            layers = []
            cm = re.search(r"color:\s*([^;]+)", st, re.I)
            if cm:
                cnorm = _normalize_rl_color(cm.group(1).strip())
                self.out.append(f'<font color="{escape(cnorm)}">')
                layers.append("font")
            if re.search(r"font-weight:\s*(bold|[67]00|bolder)", st, re.I):
                self.out.append("<b>")
                layers.append("b")
            if re.search(r"font-style:\s*italic", st, re.I):
                self.out.append("<i>")
                layers.append("i")
            if re.search(r"text-decoration:\s*[^;]*\bunderline\b", st, re.I):
                self.out.append("<u>")
                layers.append("u")
            self._span_stack.append(layers)
            return
        # div / p : saut de ligne visuel
        if t in ("div", "p", "li"):
            if self.out and not self.out[-1].endswith("<br/>"):
                self.out.append("<br/>")

    def handle_endtag(self, tag: str) -> None:
        if self._skip:
            self._skip -= 1
            return
        t = tag.lower()
        if t in ("b", "strong"):
            self.out.append("</b>")
            return
        if t in ("i", "em"):
            self.out.append("</i>")
            return
        if t == "u":
            self.out.append("</u>")
            return
        if t in ("span", "font"):
            layers = self._span_stack.pop() if self._span_stack else []
            for kind in reversed(layers):
                if kind == "font":
                    self.out.append("</font>")
                elif kind == "b":
                    self.out.append("</b>")
                elif kind == "i":
                    self.out.append("</i>")
                elif kind == "u":
                    self.out.append("</u>")
            return
        if t in ("div", "p"):
            self.out.append("<br/>")

    def handle_data(self, data: str) -> None:
        if self._skip:
            return
        if data:
            self.out.append(escape(data))


def _html_to_paragraph_markup(html: str) -> str:
    raw = str(html or "").strip()
    if not raw:
        return ""
    if not re.search(r"<\s*[a-zA-Z]", raw):
        return escape(unescape(raw))
    p = _AnnoHtmlToReportLab()
    try:
        p.feed(raw)
        p.close()
    except Exception:
        return escape(_html_to_plain(raw))
    frag = "".join(p.out)
    frag = re.sub(r"(<br\s*/>\s*){2,}", "<br/>", frag, flags=re.I)
    if not frag.strip():
        return escape(_html_to_plain(raw))
    return frag


def _atomic_write_pdf(writer, output_path: str) -> None:
    """Écrit le PDF via un fichier temporaire puis remplace la cible (écrasement sûr)."""
    out_abs = os.path.abspath(output_path)
    out_dir = os.path.dirname(out_abs) or "."
    fd, tmp_path = tempfile.mkstemp(suffix=".pdf", dir=out_dir)
    os.close(fd)
    try:
        with open(tmp_path, "wb") as f:
            writer.write(f)
        os.replace(tmp_path, out_abs)
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise


def apply_annotations(input_path: str, output_path: str, canvases_px_by_page: dict, annotations_by_page: dict) -> str:
    """
    Crée un nouveau PDF (output_path) en gardant l'original intact (input_path),
    en appliquant les annotations en surimpression (flatten via merge).
    """
    PdfReader, PdfWriter = _require_pypdf()
    _require_reportlab()
    from reportlab.pdfgen import canvas  # type: ignore
    from reportlab.lib.colors import Color, HexColor  # type: ignore
    from reportlab.lib.styles import ParagraphStyle  # type: ignore
    from reportlab.lib.utils import ImageReader  # type: ignore
    from reportlab.platypus import Frame, Paragraph  # type: ignore
    from io import BytesIO
    import base64

    reader = PdfReader(input_path)
    writer = PdfWriter()
    _dbg = os.environ.get("MANI_PDF_EXPORT_DEBUG") == "1"
    if _dbg:
        logger.info(
            "apply_annotations input=%s pages=%s keys=%s",
            input_path,
            len(reader.pages),
            list((annotations_by_page or {}).keys())[:20],
        )

    def _color(c: str):
        try:
            if c is None or str(c).strip() == "" or str(c).lower() in ("transparent", "none"):
                return None
            s = str(c).strip()
            m = re.match(
                r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+)\s*)?\)",
                s,
                re.I,
            )
            if m:
                r_, g_, b_ = int(m.group(1)), int(m.group(2)), int(m.group(3))
                return Color(r_ / 255.0, g_ / 255.0, b_ / 255.0)
            if s.startswith("#"):
                h = s[1:]
                if len(h) == 3:
                    s = "#" + "".join(ch * 2 for ch in h)
                elif len(h) >= 6:
                    s = "#" + h[:6]
                return HexColor(s)
        except Exception:
            return None
        return None

    # Pourcentages CSS (origine haut-gauche) -> coordonnées PDF (origine bas-gauche du cadre x,y,w,h).
    def _poly_path(cnv, bx, by, bw, bh, pct_pairs: list[tuple[float, float]]):
        if not pct_pairs:
            return None
        p = cnv.beginPath()
        fx, fy = pct_pairs[0]
        p.moveTo(bx + bw * fx / 100.0, by + bh * (1.0 - fy / 100.0))
        for fx, fy in pct_pairs[1:]:
            p.lineTo(bx + bw * fx / 100.0, by + bh * (1.0 - fy / 100.0))
        p.close()
        return p

    # Même géométrie que clip-path dans styles.css (renderer).
    SHAPE_PCT: dict[str, list[tuple[float, float]]] = {
        "triangle": [(50, 0), (0, 100), (100, 100)],
        "diamond": [(50, 0), (100, 50), (50, 100), (0, 50)],
        "pentagon": [(50, 0), (95, 35), (78, 100), (22, 100), (5, 35)],
        "hexagon": [(25, 0), (75, 0), (100, 50), (75, 100), (25, 100), (0, 50)],
        "octagon": [(30, 0), (70, 0), (100, 30), (100, 70), (70, 100), (30, 100), (0, 70), (0, 30)],
        "star": [(50, 0), (61, 35), (98, 35), (68, 57), (79, 91), (50, 70), (21, 91), (32, 57), (2, 35), (39, 35)],
        "arrow": [(0, 35), (70, 35), (70, 15), (100, 50), (70, 85), (70, 65), (0, 65)],
        # Cœur : contour polygonal stable et symétrique — doit rester aligné avec renderer.js.
        "heart": [
            (50, 92),
            (62, 82),
            (74, 70),
            (84, 56),
            (90, 42),
            (88, 30),
            (80, 20),
            (68, 16),
            (58, 20),
            (50, 32),
            (42, 20),
            (32, 16),
            (20, 20),
            (12, 30),
            (10, 42),
            (16, 56),
            (26, 70),
            (38, 82),
        ],
        "cross": [(35, 0), (65, 0), (65, 35), (100, 35), (100, 65), (65, 65), (65, 100), (35, 100), (35, 65), (0, 65), (0, 35), (35, 35)],
        "parallelogram": [(18, 0), (100, 0), (82, 100), (0, 100)],
        "trapezoid": [(18, 0), (82, 0), (100, 100), (0, 100)],
    }

    # strokeWidth 0 par défaut = remplissage seul (WYSIWYG avec l’app sans contour). La ligne reste tracée au trait.
    DEFAULT_SHAPE_STYLES: dict[str, dict] = {
        "rect": {"fillColor": "#007acc", "fillAlpha": 0.2, "strokeColor": "#007acc", "strokeWidth": 0},
        "ellipse": {"fillColor": "#ff7800", "fillAlpha": 0.2, "strokeColor": "#ff7800", "strokeWidth": 0},
        "triangle": {"fillColor": "#7d53ff", "fillAlpha": 0.25, "strokeColor": "#7d53ff", "strokeWidth": 0},
        "line": {"fillColor": "#000000", "fillAlpha": 0.0, "strokeColor": "#00a86b", "strokeWidth": 3},
        "diamond": {"fillColor": "#d10068", "fillAlpha": 0.25, "strokeColor": "#d10068", "strokeWidth": 0},
        "pentagon": {"fillColor": "#0077c2", "fillAlpha": 0.22, "strokeColor": "#0077c2", "strokeWidth": 0},
        "hexagon": {"fillColor": "#2e8b57", "fillAlpha": 0.25, "strokeColor": "#2e8b57", "strokeWidth": 0},
        "octagon": {"fillColor": "#d84315", "fillAlpha": 0.22, "strokeColor": "#d84315", "strokeWidth": 0},
        "star": {"fillColor": "#ffd700", "fillAlpha": 0.3, "strokeColor": "#d4a017", "strokeWidth": 0},
        "arrow": {"fillColor": "#2196f3", "fillAlpha": 0.3, "strokeColor": "#1976d2", "strokeWidth": 0},
        "heart": {"fillColor": "#e91e63", "fillAlpha": 0.3, "strokeColor": "#c2185b", "strokeWidth": 0},
        "cross": {"fillColor": "#ffc107", "fillAlpha": 0.3, "strokeColor": "#ff8f00", "strokeWidth": 0},
        "parallelogram": {"fillColor": "#7b1fa2", "fillAlpha": 0.24, "strokeColor": "#7b1fa2", "strokeWidth": 0},
        "trapezoid": {"fillColor": "#0288d1", "fillAlpha": 0.22, "strokeColor": "#0288d1", "strokeWidth": 0},
    }

    for idx, page in enumerate(reader.pages, start=1):
        page_w = float(page.mediabox.width)
        page_h = float(page.mediabox.height)

        canvas_px = canvases_px_by_page.get(str(idx)) or canvases_px_by_page.get(idx) or {}
        cw = float(canvas_px.get("w") or 0)
        ch = float(canvas_px.get("h") or 0)
        if cw <= 0 or ch <= 0:
            # fallback: ratio 1
            sx = sy = 1.0
        else:
            sx = page_w / cw
            sy = page_h / ch

        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w, page_h))

        annos = annotations_by_page.get(str(idx)) or annotations_by_page.get(idx) or []
        for a in annos:
            try:
                raw_type = a.get("type")
                a_kind = str(raw_type or "").strip().lower()
                x = float(a.get("x") or 0) * sx
                y_top = float(a.get("y") or 0) * sy
                w = float(a.get("w") or 0) * sx
                h = float(a.get("h") or 0) * sy
                rot = _num(a.get("rotation"), 0.0)
                opacity = _num(a.get("opacity"), 100.0) / 100.0

                # DOM top-left -> PDF bottom-left
                y = page_h - (y_top + h)

                c.saveState()
                try:
                    c.setFillAlpha(opacity)
                    c.setStrokeAlpha(opacity)
                except Exception:
                    pass

                # Rotation : WYSIWYG avec le renderer.
                # Renderer (DOM) : repère y vers le bas + `transform-origin: 0 0` sur `.annotation`
                # => rotation positive = sens horaire autour du coin haut-gauche.
                # PDF (reportlab) : repère y vers le haut + rotation positive = sens anti-horaire.
                # On pivote donc autour du coin haut-gauche (x, y + h) et on inverse le signe.
                if rot:
                    px = x
                    py = y + h
                    c.translate(px, py)
                    c.rotate(-rot)
                    c.translate(-px, -py)

                if a_kind == "text":
                    padding = _num(a.get("padding"), 6.0) * sx
                    font_size = max(6.0, _num(a.get("fontSize"), 14.0) * sx)
                    text_color = _color(str(a.get("textColor") or "#111111")) or HexColor("#111111")
                    bg = a.get("bgColor")
                    if bg and str(bg).strip() and str(bg).lower() not in ("transparent", "none"):
                        bgc = _color(str(bg))
                        if bgc is not None:
                            c.setFillColor(bgc)
                            c.rect(x, y, w, h, stroke=0, fill=1)
                    raw_html = a.get("textHtml")
                    if raw_html and str(raw_html).strip() and "<" in str(raw_html):
                        frag = _html_to_paragraph_markup(str(raw_html))
                    else:
                        frag = escape(unescape(str(a.get("text") or "")))
                    if not frag.strip():
                        frag = escape(_html_to_plain(str(a.get("text") or raw_html or "")))
                    style = ParagraphStyle(
                        name=f"anno_{idx}_{id(a)}",
                        fontName="Helvetica",
                        fontSize=font_size,
                        leading=font_size * 1.25,
                        textColor=text_color,
                    )
                    try:
                        para = Paragraph(frag, style)
                    except Exception:
                        frag = escape(_html_to_plain(str(a.get("text") or raw_html or "")))
                        para = Paragraph(frag, style)
                    fw = max(1.0, w - 2 * padding)
                    fh = max(1.0, h - 2 * padding)
                    frame = Frame(
                        x + padding,
                        y + padding,
                        fw,
                        fh,
                        leftPadding=0,
                        rightPadding=0,
                        topPadding=0,
                        bottomPadding=0,
                        showBoundary=0,
                    )
                    try:
                        frame.addFromList([para], c)
                    except Exception:
                        plain = _html_to_plain(str(a.get("text") or raw_html or "")).replace("\n", " ")
                        c.setFillColor(text_color)
                        c.setFont("Helvetica", font_size)
                        c.drawString(x + padding, y + h - padding - font_size, plain[:2000])
                elif a_kind == "image":
                    b64 = a.get("src_base64")
                    if b64:
                        raw = base64.b64decode(b64)
                        img = ImageReader(BytesIO(raw))
                        c.drawImage(img, x, y, width=w, height=h, preserveAspectRatio=True, mask="auto")
                else:
                    # Formes : WYSIWYG — remplissage + contour optionnels (comme dans le renderer).
                    defs = DEFAULT_SHAPE_STYLES.get(a_kind, DEFAULT_SHAPE_STYLES["rect"])
                    fill_hex = a.get("fillColor") or defs["fillColor"]
                    fill_alpha = _num(
                        a.get("fillAlpha") if a.get("fillAlpha") is not None else defs["fillAlpha"],
                        defs["fillAlpha"],
                    )
                    stroke_hex = a.get("strokeColor")
                    if stroke_hex is None or str(stroke_hex).strip() == "":
                        stroke_hex = defs["strokeColor"]
                    stroke_w_px = _num(
                        a.get("strokeWidth") if a.get("strokeWidth") is not None else defs["strokeWidth"],
                        defs["strokeWidth"],
                    )
                    stroke_w_pt = max(0.0, stroke_w_px) * (sx + sy) / 2.0
                    stroke_alpha = max(0.0, min(1.0, _num(a.get("strokeAlpha"), 1.0)))

                    fill_c = _color(str(fill_hex))
                    stroke_c = _color(str(stroke_hex)) if stroke_w_px > 0 else None

                    do_fill = fill_c is not None and fill_alpha > 0.001
                    do_stroke = stroke_c is not None and stroke_w_px > 0.001 and stroke_alpha > 0.001

                    eff = max(0.0, min(1.0, _num(a.get("opacity"), 100.0) / 100.0))

                    bd_hex = a.get("backdropColor")
                    bd_alpha = _num(a.get("backdropAlpha"), 0.0)
                    if bd_hex and str(bd_hex).strip() and str(bd_hex).lower() not in ("transparent", "none"):
                        if bd_alpha > 0.001:
                            bd_c = _color(str(bd_hex))
                            if bd_c is not None:
                                c.setFillColor(bd_c)
                                try:
                                    c.setFillAlpha(min(1.0, eff * bd_alpha))
                                except Exception:
                                    pass
                                c.rect(x, y, w, h, stroke=0, fill=1)
                    if _dbg:
                        logger.info(
                            "export shape page=%s kind=%s raw_type=%r fill=%s fa=%s stroke_w=%s do_fill=%s do_stroke=%s",
                            idx,
                            a_kind,
                            raw_type,
                            fill_hex,
                            fill_alpha,
                            stroke_w_px,
                            do_fill,
                            do_stroke,
                        )
                    if do_fill:
                        c.setFillColor(fill_c)
                        try:
                            c.setFillAlpha(min(1.0, eff * fill_alpha))
                        except Exception:
                            pass
                    if do_stroke:
                        c.setStrokeColor(stroke_c)
                        try:
                            c.setStrokeAlpha(min(1.0, eff * stroke_alpha))
                        except Exception:
                            pass
                        c.setLineWidth(max(0.25, stroke_w_pt))

                    if a_kind == "rect":
                        c.rect(x, y, w, h, stroke=1 if do_stroke else 0, fill=1 if do_fill else 0)
                    elif a_kind == "ellipse":
                        c.ellipse(x, y, x + w, y + h, stroke=1 if do_stroke else 0, fill=1 if do_fill else 0)
                    elif a_kind == "line":
                        if do_stroke and stroke_c is not None:
                            sw = max(0.25, stroke_w_pt if stroke_w_pt > 0 else 1.5 * (sx + sy) / 2.0)
                            c.setLineWidth(sw)
                            c.setStrokeColor(stroke_c)
                            try:
                                c.setStrokeAlpha(min(1.0, eff * stroke_alpha))
                            except Exception:
                                pass
                            cy = y + h - sw / 2.0
                            c.line(x, cy, x + w, cy)
                    else:
                        pct = SHAPE_PCT.get(a_kind)
                        if pct:
                            path = _poly_path(c, x, y, w, h, pct)
                            if path is not None and (do_fill or do_stroke):
                                c.drawPath(
                                    path,
                                    stroke=1 if do_stroke else 0,
                                    fill=1 if do_fill else 0,
                                )
                        elif do_stroke or do_fill:
                            c.rect(x, y, w, h, stroke=1 if do_stroke else 0, fill=1 if do_fill else 0)

                c.restoreState()
            except Exception as exc:
                logger.warning(
                    "annotation skip page=%s type=%r err=%s",
                    idx,
                    a.get("type"),
                    exc,
                    exc_info=True,
                )
                try:
                    c.restoreState()
                except Exception:
                    pass

        c.showPage()
        c.save()
        buf.seek(0)

        overlay = PdfReader(buf)
        try:
            page.merge_page(overlay.pages[0])
        except Exception:
            # fallback older pypdf
            page.merge_page(overlay.pages[0])
        writer.add_page(page)

    _atomic_write_pdf(writer, output_path)
    return output_path

def merge_pdfs(inputs: Iterable[str], output_path: str) -> str:
    PdfReader, PdfWriter = _require_pypdf()
    writer = PdfWriter()
    for pdf in inputs:
        reader = PdfReader(pdf)
        for page in reader.pages:
            writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path


def split_pdf(input_path: str, from_page: int, to_page: int, output_path: str) -> str:
    PdfReader, PdfWriter = _require_pypdf()
    reader = PdfReader(input_path)
    writer = PdfWriter()
    max_page = len(reader.pages)
    start = max(1, from_page)
    end = min(max_page, to_page)
    if start > end:
        raise RuntimeError("Intervalle de pages invalide.")
    for idx in range(start - 1, end):
        writer.add_page(reader.pages[idx])
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path


def _assert_output_in_same_directory_as_input(input_path: str, output_path: str) -> None:
    """Empêche l'écriture hors du dossier du PDF source (surcharge HTTP / IPC mal formée)."""
    in_dir = os.path.normcase(os.path.dirname(os.path.abspath(input_path)))
    out_dir = os.path.normcase(os.path.dirname(os.path.abspath(output_path)))
    if in_dir != out_dir:
        raise RuntimeError("Chemin de sortie non autorise (hors du dossier source).")


def split_pdf_groups(input_path: str, groups: list[dict]) -> list[str]:
    """
    Exporte plusieurs PDF depuis un même source : chaque entrée contient
    output_path et page_indices (numéros de page 1-based, dans l'ordre souhaité).
    Les groupes sans pages ou chemins vides sont ignorés.
    """
    PdfReader, PdfWriter = _require_pypdf()
    reader = PdfReader(input_path)
    max_page = len(reader.pages)
    outputs: list[str] = []
    for g in groups:
        out_path = (g.get("output_path") or "").strip()
        indices = g.get("page_indices") or []
        if not out_path or not indices:
            continue
        _assert_output_in_same_directory_as_input(input_path, out_path)
        writer = PdfWriter()
        for p in indices:
            idx = int(p) - 1
            if 0 <= idx < max_page:
                writer.add_page(reader.pages[idx])
        if len(writer.pages) == 0:
            continue
        with open(out_path, "wb") as f:
            writer.write(f)
        outputs.append(out_path)
    return outputs


def compress_pdf(input_path: str, output_path: str) -> str:
    PdfReader, PdfWriter = _require_pypdf()
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    if os.path.getsize(output_path) == 0:
        raise RuntimeError("Compression invalide: fichier de sortie vide.")
    return output_path


def protect_pdf(input_path: str, output_path: str, password: str) -> str:
    if not password:
        raise RuntimeError("Mot de passe requis.")
    PdfReader, PdfWriter = _require_pypdf()
    reader = PdfReader(input_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path


def unprotect_pdf(input_path: str, output_path: str, password: str) -> str:
    PdfReader, PdfWriter = _require_pypdf()
    reader = PdfReader(input_path)
    if reader.is_encrypted:
        if reader.decrypt(password or "") == 0:
            raise RuntimeError("Mot de passe invalide.")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path

