"""Print-ready PDF exports (WeasyPrint, Arabic RTL, themed).

Every document the studio produces on screen can be exported as an A4 PDF
styled with the same theme identity used across the app, ready to print:
teacher journal, inspector journal, grade book, lesson plan, course handout,
class progress report, session log, notebook, observation grid, timetable.
"""
import datetime
from django.http import HttpResponse
from django.utils.text import slugify

FONTS_DIR = "/home/user/work/informatics-journal/fonts"
FONT_FACES = """
@font-face { font-family:'Tajawal'; src:url('file://%(d)s/Tajawal-Regular.ttf'); }
@font-face { font-family:'Tajawal'; src:url('file://%(d)s/Tajawal-Bold.ttf'); font-weight:700; }
@font-face { font-family:'Tajawal'; src:url('file://%(d)s/Tajawal-Black.ttf'); font-weight:900; }
@font-face { font-family:'IBM Plex Sans Arabic'; src:url('file://%(d)s/IBMPlexSansArabic-Regular.ttf'); }
@font-face { font-family:'IBM Plex Sans Arabic'; src:url('file://%(d)s/IBMPlexSansArabic-Bold.ttf'); font-weight:700; }
@font-face { font-family:'Amiri'; src:url('file://%(d)s/Amiri-Regular.ttf'); }
@font-face { font-family:'Amiri'; src:url('file://%(d)s/Amiri-Bold.ttf'); font-weight:700; }
@font-face { font-family:'Scheherazade New'; src:url('file://%(d)s/ScheherazadeNew-Regular.ttf'); }
@font-face { font-family:'Aref Ruqaa'; src:url('file://%(d)s/ArefRuqaa-Regular.ttf'); }
@font-face { font-family:'Lalezar'; src:url('file://%(d)s/Lalezar-Regular.ttf'); }
""" % {"d": FONTS_DIR}

HEAD_FONTS = {
    "Tajawal": "Tajawal", "IBM Plex Sans Arabic": "IBM Plex Sans Arabic",
    "Amiri": "Amiri", "الأميري": "Amiri", "شهرزاد": "Scheherazade New",
    "Scheherazade New": "Scheherazade New", "الرقعة": "Aref Ruqaa",
    "Aref Ruqaa": "Aref Ruqaa", "Lalezar": "Lalezar", "لاليزار": "Lalezar",
}


