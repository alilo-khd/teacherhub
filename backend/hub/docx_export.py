"""DOCX export for Creator Studio documents (python-docx, RTL-aware)."""
import io

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from . import pdf as pdfdocs

BODY_FONT = "IBM Plex Sans Arabic"


def _rgb(hex_color):
    h = (hex_color or "#1F2A44").lstrip("#")[:6] or "1F2A44"
    return RGBColor.from_string(h)


def _set_rtl(par):
    """Mark a paragraph RTL (bidi) keeping OOXML pPr element order valid."""
    par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pPr = par._p.get_or_add_pPr()
    if pPr.find(qn("w:bidi")) is None:
        bidi = OxmlElement("w:bidi")
        later = ("w:spacing", "w:ind", "w:contextualSpacing", "w:jc",
                 "w:textDirection", "w:rPr", "w:sectPr")
        anchor = next((pPr.find(qn(t)) for t in later if pPr.find(qn(t)) is not None), None)
        if anchor is None:
            pPr.append(bidi)
        else:
            anchor.addprevious(bidi)


def _style_run(run, theme, size=11, bold=False, color=None, heading=False):
    font_name = pdfdocs.HEAD_FONTS.get(getattr(theme, "heading_font", ""), "Tajawal") if heading else BODY_FONT
    run.font.name = font_name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = _rgb(color or (theme.ink if theme else "#22304D"))
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rFonts.set(qn(attr), font_name)


def para(doc_or_cell, text, theme, size=11, bold=False, color=None, align="right", heading=False, space_after=4):
    p = doc_or_cell.add_paragraph()
    if align == "center":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == "left":
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    else:
        _set_rtl(p)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.35
    run = p.add_run(str(text or ""))
    _style_run(run, theme, size=size, bold=bold, color=color, heading=heading)
    return p


def _shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), (hex_color or "#F4F1EA").lstrip("#"))
    tcPr.append(shd)


