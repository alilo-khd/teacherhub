# -*- coding: utf-8 -*-
"""Automatic theme generation.

Curated identities (hand-tuned, incl. the print-journal favourites) plus a
deterministic combinatorial generator that mixes deep hues, accents and
Arabic display fonts into a large library of coherent themes.
"""
import itertools

CURATED = [
    dict(slug="gentleman-navy", name_ar="البدلة الكحلية", name_en="Gentleman Navy",
         tagline="كحلي عميق × ذهبي — هوية دفتر K",
         deep="#14263F", deeper="#0C1828", ink="#22304D", accent="#C9A227", accent2="#8C6F2F",
         soft="#F2EEE3", soft2="#FAF8F1", line="#D9D2BC", paper="#FFFFFF",
         heading_font="Tajawal", style_type="كلاسيكية"),
    dict(slug="monochrome", name_ar="مونوكروم", name_en="Monochrome",
         tagline="أبيض × حبر ليلي × مرجاني — روح سويسرية (05)",
         deep="#1F2A44", deeper="#131B2E", ink="#1F2A44", accent="#FF5A3C", accent2="#8A94A8",
         soft="#F1F1EE", soft2="#FAFAF8", line="#DADAD5", paper="#FFFFFF",
         heading_font="IBM Plex Sans Arabic", style_type="أحادية"),
    dict(slug="andalus-gold", name_ar="ذهب الأندلس", name_en="Andalusian Gold",
         tagline="رملي × نيلي × ذهبي عباسي (04)",
         deep="#1B2A4A", deeper="#101B33", ink="#1E2A47", accent="#C9A227", accent2="#8C6A15",
         soft="#F4EFDF", soft2="#FBF8EE", line="#D8CDB0", paper="#FDFBF3",
         heading_font="Aref Ruqaa", style_type="كلاسيكية"),
    dict(slug="oasis-green", name_ar="واحة خضراء", name_en="Oasis Green",
         tagline="أخضر واحات × عاجي",
         deep="#14532D", deeper="#0B3B1F", ink="#1E4630", accent="#D9A441", accent2="#3E7C4F",
         soft="#EFF6EC", soft2="#F8FBF5", line="#CBDFC6", paper="#FFFFFF",
         heading_font="Tajawal", style_type="دافئة"),
    dict(slug="sahara-dawn", name_ar="فجر الصحراء", name_en="Sahara Dawn",
         tagline="رمال دافئة × برتقالي فجري",
         deep="#5B3A1E", deeper="#3E2712", ink="#4A3421", accent="#E07B39", accent2="#9C6B30",
         soft="#FAF1E3", soft2="#FDF8EF", line="#E9D9BE", paper="#FFFDF8",
         heading_font="Amiri", style_type="دافئة"),
    dict(slug="royal-burgundy", name_ar="عنابي ملكي", name_en="Royal Burgundy",
         tagline="عنابي غامق × ذهبي وردي",
         deep="#4A1420", deeper="#30090F", ink="#43222B", accent="#D4A24E", accent2="#93344D",
         soft="#F9EEF0", soft2="#FDF7F8", line="#E8CDD2", paper="#FFFFFF",
         heading_font="Aref Ruqaa", style_type="كلاسيكية"),
    dict(slug="midnight-teal", name_ar="مخضرّ منتصف الليل", name_en="Midnight Teal",
         tagline="أخضر مزرقّ ليلي × نحاسي",
         deep="#0E3A3A", deeper="#072525", ink="#173F3F", accent="#E0A458", accent2="#2E7D74",
         soft="#EBF4F2", soft2="#F6FAF9", line="#C6DDD8", paper="#FFFFFF",
         heading_font="Tajawal", style_type="باردة"),
    dict(slug="lavender-mist", name_ar="ضباب الخزامى", name_en="Lavender Mist",
         tagline="بنفسجي هادئ × فضي",
         deep="#3E3663", deeper="#292347", ink="#38335A", accent="#C49BD8", accent2="#7D6FB8",
         soft="#F1EFF9", soft2="#FAF9FD", line="#DCD6EE", paper="#FFFFFF",
         heading_font="IBM Plex Sans Arabic", style_type="باردة"),
    dict(slug="charcoal-slate", name_ar="فحمي صخري", name_en="Charcoal Slate",
         tagline="فحمي × أردوازي × أصفر خافت",
         deep="#23272E", deeper="#14171C", ink="#2B3038", accent="#E5C15C", accent2="#6B7686",
         soft="#F0F1F3", soft2="#F9FAFB", line="#D5D9DE", paper="#FFFFFF",
         heading_font="Tajawal", style_type="عصرية"),
    dict(slug="mediterranean", name_ar="متوسطي صافٍ", name_en="Mediterranean",
         tagline="أزرق متوسطي × أبيض بحري",
         deep="#0B4F6C", deeper="#06374E", ink="#14455C", accent="#F2B134", accent2="#1B7F9E",
         soft="#EAF4F8", soft2="#F6FAFC", line="#C4DEE9", paper="#FFFFFF",
         heading_font="Tajawal", style_type="باردة"),
    dict(slug="rosewood", name_ar="ورد الخشب", name_en="Rosewood",
         tagline="وردي عتيق × بني وردي",
         deep="#5C2E35", deeper="#402026", ink="#4E2F36", accent="#E3B778", accent2="#A85D68",
         soft="#FAF0EF", soft2="#FCF7F6", line="#ECD6D2", paper="#FFFFFF",
         heading_font="Amiri", style_type="دافئة"),
    dict(slug="academic-maroon", name_ar="أكاديمي كستنائي", name_en="Academic Maroon",
         tagline="كستنائي جامعي × كريمي",
         deep="#571C24", deeper="#3B1219", ink="#472227", accent="#CBA35C", accent2="#8A5A44",
         soft="#F7EFEA", soft2="#FBF7F3", line="#E3D2C8", paper="#FDFBF7",
         heading_font="Scheherazade New", style_type="كلاسيكية"),
]

