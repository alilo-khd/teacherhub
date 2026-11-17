"""Portable Creator Studio documents: JSON exchange + file imports.

The JSON format is intentionally small and stable so a teacher can back up a
visual document, move it between TeacherHub installations, or share it with a
colleague without sharing the whole SQLite database.
"""
import csv
import io
import json
import re
from copy import deepcopy

from .models import CustomDocument, Theme

FORMAT = "teacherhub-document"
VERSION = 1
MAX_BLOCKS = 500
MAX_FILE_BYTES = 15 * 1024 * 1024
ALLOWED_BLOCK_TYPES = {
    "cover", "heading", "text", "fields", "table", "checklist", "questions",
    "cards", "certificates", "seating", "labels", "idcards", "poster",
    "signatures", "pagebreak",
}


def clean_tags(value):
    if value in (None, ""):
        return []
    if isinstance(value, str):
        value = re.split(r"[,،\n]", value)
    if not isinstance(value, (list, tuple)):
        raise ValueError("الوسوم يجب أن تكون قائمة أو نصًا مفصولًا بفواصل.")
    cleaned = []
    for tag in value:
        text = str(tag).strip()[:40]
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= 12:
            break
    return cleaned


def validate_content(content):
    if not isinstance(content, dict):
        raise ValueError("محتوى الوثيقة يجب أن يكون كائن JSON.")
    blocks = content.get("blocks")
    if not isinstance(blocks, list):
        raise ValueError("محتوى الوثيقة لا يحتوي قائمة blocks صالحة.")
    if len(blocks) > MAX_BLOCKS:
        raise ValueError(f"عدد الكتل كبير جدًا (الحد {MAX_BLOCKS}).")
    for index, block in enumerate(blocks, 1):
        if not isinstance(block, dict):
            raise ValueError(f"الكتلة رقم {index} ليست كائنًا صالحًا.")
        if block.get("type") not in ALLOWED_BLOCK_TYPES:
            raise ValueError(f"نوع كتلة غير مدعوم في الكتلة رقم {index}: {block.get('type')}")
    return {"blocks": deepcopy(blocks)}


def export_payload(doc):
    return {
        "format": FORMAT,
        "version": VERSION,
        "document": {
            "title": doc.title,
            "kind": doc.kind,
            "orientation": doc.orientation,
            "theme_id": doc.theme_id,
            "theme_slug": doc.theme.slug if doc.theme else None,
            "theme_name": doc.theme.name_ar if doc.theme else None,
            "tags": clean_tags(doc.tags),
            "is_favorite": bool(doc.is_favorite),
            "is_archived": bool(doc.is_archived),
            "source_type": doc.source_type or "",
            "source_id": doc.source_id,
            "content": validate_content(doc.content or {}),
        },
    }


def document_kwargs_from_payload(payload):
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise ValueError("ملف JSON غير صالح.") from exc
    if not isinstance(payload, dict):
        raise ValueError("بيانات الوثيقة المستوردة غير صالحة.")
    if payload.get("format") not in (None, FORMAT):
        raise ValueError("هذا الملف ليس وثيقة TeacherHub مدعومة.")
    data = payload.get("document") if isinstance(payload.get("document"), dict) else payload

    title = str(data.get("title") or "وثيقة مستوردة").strip()[:200] or "وثيقة مستوردة"
    valid_kinds = {key for key, _label in CustomDocument.KINDS}
    kind = data.get("kind") if data.get("kind") in valid_kinds else "blank"
    orientation = "landscape" if data.get("orientation") == "landscape" else "portrait"

    theme = None
    if data.get("theme_slug"):
        theme = Theme.objects.filter(slug=str(data["theme_slug"])).first()
    if theme is None and data.get("theme_id"):
        try:
            theme = Theme.objects.filter(pk=int(data["theme_id"])).first()
        except (TypeError, ValueError):
            theme = None

    source_id = data.get("source_id")
    try:
        source_id = int(source_id) if source_id not in (None, "") else None
    except (TypeError, ValueError):
        source_id = None

    return {
        "title": title,
        "kind": kind,
        "orientation": orientation,
        "theme": theme,
        "tags": clean_tags(data.get("tags")),
        "is_favorite": bool(data.get("is_favorite")),
        # Imported documents start active even if the source copy was archived;
        # this makes an accidental archive easy to recover from a backup.
        "is_archived": False,
        "source_type": str(data.get("source_type") or "")[:30],
        "source_id": source_id,
        "content": validate_content(data.get("content") or {}),
    }


def _clean_text(text):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\u200f\u200e]", "", text)
    return text.strip()