def add_table(doc, headers, rows, theme, header_color=None):
    cols = max(1, len(headers) or (len(rows[0]) if rows else 1))
    table = doc.add_table(rows=1, cols=cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    if headers:
        for i, h in enumerate(headers):
            cell = table.rows[0].cells[i]
            cell.text = ""
            para(cell, h, theme, size=10, bold=True, color=theme.deep if theme else "#1F2A44")
            _shade(cell, theme.soft if theme else "#F4F1EA")
    for row in rows:
        cells = table.add_row().cells
        for i in range(cols):
            cells[i].text = ""
            para(cells[i], row[i] if i < len(row) else "", theme, size=10)
    doc.add_paragraph()
    return table


def build_docx(doc_model, theme):
    doc = Document()
    section = doc.sections[0]
    if doc_model.orientation == "landscape":
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width, section.page_height = Cm(29.7), Cm(21.0)
    else:
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    for attr in ("top_margin", "bottom_margin"):
        setattr(section, attr, Cm(1.5))
    section.left_margin = section.right_margin = Cm(1.4)
    footer = section.footer.paragraphs[0]
    footer.text = "TeacherHub — منصة الأستاذ"
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER

    deep = theme.deep if theme else "#1F2A44"
    accent = theme.accent2 if theme else "#8C6A15"
    blocks = doc_model.blocks or []
    answer_key, qno = [], 0
    for idx, b in enumerate(blocks):
        if b.get("hidden"):
            continue
        kind = b.get("type")
        if kind == "cover":
            para(doc, b.get("title") or doc_model.title, theme, size=28, bold=True, color=deep, align="center", heading=True, space_after=8)
            if b.get("subtitle"):
                para(doc, b["subtitle"], theme, size=16, bold=True, color=accent, align="center", heading=True)
            for line in (b.get("meta") or []):
                para(doc, line, theme, size=12, align="center")
            doc.add_page_break()
        elif kind == "heading":
            p = para(doc, b.get("text", ""), theme, size=15, bold=True, color=deep, heading=True, space_after=6)
            pPr = p._p.get_or_add_pPr()
            shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:fill"), (theme.soft if theme else "#F4F1EA").lstrip("#")); pPr.append(shd)
        elif kind == "text":
            for part in str(b.get("text") or "").split("\n"):
                if part.strip():
                    para(doc, part, theme, size=11.5)
        elif kind == "fields":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            rows = [(r[0], r[1] if len(r) > 1 else "") for r in (b.get("rows") or []) if r]
            if rows:
                t = doc.add_table(rows=0, cols=2); t.style = "Table Grid"
                for label, value in rows:
                    cells = t.add_row().cells
                    cells[0].text = ""; cells[1].text = ""
                    para(cells[0], label, theme, size=10.5, bold=True, color=deep); _shade(cells[0], theme.soft if theme else "#F4F1EA")
                    para(cells[1], value, theme, size=10.5)
                doc.add_paragraph()
        elif kind == "table":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            add_table(doc, b.get("headers") or [], b.get("rows") or [], theme)
        elif kind == "checklist":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            for item in (b.get("items") or []):
                para(doc, f"☐ {item}", theme, size=11.5)
        elif kind == "questions":
            if b.get("title"):
                para(doc, b["title"], theme, size=15, bold=True, color=deep, heading=True)
            for q in (b.get("questions") or []):
                qno += 1
                pts = f" ({q.get('points')} ن)" if q.get("points") not in (None, "") else ""
                para(doc, f"{qno}. {q.get('prompt', '')}{pts}", theme, size=11.5, bold=True, color=deep)
                opts = [o for o in (q.get("options") or []) if str(o).strip()]
                if opts:
                    para(doc, "   •  ".join(f"{chr(1571 + i) if i < 6 else i + 1}. {o}" for i, o in enumerate(opts)), theme, size=10.5)
                for _ in range(int(q.get("lines") or 0)):
                    para(doc, "________________________________________________________________", theme, size=9, color="#999999")
                if q.get("answer"):
                    answer_key.append((qno, q))
            if b.get("show_answers") and answer_key:
                para(doc, "مفتاح الإجابة / عناصر التصحيح", theme, size=14, bold=True, color=deep, heading=True)
                add_table(doc, ["#", "السؤال", "الإجابة"], [[str(n), str(q.get("prompt", ""))[:60], str(q.get("answer", ""))] for n, q in answer_key], theme)
                answer_key = []
        elif kind == "cards":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            cards = b.get("cards") or []
            if cards:
                t = doc.add_table(rows=0, cols=2); t.style = "Table Grid"
                hdr = t.add_row().cells
                for cell, label in zip(hdr, ["الوجه (السؤال / المصطلح)", "الظهر (الإجابة / التعريف)"]):
                    cell.text = ""; para(cell, label, theme, size=10, bold=True, color=deep); _shade(cell, theme.soft if theme else "#F4F1EA")
                for c in cards:
                    cells = t.add_row().cells
                    cells[0].text = ""; cells[1].text = ""
                    para(cells[0], c.get("front", ""), theme, size=11, bold=True, color=deep, align="center")
                    para(cells[1], c.get("back", ""), theme, size=11, align="center")
                doc.add_paragraph()
        elif kind == "certificates":
            names = b.get("names") or []
            for n_i, name in enumerate(names):
                para(doc, b.get("title") or "شهادة تقدير", theme, size=26, bold=True, color=deep, align="center", heading=True)
                para(doc, "تُمنح هذه الشهادة إلى", theme, size=13, align="center")
                para(doc, name, theme, size=22, bold=True, color=accent, align="center", heading=True)
                para(doc, b.get("text", ""), theme, size=12.5, align="center")
                para(doc, f"التاريخ: {b.get('date', '')}        الإمضاء: {b.get('signer', '')}", theme, size=11, align="center")
                if n_i < len(names) - 1:
                    doc.add_page_break()
        elif kind == "seating":
            if b.get("title"):
                para(doc, b["title"], theme, size=15, bold=True, color=deep, heading=True)
            para(doc, b.get("front") or "السبورة", theme, size=12, bold=True, color="#FFFFFF", align="center")
            rows_n, cols_n = max(1, int(b.get("rows") or 4)), max(1, int(b.get("cols") or 5))
            seats = list(b.get("seats") or [])
            t = doc.add_table(rows=0, cols=cols_n); t.style = "Table Grid"
            for r in range(rows_n):
                cells = t.add_row().cells
                for cidx in range(cols_n):
                    i = r * cols_n + cidx
                    cells[cidx].text = ""
                    para(cells[cidx], seats[i] if i < len(seats) else "·", theme, size=10.5, bold=True, align="center")
            doc.add_paragraph()
        elif kind == "idcards":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            cards = b.get("cards") or []
            if cards:
                t = doc.add_table(rows=0, cols=2); t.style = "Table Grid"
                for start in range(0, len(cards), 2):
                    cells = t.add_row().cells
                    for j, c in enumerate(cards[start:start + 2]):
                        cells[j].text = ""
                        para(cells[j], c.get("name", ""), theme, size=12, bold=True, color=deep, align="center")
                        para(cells[j], c.get("meta", ""), theme, size=10, align="center")
                        para(cells[j], c.get("footer", ""), theme, size=8.5, color=accent, align="center")
                doc.add_paragraph()
        elif kind == "labels":
            if b.get("title"):
                para(doc, b["title"], theme, size=14, bold=True, color=deep, heading=True)
            names = b.get("names") or []
            if names:
                t = doc.add_table(rows=0, cols=3); t.style = "Table Grid"
                for start in range(0, len(names), 3):
                    cells = t.add_row().cells
                    for j, name in enumerate(names[start:start + 3]):
                        cells[j].text = ""
                        para(cells[j], name, theme, size=12, bold=True, color=deep, align="center")
                        if b.get("subtitle"):
                            para(cells[j], b["subtitle"], theme, size=9, align="center")
                doc.add_paragraph()
        elif kind == "poster":
            para(doc, b.get("title", ""), theme, size=26, bold=True, color=deep, align="center", heading=True)
            if b.get("subtitle"):
                para(doc, b["subtitle"], theme, size=14, bold=True, color=accent, align="center")
            for line in str(b.get("text") or "").split("\n"):
                if line.strip():
                    para(doc, line, theme, size=13)
            if b.get("footer"):
                para(doc, b["footer"], theme, size=11, bold=True, color=accent, align="center")
        elif kind == "signatures":
            roles = b.get("roles") or []
            if roles:
                t = doc.add_table(rows=2, cols=len(roles)); t.style = "Table Grid"
                for i, role in enumerate(roles):
                    t.rows[0].cells[i].text = ""; t.rows[1].cells[i].text = ""
                    para(t.rows[0].cells[i], role, theme, size=10.5, bold=True, align="center")
                    para(t.rows[1].cells[i], "……………………", theme, size=10, align="center")
                doc.add_paragraph()
        elif kind == "pagebreak":
            doc.add_page_break()

    doc.core_properties.title = doc_model.title
    doc.core_properties.author = "TeacherHub"
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
