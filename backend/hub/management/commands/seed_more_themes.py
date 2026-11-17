from django.core.management.base import BaseCommand
from hub.models import Theme

MORE = [
 dict(slug="royal-oud", name_ar="العود الملكي", name_en="Royal Oud", tagline="بنيّ عميق وذهبي — وقار كلاسيكي",
      deep="#4A2C14", deeper="#2E1A0A", ink="#2B1B0C", accent="#C08A3E", accent2="#8A5A24",
      soft="#F5EADC", soft2="#FBF6EE", line="#E3D4BF", paper="#FFFCF7", heading_font="Amiri", body_font="IBM Plex Sans Arabic", style_type="classical", pattern="diamonds", cover_style="classic"),
 dict(slug="peacock-teal", name_ar="الطاووس الفيروزي", name_en="Peacock Teal", tagline="فيروزي ملكي وبنفسجي — فخامة هادئة",
      deep="#0B5563", deeper="#06333C", ink="#0C2E35", accent="#C9A227", accent2="#7C5CBF",
      soft="#E2F0F2", soft2="#F0F7F8", line="#C4DEE2", paper="#FBFEFE", heading_font="Tajawal", body_font="IBM Plex Sans Arabic", style_type="modern", pattern="waves", cover_style="bold"),
 dict(slug="rose-garden", name_ar="حديقة الورد", name_en="Rose Garden", tagline="وردي دافئ وترابي — دفء وأناقة",
      deep="#8E2F45", deeper="#5E1D2D", ink="#3A1620", accent="#D9A05B", accent2="#B76E79",
      soft="#FAE8EC", soft2="#FDF3F5", line="#EFD3DA", paper="#FFFBFC", heading_font="Scheherazade New", body_font="IBM Plex Sans Arabic", style_type="classical", pattern="dots", cover_style="minimal"),
 dict(slug="midnight-lapis", name_ar="اللازورد الليلي", name_en="Midnight Lapis", tagline="كحلي ليلي وذهبي نجوم — عمق وتركيز",
      deep="#141E4A", deeper="#0B1030", ink="#101736", accent="#E3B341", accent2="#5B7FD9",
      soft="#E4E8F7", soft2="#F2F4FC", line="#CBD4F0", paper="#FBFCFF", heading_font="Tajawal", body_font="IBM Plex Sans Arabic", style_type="modern", pattern="dots", cover_style="bold"),
 dict(slug="olive-grove", name_ar="بستان الزيتون", name_en="Olive Grove", tagline="زيتوني وبنّي ترابي — هدوء طبيعي",
      deep="#556B2F", deeper="#37471D", ink="#263014", accent="#D9A441", accent2="#8FA65C",
      soft="#EEF2E0", soft2="#F7F9F0", line="#D8E0C2", paper="#FDFEFB", heading_font="Tajawal", body_font="IBM Plex Sans Arabic", style_type="administrative", pattern="grid", cover_style="classic"),
 dict(slug="copper-navy", name_ar="النحاس والكحلي", name_en="Copper Navy", tagline="كحلي رسمي ونحاس دافئ — طابع مؤسسي",
      deep="#16283F", deeper="#0C1828", ink="#14222F", accent="#C47B3D", accent2="#4E7CA1",
      soft="#E6EDF4", soft2="#F3F7FB", line="#CCDAE8", paper="#FCFDFE", heading_font="IBM Plex Sans Arabic", body_font="IBM Plex Sans Arabic", style_type="administrative", pattern="diagonal", cover_style="bold"),
 dict(slug="lavender-mist", name_ar="ضباب الخزامى", name_en="Lavender Mist", tagline="خزامى ناعمة ووردي — رقة وصفاء",
      deep="#5B4A8A", deeper="#3B2F5E", ink="#2C2342", accent="#E08BB0", accent2="#8A7CC9",
      soft="#EFEBF9", soft2="#F8F6FD", line="#DCD4F0", paper="#FDFCFF", heading_font="Tajawal", body_font="IBM Plex Sans Arabic", style_type="modern", pattern="waves", cover_style="minimal"),
 dict(slug="sahara-sand", name_ar="رمال الصحراء", name_en="Sahara Sand", tagline="رملية وبرتقالية غروب — دفء مشرق",
      deep="#9A5B1E", deeper="#6E3E10", ink="#3D260E", accent="#E07B2A", accent2="#2E7D6B",
      soft="#F8EDDC", soft2="#FCF6EC", line="#EBD9BE", paper="#FFFCF6", heading_font="Lalezar", body_font="IBM Plex Sans Arabic", style_type="youthful", pattern="diamonds", cover_style="bold"),
 dict(slug="forest-pine", name_ar="صنوبر الغابة", name_en="Forest Pine", tagline="صنوبري غامق وعنبري — متانة وهدوء",
      deep="#1F4D3A", deeper="#122E22", ink="#122B1E", accent="#D9A441", accent2="#6FA287",
      soft="#E3F0E8", soft2="#F1F8F4", line="#C6DECF", paper="#FBFDFC", heading_font="Tajawal", body_font="IBM Plex Sans Arabic", style_type="classical", pattern="grid", cover_style="classic"),
 dict(slug="crimson-sovereign", name_ar="القرمزي السيادي", name_en="Crimson Sovereign", tagline="قرمزي عميق وذهبي — هيبة رسمية",
      deep="#6E1423", deeper="#450B16", ink="#330D16", accent="#D4A24C", accent2="#94384C",
      soft="#F7E4E7", soft2="#FCF1F3", line="#EBCBD1", paper="#FFFBFC", heading_font="Amiri", body_font="IBM Plex Sans Arabic", style_type="classical", pattern="diamonds", cover_style="classic"),
 dict(slug="azure-scroll", name_ar="مخطوطة الأفق", name_en="Azure Scroll", tagline="سماوي وذهبي خفيف — صفاء وانفتاح",
      deep="#1D5C8A", deeper="#103A5C", ink="#14304A", accent="#E0A83C", accent2="#6FA8D0",
      soft="#E3EFF8", soft2="#F2F8FC", line="#C8DEEE", paper="#FBFDFE", heading_font="Scheherazade New", body_font="IBM Plex Sans Arabic", style_type="classical", pattern="waves", cover_style="minimal"),
 dict(slug="graphite-slate", name_ar="الأردواز الغرافيتي", name_en="Graphite Slate", tagline="رمادي غرافيتي وفيروزي — حياد مهني",
      deep="#333A42", deeper="#1F242A", ink="#22282E", accent="#2FA8A0", accent2="#E0A83C",
      soft="#EBEEF1", soft2="#F6F8F9", line="#D5DBE0", paper="#FCFDFD", heading_font="IBM Plex Sans Arabic", body_font="IBM Plex Sans Arabic", style_type="modern", pattern="diagonal", cover_style="minimal"),
]


class Command(BaseCommand):
    help = "Seed 12 additional curated themes (patterns, cover styles, new fonts)."

    def handle(self, *args, **options):
        created = 0
        for item in MORE:
            _, was_created = Theme.objects.get_or_create(slug=item["slug"], defaults={**item, "source": "curated"})
            created += int(was_created)
        self.stdout.write(self.style.SUCCESS(f"Done. added={created} total={Theme.objects.count()}"))