def _looks_like_heading(line):
    line = line.strip()
    if not line or len(line) > 95:
        return False
    if line.endswith((":", "：")) and len(line.split()) <= 12:
        return True
    if re.match(r"^(المقدمة|الخاتمة|الهدف|الأهداف|التمهيد|النشاط|التقويم|الوضعية|المرحلة)\b", line):
        return True
    return False


def blocks_from_plain_text(text, markdown=False):
    """Convert text/Markdown into editable cover/heading/text/checklist/table blocks."""
    blocks = []
    paragraph = []
    checklist = []

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            blocks.append({"type": "text", "text": " ".join(paragraph).strip()})
            paragraph = []

    def flush_checklist():
        nonlocal checklist
        if checklist:
            blocks.append({"type": "checklist", "title": "", "items": checklist})
            checklist = []

    lines = _clean_text(text).split("\n")
    index = 0
    while index < len(lines):
        raw = lines[index]
        line = raw.strip()
        index += 1
        if not line:
            flush_paragraph(); flush_checklist(); continue

        # Markdown / pipe tables: a header plus at least one following row.
        if "|" in line and index < len(lines) and "|" in lines[index]:
            rows = []
            candidate = line
            while candidate and "|" in candidate:
                cells = [c.strip() for c in candidate.strip("|").split("|")]
                if cells and not all(re.fullmatch(r"[-: ]+", c or "-") for c in cells):
                    rows.append(cells)
                if index >= len(lines):
                    break
                candidate = lines[index].strip(); index += 1
            if len(rows) >= 2:
                flush_paragraph(); flush_checklist()
                width = max(len(r) for r in rows)
                rows = [r + [""] * (width - len(r)) for r in rows]
                blocks.append({"type": "table", "title": "", "headers": rows[0], "rows": rows[1:]})
                continue
            paragraph.append(line); continue

        heading_match = re.match(r"^#{1,6}\s+(.+)$", line) if markdown else None
        bullet_match = re.match(r"^[-*•]\s+(.+)$", line)
        if heading_match:
            flush_paragraph(); flush_checklist()
            blocks.append({"type": "heading", "text": heading_match.group(1).strip()})
        elif bullet_match:
            flush_paragraph(); checklist.append(bullet_match.group(1).strip())
        elif _looks_like_heading(line):
            flush_paragraph(); flush_checklist()
            blocks.append({"type": "heading", "text": line.rstrip(":：")})
        else:
            flush_checklist(); paragraph.append(line)
        if len(blocks) >= MAX_BLOCKS:
            break
    flush_paragraph(); flush_checklist()
    return blocks[:MAX_BLOCKS] or [{"type": "text", "text": "وثيقة مستوردة فارغة."}]