def esc(x):
    return (str(x if x is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def fmt(n):
    if n is None:
        return "—"
    return f"{n:.2f}".rstrip("0").rstrip(".") if isinstance(n, float) else str(n)


BASE_CSS = """
@page {
  size: A4 %(orient)s; margin: 17mm 14mm 18mm 14mm; background: %(paper)s %(patimg)s;
  @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font-family:'IBM Plex Sans Arabic'; font-size:8pt; color:#8a8f7a; }
}
* { box-sizing: border-box; }
body { direction: rtl; font-family:'IBM Plex Sans Arabic', sans-serif; color:%(ink)s; font-size:10.5pt; line-height:1.75; background: %(paper)s %(patimg)s; }
h1,h2,h3,.hfont { font-family:'%(hfont)s','IBM Plex Sans Arabic'; }
.cover { text-align:center; padding-top:26mm; page-break-after: always; }
.cover-frame { border:2.2pt solid %(deep)s; border-radius:6mm; padding:20mm 10mm 16mm; background:%(soft2)s; }
.cover-bold .cover-frame { background: linear-gradient(160deg, %(deep)s, %(deeper)s); border-color: %(accent)s; }
.cover-bold .cover-title, .cover-bold .cover-name { color:#ffffff; }
.cover-bold .cover-sub, .cover-bold .cover-meta { color:#ffffff; opacity:.94; }
.cover-bold .cover-en { color: %(accent)s; }
.cover-minimal .cover-frame { border:none; border-top:3pt solid %(accent)s; border-bottom:0.8pt solid %(line)s; border-radius:0; background:transparent; }
.cover-img-top { display:block; margin:0 auto 8mm; max-width:82%%; max-height:58mm; border-radius:4mm; }
.cover-side-wrap { display:flex; gap:7mm; align-items:center; text-align:right; }
.cover-img-side { width:52mm; max-height:64mm; border-radius:4mm; flex:none; }
.cover-side-text { flex:1; text-align:center; }
.cover-motto { font-size:12.5pt; color:%(accent)s; margin-top:2mm; font-weight:700; }
.cover-en { letter-spacing:5px; font-size:8.5pt; color:%(accent2)s; font-weight:700; direction:ltr; }
.cover-title { font-size:30pt; font-weight:900; color:%(deep)s; margin:4mm 0 1mm; }
.cover-sub { font-size:14pt; color:%(ink)s; font-weight:700; }
.cover-name { font-size:16pt; font-weight:800; color:%(deep)s; margin-top:8mm; }
.cover-meta { margin-top:6mm; line-height:2.1; color:%(ink)s; }
.cover-rule { color:%(accent)s; font-size:14pt; margin:3mm 0; }
.band {
  background: linear-gradient(90deg, %(deep)s, %(deeper)s);
  color:#fff; font-weight:800; padding:2.2mm 4mm; border-radius:2mm; margin:7mm 0 3.5mm;
  font-family:'%(hfont)s'; font-size:12.5pt; page-break-after: avoid;
}
.band:first-of-type { margin-top: 0; }
table { width:100%%; border-collapse:collapse; margin-bottom:4mm; font-size:9.5pt; }
th { background:%(soft)s; color:%(deep)s; border:0.6pt solid %(line)s; padding:1.8mm 2mm; font-weight:800; }
td { border:0.6pt solid %(line)s; padding:1.6mm 2mm; vertical-align:top; }
tr:nth-child(even) td { background:%(soft2)s; }
.fields td:first-child { background:%(soft)s; color:%(deep)s; font-weight:800; width:28%%; }
.kv { display:flex; gap:4mm; flex-wrap:wrap; margin-bottom:3mm; }
.chip { background:%(soft)s; border:0.6pt solid %(line)s; border-radius:99px; padding:0.6mm 3mm; font-size:9pt; }
.chip b { color:%(deep)s; }
.small { font-size:9pt; color:%(ink)s; opacity:.75; }
.page-break { page-break-before: always; }
.sign { margin-top:12mm; display:flex; justify-content:space-between; }
.sign div { text-align:center; width:45%%; }
.sign .line { border-top:0.7pt solid %(line)s; margin-top:14mm; padding-top:1.5mm; font-size:9pt; }
.check li { margin-bottom:1.5mm; }
.footer-note { margin-top:8mm; font-size:8.5pt; text-align:center; color:%(accent2)s; letter-spacing:1px; }

/* ---- Creator Studio blocks ---- */
.q-block { border:0.7pt solid %(line)s; border-radius:2.5mm; padding:3mm 4mm; margin-bottom:3.5mm; page-break-inside: avoid; background:%(soft2)s; }
.q-head { font-weight:800; color:%(deep)s; }
.q-points { float:left; background:%(soft)s; border:0.6pt solid %(line)s; border-radius:99px; padding:0 2.5mm; font-size:8pt; }
.q-options { margin:1.5mm 0 0; }
.q-options span { display:inline-block; border:0.6pt solid %(line)s; border-radius:99px; padding:0.4mm 2.6mm; margin:0 0 1.5mm 1.5mm; font-size:9pt; background:#fff; }
.write-lines div { border-bottom:0.6pt dotted %(line)s; height:7mm; }
.answer-key { background:%(soft)s; border:0.7pt solid %(accent)s; border-radius:2.5mm; padding:3mm 4mm; }
.cards-grid { }
.flash-card { border:0.9pt dashed %(accent2)s; border-radius:3mm; padding:4mm; margin-bottom:4mm; page-break-inside: avoid; background:%(soft2)s; }
.flash-front { font-weight:900; color:%(deep)s; font-size:12pt; text-align:center; }
.flash-back { text-align:center; margin-top:2mm; }
.cert { border:2.4pt solid %(deep)s; border-radius:5mm; padding:16mm 10mm; text-align:center; page-break-after: always; background:%(soft2)s; margin-bottom:8mm; }
.cert-title { font-size:22pt; font-weight:900; color:%(deep)s; font-family:'%(hfont)s'; }
.cert-name { font-size:19pt; font-weight:900; color:%(accent2)s; margin:7mm 0 4mm; border-bottom:0.7pt solid %(line)s; padding-bottom:3mm; }
.seat-front { text-align:center; background:%(deep)s; color:#fff; border-radius:2mm; padding:2mm; font-weight:800; margin-bottom:4mm; }
.seat-table td { height:14mm; text-align:center; font-weight:700; background:%(soft2)s; }
.label-card { border:0.8pt solid %(line)s; border-radius:3mm; padding:4mm 3mm; text-align:center; margin-bottom:3.5mm; page-break-inside: avoid; background:#fff; }
.label-name { font-weight:900; color:%(deep)s; font-size:12pt; }
.poster-box { border:2.2pt solid %(deep)s; border-radius:6mm; padding:14mm 9mm; text-align:center; background:%(soft2)s; }
.poster-title { font-size:24pt; font-weight:900; color:%(deep)s; font-family:'%(hfont)s'; }
.poster-sub { color:%(accent2)s; font-weight:800; margin-bottom:6mm; }
.poster-text { text-align:right; line-height:2.1; font-size:12pt; }
.id-card { border:1pt solid %(line)s; border-right:4pt solid %(deep)s; border-radius:3mm; padding:4mm 5mm; margin-bottom:3.5mm; page-break-inside: avoid; background:%(soft2)s; }
.id-card-name { font-weight:900; color:%(deep)s; font-size:13pt; }
.id-card-meta { font-weight:700; }
.id-card-footer { font-size:8.5pt; color:%(accent2)s; }
.num { font-variant-numeric: tabular-nums; }
"""


PATTERN_SVGS = {
    "dots": "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='3' cy='3' r='1.7' fill='{c}' fill-opacity='0.55'/></svg>",
    "grid": "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M26 0H0V26' fill='none' stroke='{c}' stroke-opacity='0.5'/></svg>",
    "diagonal": "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M0 26L26 0' stroke='{c}' stroke-opacity='0.45'/></svg>",
    "waves": "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M0 13 Q6.5 5 13 13 T26 13' fill='none' stroke='{c}' stroke-opacity='0.45'/></svg>",
    "diamonds": "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M13 2 L24 13 L13 24 L2 13 Z' fill='none' stroke='{c}' stroke-opacity='0.45'/></svg>",
}


def _pattern_img(theme):
    if not theme or getattr(theme, "pattern", "none") in (None, "", "none"):
        return ""
    svg = PATTERN_SVGS.get(theme.pattern)
    if not svg:
        return ""
    from urllib.parse import quote as _quote
    return 'url("data:image/svg+xml,' + _quote(svg.format(c=theme.line), safe="") + '")'


def style_for(theme, orientation="portrait"):
    hfont = HEAD_FONTS.get(getattr(theme, "heading_font", ""), "Tajawal") if theme else "Tajawal"
    vals = {
        "orient": "landscape" if orientation == "landscape" else "",
        "deep": theme.deep if theme else "#1F2A44",
        "deeper": theme.deeper if theme else "#131B2E",
        "ink": theme.ink if theme else "#22304D",
        "accent": theme.accent if theme else "#C9A227",
        "accent2": theme.accent2 if theme else "#8C6A15",
        "soft": theme.soft if theme else "#F4F1EA",
        "soft2": theme.soft2 if theme else "#FBF9F4",
        "line": theme.line if theme else "#DAD5C5",
        "paper": theme.paper if theme else "#FFFFFF",
        "patimg": _pattern_img(theme),
        "hfont": hfont,
    }
    return FONT_FACES + BASE_CSS % vals


def html_doc(theme, title, body, orientation="portrait"):
    return (f"<html lang='ar' dir='rtl'><head><meta charset='utf-8'>"
            f"<title>{esc(title)}</title><style>{style_for(theme, orientation)}</style></head>"
            f"<body>{body}</body></html>")


def pdf_response(theme, title, body, filename, orientation="portrait"):
    from weasyprint import HTML
    html = html_doc(theme, title, body, orientation)
    data = HTML(string=html).write_pdf()
    resp = HttpResponse(data, content_type="application/pdf")
    from urllib.parse import quote
    ascii_name = slugify(filename) or "document"
    resp["Content-Disposition"] = (
        f'attachment; filename="{ascii_name}.pdf"; '
        f"filename*=UTF-8''{quote(filename + '.pdf')}")
    return resp


def cover(theme, en, title, name, meta_lines, sub="", cover_config=None):
    config = cover_config or {}
    meta = "".join(f"<div>{esc(m)}</div>" for m in meta_lines if m)
    cover_style = getattr(theme, "cover_style", "classic") if theme else "classic"
    image = config.get("image") or ""
    if not (isinstance(image, str) and image.startswith("data:image/") and len(image) < 900_000):
        image = ""
    layout = config.get("layout") if image else "none"
    display_title = config.get("title_override") or title
    motto = config.get("motto") or ""
    inner = (f"<div class='cover-en'>{esc(en)}</div>"
             f"<div class='cover-title hfont'>{esc(display_title)}</div>"
             f"<div class='cover-rule'>— ◆ —</div>"
             + (f"<div class='cover-sub'>{esc(sub)}</div>" if sub else "")
             + (f"<div class='cover-motto hfont'>{esc(motto)}</div>" if motto else "")
             + f"<div class='cover-name'>{esc(name)}</div>"
             f"<div class='cover-meta'>{meta}</div>"
             f"<div class='footer-note'>منصة الأستاذ — TeacherHub • {esc(theme.name_ar) if theme else ''}</div>")
    if layout == "top":
        inner = f"<img class='cover-img-top' src='{image}' />" + inner
        return f"<div class='cover cover-{esc(cover_style)}'><div class='cover-frame'>{inner}</div></div>"
    if layout == "side":
        return (f"<div class='cover cover-{esc(cover_style)}'><div class='cover-frame'>"
                f"<div class='cover-side-wrap'><img class='cover-img-side' src='{image}' />"
                f"<div class='cover-side-text'>{inner}</div></div></div></div>")
    if layout == "full":
        frame_style = (f"background: linear-gradient(rgba(255,255,255,0.84), rgba(255,255,255,0.84)), "
                       f"url('{image}') center / cover no-repeat;")
        return '<div class="cover cover-' + esc(cover_style) + '"><div class="cover-frame" style="' + frame_style + '">' + inner + "</div></div>"
    return (f"<div class='cover cover-{esc(cover_style)}'><div class='cover-frame'>"
            + inner + "</div></div>")


def band(text):
    return f"<div class='band'>{esc(text)}</div>"


def table(headers, rows, cls=""):
    head = "".join(f"<th>{esc(h)}</th>" for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f"<table class='{cls}'><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def fields(rows):
    body = "".join(f"<tr><td>{esc(k)}</td><td>{esc(v)}</td></tr>" for k, v in rows if v)
    return f"<table class='fields'>{body}</table>"


def profile_fields(p, user):
    if not p:
        name = f"{user.first_name} {user.last_name}".strip() or user.username
        return [("الأستاذ(ة)", name)]
    return [
        ("الاسم الكامل", p.full_name or f"{user.first_name} {user.last_name}"),
        ("تاريخ ومكان الازدياد", f"{p.birth_date or ''} {p.birth_place}".strip()),
        ("الحالة العائلية", p.marital_status), ("العنوان", p.address), ("الهاتف", p.phone),
        ("الوظيفة", p.job_title), ("التخصص", p.specialty), ("الشهادة", p.diploma),
        ("تاريخ التوظيف", str(p.hire_date or "")), ("المؤسسة الحالية", p.current_school),
        ("مقاطعة التفتيش", p.inspection_district), ("الدرجة / الصنف", p.echelon),
    ]


def weekly_grid(slots):
    """slots: iterable of TimetableSlot → weekday rows × classes."""
    from .models import WEEKDAY_NAMES
    rows = []
    for wd in range(7):
        day_slots = [s for s in slots if s.weekday == wd]
        if not day_slots:
            continue
        txt = "<br>".join(
            f"{esc(s.school_class.name)} — {str(s.start_time)[:5]} • {esc(s.room)}"
            for s in sorted(day_slots, key=lambda s: s.start_time))
        rows.append([esc(WEEKDAY_NAMES[wd]), txt])
    return table(["اليوم", "الحصص"], rows) if rows else "<p class='small'>لا مواعيد مسجلة.</p>"


DEFAULT_CRITERIA = [
    "إعداد الدرس وتخطيطه", "تقديم الدرس ووضعية الانطلاق", "بناء التعلمات ونشاط الأستاذ",
    "نشاط المتعلمين وتفاعلهم", "استعمال الوسائل التعليمية", "التقويم وتصحيح التعلمات",
    "إدارة القسم والزمن", "اللغة والتواصل", "التعزيز والتغذية الراجعة", "غلق الدرس والواجب",
]


def criteria_table(criteria):
    rows = []
    for i, c in enumerate(criteria, 1):
        if isinstance(c, dict):
            rows.append([str(i), esc(c.get("label", "")), fmt(c.get("max", 4)), fmt(c.get("score"))])
        else:
            rows.append([str(i), esc(c), "4", ""])
    t = table(["#", "عنصر الملاحظة", "العلامة القصوى", "العلامة"], rows)
    return t


from .models import (Session, Course, TimetableSlot, WEEKDAY_NAMES)
from .serializers import class_progress


def holidays_table(holidays):
    rows = [[esc(h.name), str(h.start_date), str(h.end_date), str((h.end_date - h.start_date).days + 1), esc(h.kind)] for h in holidays]
    return table(["العطلة / المناسبة", "من", "إلى", "الأيام", "النوع"], rows) if rows else "<p class='small'>لا عطل مسجلة.</p>"


def seminars_table(seminars):
    rows = [[str(s.date), esc(s.title), esc(s.kind), esc(s.place), esc(s.organizer)] for s in seminars]
    return table(["التاريخ", "العنوان", "النوع", "المكان", "الجهة المنظمة"], rows) if rows else "<p class='small'>لا ندوات مسجلة.</p>"


def sessions_table(sessions):
    rows = []
    for s in sessions:
        pts = "، ".join(esc(p_) for p_ in (s.points_written or [])[:4])
        rows.append([str(s.date), esc(s.school_class.name), esc(s.course.title if s.course else "—"),
                     pts or "—", esc(s.homework or "—"), str(s.absentees)])
    return table(["التاريخ", "الفوج", "الدرس", "النقاط المكتوبة", "الواجب", "الغائبون"], rows) if rows else "<p class='small'>لا حصص مسجلة.</p>"


def _notes_chunk(rows_count, title="ملاحظات"):
    try:
        count = int(rows_count)
    except (TypeError, ValueError):
        count = 12
    count = max(0, min(40, count))
    return band(title) + table(["التاريخ", "الملاحظة"], [["", ""] for _ in range(count)])


def _compose_sections(chunks, order):
    """Join section chunks in the requested order, one section per page."""
    keys = [key for key in order if key in chunks]
    if "cover" in keys:
        keys.remove("cover")
        keys.insert(0, "cover")
    parts = []
    for index, key in enumerate(keys):
        parts.append(chunks[key] if index == 0 else "<div class='page-break'></div>" + chunks[key])
    return "".join(parts)


def journal_doc(journal, theme, profile, user, holidays, seminars, slots, sessions=None,
                classes_rows=None, term_rows=None):
    if sessions is None:
        sessions = list(journal.sessions.select_related("school_class", "course").all())
    config = getattr(journal, "page_config", None) or {}
    cover_config = getattr(journal, "cover_config", None) or {}
    journal_meta = []
    if cover_config.get("show_institution", True) and journal.institution:
        journal_meta.append(f"المؤسسة: {journal.institution}")
    if cover_config.get("show_year", True):
        journal_meta.append(f"السنة الدراسية: {journal.school_year}")
    if cover_config.get("show_teacher", True):
        journal_meta.append(f"الأستاذ(ة): {journal.teacher_name or (profile.full_name if profile else '')}")
    cover_chunk = cover(theme, "DAILY JOURNAL OF INFORMATICS", "الدفتر اليومي",
                 journal.title or (profile.full_name if profile else ""),
                 journal_meta,
                 sub="مادة الإعلام الآلي", cover_config=cover_config)
    chunks = {
        "cover": cover_chunk,
        "profile_card": band("بطاقة الحالة الشخصية والمهنية") + fields(profile_fields(profile, user)),
        "holidays": band("العطل المدرسية والمناسبات") + holidays_table(holidays),
        "seminars": band("الندوات والملتقيات والأيام التكوينية") + seminars_table(seminars),
        "weekly_schedule": band("برنامج العمل الأسبوعي") + weekly_grid(slots),
        "sessions_log": band("سجلّ الحصص المنفَّذة (دفتر الأستاذ)") + sessions_table(sessions),
        "classes_progress": band("الأفواج وتقدّم المقرر في الإعلام الآلي") + (
            table(["الفوج", "المستوى", "التلاميذ", "تقدّم المقرر", "الدرس الموالي"], classes_rows) if classes_rows else "<p class='small'>لا أفواج مسجلة.</p>"),
        "term_summary": band("ملخص نتائج الأفواج") + (
            table(["الفوج", "الثلاثي الأول", "الثلاثي الثاني", "الثلاثي الثالث", "المعدل السنوي"], term_rows) if term_rows else "<p class='small'>لا نتائج مسجلة.</p>"),
        "notes": _notes_chunk(config.get("notes_rows", 12)),
    }
    if config.get("sections"):
        return _compose_sections(chunks, list(config["sections"]))
    body = chunks["cover"] + chunks["profile_card"]
    body += "<div class='page-break'></div>" + chunks["holidays"] + chunks["seminars"]
    body += "<div class='page-break'></div>" + chunks["weekly_schedule"]
    body += "<div class='page-break'></div>" + chunks["sessions_log"]
    body += "<div class='page-break'></div>" + chunks["notes"]
    return body


def inspector_doc(theme, profile, user, holidays, seminars, slots, institutions, visits, observations, classes, config=None, cover_config=None):
    config = config or {}
    cover_config = cover_config or {}
    inst_rows = [[esc(i.name), esc(i.kind), esc(i.commune), esc(i.director), str(i.teachers_count)] for i in institutions]
    follow_rows = []
    for i in institutions:
        last = i.visits.order_by("-date").first()
        follow_rows.append([esc(i.name), esc(i.director), str(last.date) if last else "—", esc(last.visit_type) if last else "—"])
    inspector_meta = []
    if profile and profile.inspection_district:
        inspector_meta.append(f"مقاطعة التفتيش: {profile.inspection_district}")
    if cover_config.get("show_institution", True) and profile and profile.current_school:
        inspector_meta.append(f"المؤسسة: {profile.current_school}")
    if profile:
        inspector_meta.append(f"التخصص: {profile.specialty}")
    cover_chunk = cover(theme, "INSPECTOR'S JOURNAL", "دفتر المفتش",
                 profile.full_name if profile and profile.full_name else f"{user.first_name} {user.last_name}",
                 inspector_meta,
                 sub="مادة الإعلام الآلي", cover_config=cover_config)
    vrows = [[str(v.date), esc(v.institution.name if v.institution else "—"), esc(v.visit_type),
              esc(v.teacher_visited), esc(v.observations[:90])] for v in visits]
    obs = observations[0] if observations else None
    observation_chunk = band("شبكة ملاحظة الحصة وتقييمها")
    if obs:
        observation_chunk += fields([("الأستاذ(ة)", obs.teacher_name), ("المؤسسة", obs.institution.name if obs.institution else ""),
                        ("القسم", obs.class_name), ("الدرس", obs.course.title if obs.course else ""),
                        ("التاريخ", str(obs.date)), ("التقدير", f"{obs.percent}٪ — {obs.appreciation}")])
    observation_chunk += criteria_table(obs.criteria if obs and obs.criteria else DEFAULT_CRITERIA)
    chunks = {
        "cover": cover_chunk,
        "profile_card": band("بطاقة الحالة الشخصية والمهنية") + fields(profile_fields(profile, user)),
        "institutions": band("مؤسسات مقاطعة التفتيش") + (table(["المؤسسة", "النوع", "البلدية", "المدير", "الأساتذة"], inst_rows) if inst_rows else "<p class='small'>لا مؤسسات مسجلة.</p>"),
        "holidays": band("العطل المدرسية والمناسبات") + holidays_table(holidays),
        "seminars": band("الندوات والملتقيات") + seminars_table(seminars),
        "weekly_schedule": band("برنامج العمل الأسبوعي") + weekly_grid(slots),
        "visits": band("سجلّ الزيارات التفتيشية") + (table(["التاريخ", "المؤسسة", "النوع", "الأستاذ المُزار", "ملاحظات"], vrows) if vrows else "<p class='small'>لا زيارات مسجلة.</p>"),
        "observation": observation_chunk,
        "follow_up": band("سجلّ متابعة الأساتذة والمؤسسات") + (table(["المؤسسة", "المدير", "آخر زيارة", "نوعها"], follow_rows) if follow_rows else "<p class='small'>لا مؤسسات للمتابعة.</p>"),
        "notes": _notes_chunk(config.get("notes_rows", 10)),
    }
    if config.get("sections"):
        return _compose_sections(chunks, list(config["sections"]))
    body = chunks["cover"] + chunks["profile_card"]
    body += "<div class='page-break'></div>" + chunks["institutions"] + chunks["holidays"] + chunks["seminars"]
    body += "<div class='page-break'></div>" + chunks["weekly_schedule"]
    body += "<div class='page-break'></div>" + chunks["visits"]
    body += "<div class='page-break'></div>" + chunks["observation"]
    body += "<div class='page-break'></div>" + chunks["follow_up"] + chunks["notes"]
    return body


def term_avg(students, term):
    vals = []
    for st in students:
        m = next((x for x in st.marks.all() if x.term == term), None)
        if m and m.average is not None:
            vals.append(m.average)
    return round(sum(vals) / len(vals), 2) if vals else None


def student_annual(st):
    avgs = [m.average for m in st.marks.all() if m.average is not None]
    return round(sum(avgs) / len(avgs), 2) if avgs else None


def gradebook_doc(cls, theme, profile, user, term=None, sort="name"):
    students = list(cls.students.prefetch_related("marks").all())
    def _term_avg(st):
        m = next((x for x in st.marks.all() if x.term == term), None)
        return m.average if m else None
    def _sort_value(st):
        # When a single term is printed, rank by that term; otherwise by annual average.
        return _term_avg(st) if term in (1, 2, 3) else student_annual(st)
    if sort in ("average_desc", "annual_desc"):
        students.sort(key=lambda st: (_sort_value(st) is None, -(_sort_value(st) or 0), st.full_name))
    elif sort in ("average_asc", "annual_asc"):
        students.sort(key=lambda st: (_sort_value(st) is None, _sort_value(st) or 0, st.full_name))
    else:
        students.sort(key=lambda st: st.full_name)
    body = cover(theme, "GRADE BOOK", "دفتر التنقيط", cls.name,
                 [f"المستوى: {cls.level}", f"عدد التلاميذ: {cls.students_count or len(students)}",
                  f"الأستاذ(ة): {profile.full_name if profile and profile.full_name else user.first_name}"],
                 sub="مادة الإعلام الآلي")
    body += band("معلومات الفوج")
    body += fields([("الفوج", cls.name), ("المستوى", cls.level),
                    ("عدد التلاميذ", str(len(students))),
                    ("معدل الفوج — الثلاثي الأول", fmt(term_avg(students, 1))),
                    ("معدل الفوج — الثلاثي الثاني", fmt(term_avg(students, 2))),
                    ("معدل الفوج — الثلاثي الثالث", fmt(term_avg(students, 3)))])
    body += "<p class='small'>معدل الثلاثي = (معدل التقويم المستمر + معدل الفروض المحروسة + الاختبار × 2) ÷ 4 • المعدل السنوي = معدل الثلاثيات الثلاثة.</p>"
    term_pages = [(term, {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}[term])] if term in (1, 2, 3) else [(1, "الثلاثي الأول"), (2, "الثلاثي الثاني"), (3, "الثلاثي الثالث")]
    for term, label in term_pages:
        rows = []
        for i, st in enumerate(students, 1):
            m = next((x for x in st.marks.all() if x.term == term), None)
            rows.append([str(i), esc(st.full_name), fmt(m.continuous if m else None),
                         fmt(m.supervised if m else None), fmt(m.exam if m else None),
                         f"<b>{fmt(m.average if m else None)}</b>"])
        body += f"<div class='page-break'></div>" + band(f"شبكة التنقيط — {label}")
        body += table(["#", "الاسم واللقب", "التقويم المستمر", "الفروض المحروسة", "الاختبار", "معدل الثلاثي"], rows)
        body += f"<p class='small'>معدل الفوج في {label}: <b>{fmt(term_avg(students, term))}</b></p>"
    rows = []
    for i, st in enumerate(students, 1):
        avgs = []
        for t in (1, 2, 3):
            m = next((x for x in st.marks.all() if x.term == t), None)
            avgs.append(m.average if m else None)
        done = [a for a in avgs if a is not None]
        annual = round(sum(done) / len(done), 2) if done else None
        rows.append([str(i), esc(st.full_name), fmt(avgs[0]), fmt(avgs[1]), fmt(avgs[2]), f"<b>{fmt(annual)}</b>"])
    body += "<div class='page-break'></div>" + band("ملخص المعدلات السنوية")
    body += table(["#", "الاسم واللقب", "الثلاثي 1", "الثلاثي 2", "الثلاثي 3", "المعدل السنوي"], rows)
    return body


def plan_doc(plan, theme, profile, user):
    phases = plan.phases or []
    rows = [[esc(p.get("phase", "")), f"{p.get('minutes', '')} د", esc(p.get("teacher", "")), esc(p.get("learners", ""))] for p in phases]
    body = f"<div class='band' style='font-size:16pt;text-align:center'>خطة الدرس</div>"
    body += f"<h1 class='hfont' style='color:{theme.deep if theme else '#1F2A44'};text-align:center'>{esc(plan.title)}</h1>"
    body += fields([("المادة", plan.subject), ("المستوى", plan.level), ("المجال", plan.domain),
                    ("الوحدة", plan.unit), ("المدة", f"{plan.duration} دقيقة"),
                    ("الدرس من المقرر", plan.course.title if plan.course else ""),
                    ("الأستاذ(ة)", profile.full_name if profile and profile.full_name else "")])
    body += band("أهداف الدرس / الكفاية المستهدفة") + f"<p>{esc(plan.objectives) or '…'}</p>"
    body += band("خطوات تنفيذ الدرس")
    body += table(["المرحلة", "الزمن", "إجراءات الأستاذ", "أنشطة المتعلم"], rows)
    taught = plan.sessions.filter(status="done").count()
    body += band("المحاذاة مع التدريس الفعلي")
    body += f"<p>دُرّست هذه الخطة في <b>{taught}</b> حصة منفَّذة مسجلة في المنصة.</p>"
    body += "<div class='sign'><div>ملاحظات ما بعد الدرس<div class='line'>&nbsp;</div></div><div>إمضاء الأستاذ(ة)<div class='line'>&nbsp;</div></div></div>"
    return body


def course_doc(course, theme, profile, user):
    plan = course.plans.first()
    body = cover(theme, "COURSE HANDOUT", f"الدرس {course.order}", course.title,
                 [f"الميدان: {course.domain}" if course.domain else "", f"الوحدة: {course.unit}" if course.unit else "",
                  f"المستوى: {course.level}"], sub="مادة الإعلام الآلي")
    if course.summary:
        body += band("محتوى الدرس") + f"<p>{esc(course.summary)}</p>"
    body += band("النقاط الأساسية التي يكتبها التلاميذ")
    lis = "".join(f"<li>☐ {esc(p_)}</li>" for p_ in (course.key_points or []))
    body += f"<ul class='check'>{lis}</ul>" if lis else "<p class='small'>لا نقاط مسجلة.</p>"
    if plan:
        body += band("خطة الدرس المرتبطة") + fields([("الخطة", plan.title), ("المدة", f"{plan.duration} دقيقة"), ("الأهداف", plan.objectives)])
        rows = [[esc(p.get("phase", "")), f"{p.get('minutes', '')} د", esc(p.get("teacher", "")), esc(p.get("learners", ""))] for p in (plan.phases or [])]
        body += table(["المرحلة", "الزمن", "إجراءات الأستاذ", "أنشطة المتعلم"], rows)
    taught = course.sessions.filter(status="done").select_related("school_class")
    body += band("دُرّس لدى")
    trows = [[str(s.date), esc(s.school_class.name), esc(s.homework or "—")] for s in taught]
    body += table(["التاريخ", "الفوج", "الواجب"], trows) if trows else "<p class='small'>لم يُدرّس بعد لدى أي فوج.</p>"
    return body


def class_report_doc(cls, theme, profile, user):
    courses = list(Course.objects.filter(owner=user).order_by("order"))
    progress = class_progress(cls, courses)
    sessions = list(cls.sessions.select_related("course").all())
    students = list(cls.students.prefetch_related("marks").all())
    body = f"<div class='band' style='font-size:15pt;text-align:center'>تقرير تقدّم الفوج</div>"
    body += f"<h1 class='hfont' style='text-align:center'>{esc(cls.name)}</h1>"
    body += fields([("المستوى", cls.level), ("عدد التلاميذ", str(len(students))),
                    ("التقدم في المقرر", f"{progress['done_count']} / {progress['total_courses']} ({progress['percent']}٪)"),
                    ("الدرس التالي المقترح", progress["next_course"]["title"] if progress["next_course"] else "أُنهي المقرر")])
    done_ids = set(progress["done_course_ids"])
    rows = [[str(c.order), esc(c.title), "✓ مُدرّس" if c.id in done_ids else ("⏭ التالي" if progress["next_course"] and progress["next_course"]["id"] == c.id else "قيد الانتظار")] for c in courses]
    body += band("حالة المقرر درسًا بدرس") + table(["#", "الدرس", "الحالة"], rows)
    body += band("سجل الحصص") + sessions_table(sessions)
    if students:
        body += band("معدلات الفوج")
        body += fields([(f"معدل الثلاثي {t}", fmt(term_avg(students, t))) for t in (1, 2, 3)])
    return body


def sessions_doc(sessions, theme, title, profile, user):
    body = f"<div class='band' style='font-size:15pt;text-align:center'>{esc(title)}</div>"
    body += sessions_table(sessions)
    return body


def notebook_doc(book, theme, profile, user, entries=None):
    body = cover(theme, "NOTE BOOK", "دفتر الملاحظات", book.title,
                 [f"القسم: {book.class_name}" if book.class_name else ""], sub="مادة الإعلام الآلي")
    if entries is None:
        entries = list(book.entries.select_related("school_class", "course", "session").all())
    if not entries:
        body += "<p class='small'>لا ملاحظات.</p>"
    for e in entries:
        links = []
        if e.school_class: links.append(f"الفوج: {e.school_class.name}")
        if e.course: links.append(f"الدرس: {e.course.title}")
        if e.session: links.append(f"حصة: {e.session.date}")
        meta = " • ".join(links)
        body += (f"<div class='band' style='font-size:11pt'>{esc(e.date)} — {esc(e.title)} <span style='float:left'>{esc(e.tag)}</span></div>"
                 f"<p>{esc(e.content)}</p>" + (f"<p class='small'>{esc(meta)}</p>" if meta else ""))
    return body


def observation_doc(obs, theme, profile, user):
    body = f"<div class='band' style='font-size:15pt;text-align:center'>شبكة ملاحظة الحصة وتقييمها</div>"
    body += fields([("التاريخ", str(obs.date)), ("المؤسسة", obs.institution.name if obs.institution else ""),
                    ("الأستاذ(ة) المُزار", obs.teacher_name), ("القسم", obs.class_name),
                    ("الدرس", obs.course.title if obs.course else ""), ("التقدير العام", f"{obs.percent}٪ — {obs.appreciation}")])
    body += criteria_table(obs.criteria or DEFAULT_CRITERIA)
    body += band("نقاط القوة") + f"<p>{esc(obs.strengths) or '…'}</p>"
    body += band("نقاط للتحسين") + f"<p>{esc(obs.improvements) or '…'}</p>"
    body += "<div class='sign'><div>إمضاء الأستاذ(ة)<div class='line'>&nbsp;</div></div><div>إمضاء المفتش<div class='line'>&nbsp;</div></div></div>"
    return body


# ------------------------------------------------------------------ Creator Studio
def _paras(txt):
    return "".join(f"<p>{esc(part).replace(chr(10), '<br>')}</p>" for part in str(txt or "").split("\n\n") if part.strip()) or "<p>…</p>"


def custom_doc(doc, theme, profile=None, user=None):
    """Render a CustomDocument's blocks to the themed print body."""
    blocks = doc.blocks or []
    body = ""
    answer_key = []
    qno = 0
    letters = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"]
    for b in blocks:
        if b.get("hidden"):
            continue
        kind = b.get("type")
        if kind == "cover":
            body += cover(theme, "TEACHERHUB DOCUMENT", b.get("title") or doc.title,
                          b.get("subtitle") or "", [m for m in (b.get("meta") or []) if m])
        elif kind == "heading":
            body += band(b.get("text", ""))
        elif kind == "text":
            body += _paras(b.get("text", ""))
        elif kind == "fields":
            if b.get("title"):
                body += band(b["title"])
            body += fields([(r[0], r[1] if len(r) > 1 else "") for r in (b.get("rows") or []) if r])
        elif kind == "table":
            if b.get("title"):
                body += band(b["title"])
            rows = [[esc(c) for c in r] for r in (b.get("rows") or [])]
            body += table(b.get("headers") or [], rows) if rows else "<p class='small'>…</p>"
        elif kind == "checklist":
            if b.get("title"):
                body += band(b["title"])
            lis = "".join(f"<li>☐ {esc(i)}</li>" for i in (b.get("items") or []))
            body += f"<ul class='check'>{lis}</ul>" if lis else "<p class='small'>…</p>"
        elif kind == "questions":
            if b.get("title"):
                body += band(b["title"])
            for q in (b.get("questions") or []):
                qno += 1
                opts = "".join(f"<span>{letters[i] if i < len(letters) else i + 1}. {esc(o)}</span>" for i, o in enumerate(q.get("options") or []) if str(o).strip())
                lines = int(q.get("lines") or 0)
                body += (f"<div class='q-block'><div class='q-head'>{qno}. {esc(q.get('prompt', ''))}"
                         + (f"<span class='q-points'>{esc(q.get('points', ''))} ن</span>" if q.get("points") not in (None, "") else "")
                         + "</div>"
                         + (f"<div class='q-options'>{opts}</div>" if opts else "")
                         + ("<div class='write-lines'>" + "<div></div>" * lines + "</div>" if lines else "")
                         + "</div>")
                if q.get("answer"):
                    answer_key.append((qno, q))
            if b.get("show_answers") and answer_key:
                body += band("مفتاح الإجابة / عناصر التصحيح")
                rows = [[str(n), esc(q.get("prompt", "")[:60]), f"<b>{esc(q.get('answer', ''))}</b>"] for n, q in answer_key]
                body += f"<div class='answer-key'>{table(['#', 'السؤال', 'الإجابة'], rows)}</div>"
                answer_key = []
        elif kind == "cards":
            if b.get("title"):
                body += band(b["title"])
            for c in (b.get("cards") or []):
                body += (f"<div class='flash-card'><div class='flash-front'>{esc(c.get('front', ''))}</div>"
                         f"<div class='flash-back'>{esc(c.get('back', ''))}</div></div>")
        elif kind == "certificates":
            for name in (b.get("names") or []):
                body += (f"<div class='cert'><div class='cert-title'>{esc(b.get('title') or 'شهادة تقدير')}</div>"
                         f"<div>تُمنح هذه الشهادة إلى</div><div class='cert-name'>{esc(name)}</div>"
                         f"<p>{esc(b.get('text', ''))}</p>"
                         f"<div class='sign'><div>{esc(b.get('date', ''))}<div class='line'>التاريخ</div></div>"
                         f"<div>{esc(b.get('signer', ''))}<div class='line'>الإمضاء</div></div></div></div>")
        elif kind == "seating":
            if b.get("title"):
                body += band(b["title"])
            rows_n, cols_n = max(1, int(b.get("rows") or 4)), max(1, int(b.get("cols") or 5))
            seats = list(b.get("seats") or [])
            body += f"<div class='seat-front'>{esc(b.get('front') or 'السبورة')}</div>"
            grid = []
            for r in range(rows_n):
                row = []
                for cidx in range(cols_n):
                    idx = r * cols_n + cidx
                    row.append(f"<td>{esc(seats[idx]) if idx < len(seats) else '·'}</td>")
                grid.append("<tr>" + "".join(row) + "</tr>")
            body += "<table class='seat-table'><tbody>" + "".join(grid) + "</tbody></table>"
        elif kind == "idcards":
            if b.get("title"):
                body += band(b["title"])
            for c in (b.get("cards") or []):
                body += (f"<div class='id-card'><div class='id-card-name'>{esc(c.get('name', ''))}</div>"
                         f"<div class='id-card-meta'>{esc(c.get('meta', ''))}</div>"
                         f"<div class='id-card-footer'>{esc(c.get('footer', ''))}</div></div>")
        elif kind == "labels":
            if b.get("title"):
                body += band(b["title"])
            for name in (b.get("names") or []):
                body += (f"<div class='label-card'><div class='label-name'>{esc(name)}</div>"
                         f"<div class='small'>{esc(b.get('subtitle', ''))}</div></div>")
        elif kind == "poster":
            body += (f"<div class='poster-box'><div class='poster-title'>{esc(b.get('title', ''))}</div>"
                     f"<div class='poster-sub'>{esc(b.get('subtitle', ''))}</div>"
                     f"<div class='poster-text'>{esc(b.get('text', '')).replace(chr(10), '<br>')}</div>"
                     f"<div class='footer-note'>{esc(b.get('footer', ''))}</div></div>")
        elif kind == "signatures":
            roles = b.get("roles") or []
            body += "<div class='sign'>" + "".join(f"<div>{esc(r)}<div class='line'>&nbsp;</div></div>" for r in roles) + "</div>"
        elif kind == "pagebreak":
            body += "<div class='page-break'></div>"
    return body or "<p class='small'>وثيقة فارغة.</p>"