DEEPS = [
    ("#173A5E", "#0E2742", "سماوي"), ("#2C3E70", "#1D2A4F", "نيلي"),
    ("#3B2F63", "#281E47", "بنفسجي"), ("#134E4A", "#0A3532", "زمردي"),
    ("#4A2C14", "#33200E", "بندقي"), ("#5A1F2B", "#3E1420", "خمري"),
    ("#263238", "#171E22", "جرافيتي"), ("#6B4226", "#4C2E18", "عسلي"),
    ("#7A3B2E", "#572A20", "طيني"), ("#1F4E5F", "#143743", "بترولي"),
    ("#44546A", "#2F3B4C", "أردوازي"), ("#556B2F", "#3C4C20", "زيني"),
]
ACCENTS = [
    ("#C9A227", "#97771A", "ذهبي"), ("#E07B39", "#B35F28", "مشمي"),
    ("#3FA7A3", "#2B7A76", "فيروزي"), ("#D96C85", "#B04A64", "وردي"),
    ("#8FBF3F", "#6C9430", "ليموني"), ("#E5C15C", "#BFA03F", "أصفر"),
    ("#7FB3D5", "#5B8DB3", "سمائي"), ("#C49BD8", "#9A7BB3", "خزامي"),
]
FONTS = ["Tajawal", "Amiri", "Aref Ruqaa", "IBM Plex Sans Arabic", "Scheherazade New"]
MOODS = ["كلاسيكية", "عصرية", "دافئة", "باردة"]

_SOFTS = ["#F4F1EA", "#EFF3F6", "#F7EFEA", "#EFF6EC", "#F1EFF9"]


def _mix(hex1, hex2, ratio=0.85):
    def rgb(h):
        return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    a, b = rgb(hex1), rgb(hex2)
    m = tuple(round(a[i] * ratio + b[i] * (1 - ratio)) for i in range(3))
    return "#%02X%02X%02X" % m


def generate_theme_dicts(count=48, offset=0):
    """Deterministically generate `count` coherent themes (offset for paging)."""
    combos = list(itertools.product(DEEPS, ACCENTS, FONTS))
    out = []
    for i in range(count):
        idx = offset + i
        (deep, deeper, deep_name), (accent, accent2, acc_name), font = combos[idx % len(combos)]
        soft = _SOFTS[idx % len(_SOFTS)]
        font_suffix = {"Tajawal": "", "Amiri": " بخط أميري", "Aref Ruqaa": " بخط الرقعة",
                       "IBM Plex Sans Arabic": " بخط بلكس", "Scheherazade New": " بخط شهرزاد"}[font]
        out.append(dict(
            slug=f"auto-{idx + 1:03d}",
            name_ar=f"{deep_name} {acc_name}{font_suffix}",
            name_en=f"Auto Theme {idx + 1:03d}",
            tagline="سمة مولّدة آليًا بواسطة سكربت التوليد",
            deep=deep, deeper=deeper, ink=_mix(deep, "#000000", 0.82),
            accent=accent, accent2=accent2,
            soft=soft, soft2=_mix(soft, "#FFFFFF", 0.55),
            line=_mix(soft, deep, 0.78), paper="#FFFFFF",
            heading_font=font, body_font="IBM Plex Sans Arabic",
            style_type=MOODS[idx % len(MOODS)], source="generated",
        ))
    return out