def blocks_from_csv(text):
    sample = _clean_text(text)
    try:
        dialect = csv.Sniffer().sniff(sample[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = []
    for row in csv.reader(io.StringIO(sample), dialect):
        cells = [str(c).strip() for c in row]
        if any(cells):
            rows.append(cells)
    if not rows:
        raise ValueError("ملف CSV لا يحتوي صفوفًا قابلة للاستيراد.")
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    return [{"type": "table", "title": "جدول مستورد من CSV", "headers": rows[0], "rows": rows[1:]}]


def blocks_from_docx(data):
    try:
        from docx import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError as exc:
        raise ValueError("حزمة قراءة DOCX غير متوفرة على الخادم.") from exc

    document = Document(io.BytesIO(data))
    blocks = []
    checklist = []

    def flush_checklist():
        nonlocal checklist
        if checklist:
            blocks.append({"type": "checklist", "title": "", "items": checklist})
            checklist = []

    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            paragraph = Paragraph(child, document)
            text = paragraph.text.strip()
            if not text:
                continue
            style = (paragraph.style.name or "") if paragraph.style else ""
            if style.startswith("Title") or style.startswith("Heading"):
                flush_checklist(); blocks.append({"type": "heading", "text": text})
            elif "List" in style or text.startswith(("•", "- ")):
                checklist.append(text.lstrip("•- ").strip())
            else:
                flush_checklist(); blocks.append({"type": "text", "text": text})
        elif child.tag.endswith("}tbl"):
            flush_checklist()
            table = Table(child, document)
            rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            rows = [r for r in rows if any(r)]
            if rows:
                width = max(len(r) for r in rows)
                rows = [r + [""] * (width - len(r)) for r in rows]
                blocks.append({"type": "table", "title": "", "headers": rows[0], "rows": rows[1:]})
        if len(blocks) >= MAX_BLOCKS:
            break
    flush_checklist()
    return blocks[:MAX_BLOCKS] or [{"type": "text", "text": "وثيقة DOCX مستوردة فارغة."}]


def blocks_from_pdf(data):
    try:
        import pymupdf
    except ImportError as exc:
        raise ValueError("حزمة قراءة PDF غير متوفرة على الخادم.") from exc

    try:
        pdf = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("تعذّرت قراءة ملف PDF.") from exc
    if pdf.page_count > 100:
        raise ValueError("ملف PDF كبير جدًا (الحد 100 صفحة).")

    blocks = []
    extracted_chars = 0
    for page_index, page in enumerate(pdf):
        if page_index:
            blocks.append({"type": "pagebreak"})
        page_dict = page.get_text("dict")
        visual_blocks = sorted(
            (b for b in page_dict.get("blocks", []) if b.get("type") == 0),
            key=lambda b: (round(b.get("bbox", [0, 0])[1]), round(b.get("bbox", [0, 0])[0])),
        )

        # The most common font size (weighted by characters) is the body size.
        # A modestly larger bold label is useful; merely larger body fragments
        # are not headings, so require a clear size jump or a short bold label.
        size_weights = {}
        prepared = []
        for visual_block in visual_blocks:
            lines = []
            max_size = 0.0
            bold_chars = 0
            total_chars = 0
            for line_data in visual_block.get("lines", []):
                spans = line_data.get("spans", [])
                line = "".join(span.get("text", "") for span in spans).strip()
                if not line:
                    continue
                lines.append(line)
                for span in spans:
                    size = float(span.get("size") or 0)
                    max_size = max(max_size, size)
                    size_weights[size] = size_weights.get(size, 0) + len(span.get("text", ""))
                    font = str(span.get("font") or "")
                    total_chars += len(span.get("text", ""))
                    if "bold" in font.lower() or (int(span.get("flags") or 0) & 16):
                        bold_chars += len(span.get("text", ""))
            if lines:
                is_bold = total_chars and bold_chars >= total_chars * 0.6
                prepared.append((" ".join(lines), max_size, is_bold))
        body_size = max(size_weights, key=size_weights.get) if size_weights else 0

        for block_text, max_size, is_bold in prepared:
            block_text = re.sub(r"\s+", " ", block_text).strip()
            if not block_text or re.fullmatch(r"\d{1,4}", block_text):
                continue
            extracted_chars += len(block_text)
            if extracted_chars > 500_000:
                raise ValueError("النص المستخرج من PDF كبير جدًا.")
            size_jump = body_size and max_size >= body_size * 1.22
            short_bold_label = is_bold and len(block_text) <= 120 and len(block_text.split()) <= 14
            if len(block_text) <= 140 and (size_jump or short_bold_label or _looks_like_heading(block_text)):
                blocks.append({"type": "heading", "text": block_text.rstrip(":：")})
            else:
                blocks.append({"type": "text", "text": block_text})
            if len(blocks) >= MAX_BLOCKS:
                blocks = blocks[:MAX_BLOCKS]
                break
        if len(blocks) >= MAX_BLOCKS:
            break
    if extracted_chars < 10:
        raise ValueError("لم يُعثر على نص قابل للتحرير داخل PDF؛ قد يكون ملفًا ممسوحًا ضوئيًا ويحتاج OCR.")
    return blocks


def _decode_text(data):
    for encoding in ("utf-8-sig", "utf-16", "cp1256"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def extract_uploaded_file(filename, data):
    """Return (title, blocks, kind) for an uploaded editable-document source."""
    if not data:
        raise ValueError("الملف فارغ.")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("حجم الملف أكبر من 15MB.")
    safe_name = str(filename or "وثيقة مستوردة")
    title = re.sub(r"\.[^.]+$", "", safe_name).strip() or "وثيقة مستوردة"
    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""

    if ext == "json":
        payload = json.loads(_decode_text(data))
        kwargs = document_kwargs_from_payload(payload)
        return kwargs["title"], kwargs["content"]["blocks"], kwargs["kind"], kwargs
    if ext in ("txt", "md", "markdown"):
        return title, blocks_from_plain_text(_decode_text(data), markdown=ext in ("md", "markdown")), "blank", None
    if ext == "csv":
        return title, blocks_from_csv(_decode_text(data)), "blank", None
    if ext == "docx":
        return title, blocks_from_docx(data), "blank", None
    if ext == "pdf":
        return f"نسخة قابلة للتحرير — {title}", blocks_from_pdf(data), "editable-copy", None
    raise ValueError("نوع الملف غير مدعوم؛ استخدم PDF أو DOCX أو TXT أو Markdown أو CSV أو JSON.")
