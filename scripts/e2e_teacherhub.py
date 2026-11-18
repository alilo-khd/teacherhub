#!/usr/bin/env python3
"""Run an isolated, synthetic-only TeacherHub Plan → Teach → Review smoke test.

Requires the backend dependencies, Node dependencies in frontend/, Python
Playwright, and a locally installed Chromium binary. This runner creates a fresh
temporary SQLite database, does not call the bundled snapshot/demo seeder, and
removes the database and its test credentials when it exits.
"""
from __future__ import annotations

import json
import os
import secrets
from contextlib import contextmanager
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VIEWPORTS = (
    ("mobile", 390, 844),
    ("tablet", 768, 1024),
    ("compact desktop", 1024, 900),
    ("desktop", 1440, 1000),
)
ROUTE_VIEWPORTS = (
    ("small mobile", 320, 800),
    ("mobile", 360, 800),
    ("standard mobile", 390, 844),
    ("large mobile", 412, 915),
    ("small tablet", 768, 1024),
    ("large tablet", 820, 1180),
    ("compact desktop", 1024, 900),
    ("laptop", 1280, 900),
    ("desktop", 1440, 1000),
)
SECONDARY_ROUTE_SMOKE = (
    ("/courses", "المقرر الدراسي", "الدروس والمقرر الدراسي", False),
    ("/classes", "الأقسام", "الأقسام ومحاذاة المقرر", False),
    ("/sessions", "سجلّ الحصص", "سجلّ الحصص — دفتر الأستاذ الحي", False),
    ("/lesson-plans", "خطط الدروس", "خطط الدروس", False),
    ("/notebooks", "دفاتر الملاحظات", "دفاتر الملاحظات", True),
    ("/themes", "استوديو السمات", "استوديو السمات", True),
    ("/calendar", "العطل والندوات", "العطل والندوات — أجندة السنة الدراسية", True),
    ("/question-bank", "بنك الأسئلة", "بنك الأسئلة", True),
    ("/gradebook", "إدخال النقاط", "مركز إدخال النقاط ودفتر التنقيط", True),
    ("/backup", "النسخ الاحتياطي والأرشفة", "مركز النسخ الاحتياطي والأرشفة والانتقال", True),
)


def assert_direction(page, language: str, direction: str) -> None:
    actual = page.evaluate("({lang: document.documentElement.lang, dir: document.documentElement.dir})")
    assert actual == {"lang": language, "dir": direction}, f"Unexpected document language/direction: {actual}"


@contextmanager
def monitor_api_writes(page, base_url: str):
    """Record non-GET API requests during route-only smoke checks."""
    writes: list[str] = []

    def record(request) -> None:
        if request.url.startswith(f"{base_url}/api/") and request.method not in {"GET", "HEAD", "OPTIONS", "TRACE"}:
            writes.append(f"{request.method} {request.url.removeprefix(base_url)}")

    page.on("request", record)
    try:
        yield writes
    finally:
        page.remove_listener("request", record)


def assert_layout_matrix(page, surface: str, language: str, direction: str) -> None:
    """Smoke-check horizontal fit at the agreed mobile, tablet and desktop widths."""
    for label, width, height in VIEWPORTS:
        page.set_viewport_size({"width": width, "height": height})
        assert_direction(page, language, direction)
        dimensions = page.evaluate("""() => ({
          inner: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        })""")
        assert dimensions["document"] <= dimensions["inner"] + 1, (
            f"{surface} overflows at {label} ({width}px): {dimensions}"
        )
        assert dimensions["body"] <= dimensions["inner"] + 1, (
            f"{surface} body overflows at {label} ({width}px): {dimensions}"
        )
    page.set_viewport_size({"width": 390, "height": 844})


def assert_secondary_route_smoke(page, browser_errors: list[str]) -> None:
    """Open representative preserved modules without pressing any write actions."""
    for path, nav_label, heading, secondary in SECONDARY_ROUTE_SMOKE:
        error_count = len(browser_errors)
        page.set_viewport_size({"width": 1440, "height": 1000})
        if secondary:
            more_tools = page.locator(".th-more-toggle")
            if more_tools.get_attribute("aria-expanded") != "true":
                more_tools.click()
        link = page.get_by_role("link", name=nav_label, exact=True)
        link.click()
        page.get_by_role("heading", name=heading, exact=True).wait_for(timeout=12000)
        assert page.get_by_role("main").count() == 1, f"Missing main landmark on {path}"
        assert page.get_by_role("navigation", name="التنقل الرئيسي").count() == 1, f"Missing navigation landmark on {path}"
        if path == "/themes":
            assert page.get_by_role("textbox", name="ابحث باسم السمة…", exact=True).count() == 1
            assert page.get_by_role("combobox", name="كل الأساليب", exact=True).count() == 1
            assert page.get_by_role("group", name="مصدر السمات", exact=True).count() == 1
        for label, width, height in ROUTE_VIEWPORTS:
            page.set_viewport_size({"width": width, "height": height})
            assert_direction(page, "ar", "rtl")
            dimensions = page.evaluate("""() => ({
              inner: window.innerWidth,
              document: document.documentElement.scrollWidth,
              body: document.body.scrollWidth,
            })""")
            if dimensions["document"] > dimensions["inner"] + 1:
                overflow_boxes = page.evaluate("""() => [...document.querySelectorAll('html, body, body *')]
                  .map(el => {
                    const r = el.getBoundingClientRect();
                    return {tag: el.tagName, className: String(el.className || '').slice(0, 100),
                      text: (el.innerText || '').slice(0, 50), left: Math.round(r.left),
                      right: Math.round(r.right), width: Math.round(r.width),
                      client: el.clientWidth, scroll: el.scrollWidth,
                      overflowX: getComputedStyle(el).overflowX};
                  })
                  .filter(el => el.width > 0 && (el.scroll > el.client + 2 || el.left < -1 || el.right > window.innerWidth + 1))
                  .sort((a, b) => b.scroll - a.scroll).slice(0, 12)""")
                raise AssertionError(
                    f"{path} overflows at {label} ({width}px): {dimensions}; boxes={overflow_boxes}"
                )
            assert dimensions["body"] <= dimensions["inner"] + 1, (
                f"{path} body overflows at {label} ({width}px): {dimensions}"
            )
        assert len(browser_errors) == error_count, f"Browser error on {path}: {browser_errors[error_count:]}"
    page.set_viewport_size({"width": 390, "height": 844})
    print(
        f"PASS: {len(SECONDARY_ROUTE_SMOKE)} representative secondary/core routes rendered with landmarks "
        f"and no overflow at {len(ROUTE_VIEWPORTS)} widths (320–1440px)."
    )


def assert_additional_route_smoke(page, browser_errors: list[str], base_url: str) -> None:
    """Visit every remaining visible sidebar route; never activate a page write action."""
    more_tools = page.locator(".th-more-toggle")
    if more_tools.get_attribute("aria-expanded") != "true":
        more_tools.click()

    routes = page.locator(
        "nav.th-primary-nav a.th-nav-link, nav.th-secondary-nav a.th-nav-link"
    ).evaluate_all("""anchors => anchors.map(anchor => ({
      path: anchor.getAttribute('href'),
      label: anchor.innerText.trim(),
    }))""")
    assert routes, "No visible sidebar routes found."
    paths = [route["path"] for route in routes]
    assert all(path and path.startswith("/") for path in paths), routes
    assert len(paths) == len(set(paths)), f"Duplicate sidebar routes: {paths}"
    covered = {route[0] for route in SECONDARY_ROUTE_SMOKE}
    assert covered.issubset(set(paths)), f"Representative smoke routes missing from navigation: {covered - set(paths)}"
    remaining = [route for route in routes if route["path"] not in covered]
    assert remaining, "No additional sidebar routes were discovered."

    write_requests: list[str] = []

    def track_api_write(request) -> None:
        if request.url.startswith(f"{base_url}/api/") and request.method not in {"GET", "HEAD", "OPTIONS", "TRACE"}:
            write_requests.append(f"{request.method} {request.url.removeprefix(base_url)}")

    page.on("request", track_api_write)
    try:
        for route in remaining:
            path = route["path"]
            error_count = len(browser_errors)
            page.set_viewport_size({"width": 1440, "height": 1000})
            link = page.locator(f'a.th-nav-link[href="{path}"]')
            assert link.count() == 1, f"Missing unique sidebar link for {path} ({route['label']})."
            link.click()
            page.wait_for_function("expected => window.location.pathname === expected", arg=path, timeout=12000)
            page.get_by_role("main").wait_for(state="visible")
            assert page.get_by_role("navigation", name="التنقل الرئيسي").count() == 1, (
                f"Missing main-navigation landmark on {path}"
            )
            headings = page.locator(".th-content-wrap h1, .th-content-wrap h2, .th-content-wrap h3")
            headings.first.wait_for(state="visible", timeout=12000)
            heading_text = [text.strip() for text in headings.all_text_contents() if text.strip()]
            assert heading_text, f"No visible page heading on {path} ({route['label']})."

            for label, width, height in ROUTE_VIEWPORTS:
                page.set_viewport_size({"width": width, "height": height})
                assert_direction(page, "ar", "rtl")
                dimensions = page.evaluate("""() => ({
                  inner: window.innerWidth,
                  document: document.documentElement.scrollWidth,
                  body: document.body.scrollWidth,
                })""")
                if dimensions["document"] > dimensions["inner"] + 1:
                    overflow_boxes = page.evaluate("""() => [...document.querySelectorAll('html, body, body *')]
                      .map(el => {
                        const r = el.getBoundingClientRect();
                        return {tag: el.tagName, className: String(el.className || '').slice(0, 100),
                          text: (el.innerText || '').slice(0, 50), left: Math.round(r.left),
                          right: Math.round(r.right), width: Math.round(r.width),
                          client: el.clientWidth, scroll: el.scrollWidth,
                          overflowX: getComputedStyle(el).overflowX};
                      })
                      .filter(el => el.width > 0 && (el.scroll > el.client + 2 || el.left < -1 || el.right > window.innerWidth + 1))
                      .sort((a, b) => b.scroll - a.scroll).slice(0, 12)""")
                    raise AssertionError(
                        f"{path} overflows at {label} ({width}px): {dimensions}; boxes={overflow_boxes}"
                    )
                assert dimensions["body"] <= dimensions["inner"] + 1, (
                    f"{path} body overflows at {label} ({width}px): {dimensions}"
                )
            assert len(browser_errors) == error_count, (
                f"Browser error on {path} ({route['label']}): {browser_errors[error_count:]}"
            )
    finally:
        page.remove_listener("request", track_api_write)

    assert not write_requests, f"Route navigation unexpectedly invoked API writes: {write_requests}"
    print(
        f"PASS: all {len(routes)} visible sidebar routes rendered with landmarks and no browser errors; "
        f"{len(remaining)} additional routes checked at {len(ROUTE_VIEWPORTS)} widths (320–1440px)."
    )


def assert_keyboard_focus_visible(page, start_selector: str, expected_selector: str) -> None:
    page.locator(start_selector).focus()
    page.keyboard.press("Tab")
    focused = page.evaluate("""(expectedId) => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return {
        id: el?.id,
        visible: el?.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    }""", expected_selector.removeprefix("#"))
    assert focused["id"] == expected_selector.removeprefix("#"), focused
    has_outline = focused["outlineStyle"] != "none" and focused["outlineWidth"] != "0px"
    has_shadow = focused["boxShadow"] not in ("none", "")
    assert focused["visible"] and (has_outline or has_shadow), focused


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_http(url: str, process: subprocess.Popen, label: str, timeout: float = 45) -> None:
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"{label} exited before becoming ready (exit {process.returncode}).")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status < 500:
                    return
        except (OSError, URLError) as error:
            last_error = error
        time.sleep(0.2)
    raise TimeoutError(f"Timed out waiting for {label} at {url}: {last_error}")


def stop_process(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    # The Vite npm wrapper spawns Node; stop the entire isolated process group,
    # including children that outlive the wrapper after an assertion failure.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)


def log_tail(path: Path, lines: int = 60) -> str:
    try:
        return "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:])
    except OSError:
        return "(log unavailable)"


def verify_disposable_database(env: dict[str, str]) -> None:
    """Fail closed before migrations unless Django resolves to this temp SQLite file."""
    check_code = r'''
import os
from pathlib import Path
import django

django.setup()
from django.db import connection
expected = Path(os.environ["TEACHERHUB_E2E_DB"]).resolve()
actual = Path(connection.settings_dict["NAME"]).resolve()
assert connection.vendor == "sqlite" and actual == expected, (connection.vendor, actual, expected)
'''
    result = subprocess.run(
        [sys.executable, "-c", check_code],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        raise RuntimeError("Refusing to run E2E migrations: Django is not configured for the disposable SQLite database.")


def create_synthetic_fixture(env: dict[str, str]) -> dict[str, int | str]:
    seed_code = r'''
import datetime
import json
import os
from pathlib import Path
import django

django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from hub.models import Course, SchoolClass, TimetableSlot

expected_db = Path(os.environ["TEACHERHUB_E2E_DB"]).resolve()
actual_db = Path(connection.settings_dict["NAME"]).resolve()
assert connection.vendor == "sqlite" and actual_db == expected_db, (connection.vendor, actual_db, expected_db)
User = get_user_model()
teacher = User.objects.create_user(
    username=settings.TEACHER_USERNAME,
    password=os.environ["TEACHERHUB_E2E_PASSWORD"],
    first_name="Synthetic",
    last_name="Teacher",
)
course = Course.objects.create(
    owner=teacher,
    title="Synthetic Curriculum Lesson",
    order=1,
    domain="Synthetic domain",
    unit="Synthetic unit",
    key_points=["Synthetic checkpoint one", "Synthetic checkpoint two"],
)
school_class = SchoolClass.objects.create(
    owner=teacher,
    name="Synthetic Cohort QA",
    level="Synthetic level",
    students_count=0,
)
today = datetime.date.today()
weekday = (today.weekday() + 1) % 7  # TeacherHub timetable: Sunday = 0.
TimetableSlot.objects.create(
    school_class=school_class,
    weekday=weekday,
    start_time=datetime.time(9, 0),
    end_time=datetime.time(10, 0),
    room="Synthetic room",
)
print(json.dumps({
    "class_id": school_class.id,
    "course_id": course.id,
    "key_point": course.key_points[0],
}))
'''
    result = subprocess.run(
        [sys.executable, "-c", seed_code],
        cwd=BACKEND,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def run_browser_flow(base_url: str, fixture: dict[str, int | str], password: str) -> None:
    browser_errors: list[str] = []
    logged_in = False
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        try:
            page.goto(f"{base_url}/login", wait_until="domcontentloaded")
            page.get_by_label("اسم المستخدم").wait_for()
            page.get_by_label("كلمة المرور").wait_for()
            assert page.get_by_role("main").count() == 1
            page.wait_for_function("document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'")
            assert_layout_matrix(page, "private sign-in", "ar", "rtl")
            page.get_by_label("اسم المستخدم").fill("teacher")
            page.get_by_label("كلمة المرور").fill(password)
            page.get_by_role("button", name="دخول آمن", exact=True).click()
            page.get_by_role("heading", name="مساحة التدريس اليومية").wait_for(timeout=12000)
            logged_in = True
            assert page.get_by_role("navigation", name="التنقل الرئيسي").count() == 1
            assert_layout_matrix(page, "Today dashboard", "ar", "rtl")

            # Today → Plan: start from the mobile drawer and prepare the
            # curriculum-linked plan suggested for the synthetic timetable.
            menu = page.get_by_role("button", name="فتح القائمة", exact=True)
            assert menu.get_attribute("aria-expanded") == "false"
            menu.click()
            assert menu.get_attribute("aria-expanded") == "true"
            with page.expect_response(
                lambda response: "/api/planner/week/" in response.url and response.status == 200
            ) as planner_response:
                page.get_by_role("link", name="التخطيط الأسبوعي", exact=True).click()
            assert menu.get_attribute("aria-expanded") == "false", "Mobile drawer did not close after navigation."
            planner_data = planner_response.value.json()
            page.get_by_role("heading", name="مركز التخطيط الأسبوعي").wait_for(timeout=12000)
            assert_layout_matrix(page, "weekly planner", "ar", "rtl")
            selected = next(
                ((day, entry) for day in planner_data["days"] for entry in day["entries"]
                 if entry.get("next_course")),
                None,
            )
            assert selected, "Synthetic timetable did not produce a next-lesson planner entry."
            planned_day, entry = selected
            assert entry.get("next_plan") is None, "Synthetic fixture should start without a lesson plan."
            assert entry["next_course"]["id"] == fixture["course_id"]
            assert entry["class_id"] == fixture["class_id"]

            create_plan = page.get_by_role("link", name="إعداد خطة الدرس").first
            assert create_plan.get_attribute("href") == f"/lesson-plans/new?course={fixture['course_id']}"
            create_plan.click()
            page.get_by_role("heading", name="خطة درس جديدة").wait_for(timeout=12000)
            course_select = page.get_by_label("الدرس المرتبط من المقرر")
            assert course_select.input_value() == str(fixture["course_id"])
            assert_layout_matrix(page, "lesson-plan editor", "ar", "rtl")
            assert_keyboard_focus_visible(page, "#lesson-plan-course", "#lesson-plan-subject")
            page.get_by_label("عنوان الدرس *").fill("Automated synthetic lesson plan")

            with page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.endswith("/api/lesson-plans/")
            ) as plan_response:
                page.get_by_role("button", name="إنشاء الخطة", exact=True).click()
            assert plan_response.value.status == 201, plan_response.value.text()
            plan_id = plan_response.value.json()["id"]
            page.wait_for_url("**/lesson-plans?plan=*")

            # Teach: verify the saved plan is now offered by the planner, then
            # capture the scheduled class/date/course through the full dialog.
            with page.expect_response(
                lambda response: "/api/planner/week/" in response.url and response.status == 200
            ) as updated_planner_response:
                page.goto(f"{base_url}/planner", wait_until="domcontentloaded")
            updated_data = updated_planner_response.value.json()
            page.get_by_role("heading", name="مركز التخطيط الأسبوعي").wait_for(timeout=12000)
            selected = next(
                ((day, entry) for day in updated_data["days"] for entry in day["entries"]
                 if entry.get("next_course")),
                None,
            )
            assert selected, "The planned lesson disappeared from the synthetic timetable."
            planned_day, entry = selected
            assert entry["next_plan"]["id"] == plan_id
            page.get_by_role("button", name="فتح تسجيل الحصة").click()
            dialog = page.get_by_role("dialog", name="تسجيل حصة منفَّذة")
            dialog.wait_for(state="visible", timeout=12000)
            assert dialog.get_attribute("aria-modal") == "true"
            assert dialog.get_by_label("القسم / الفوج *").input_value() == str(fixture["class_id"])
            assert dialog.get_by_label("التاريخ *").input_value() == planned_day["date"]
            assert dialog.locator("select").nth(1).input_value() == str(fixture["course_id"])
            assert_layout_matrix(page, "session-capture dialog", "ar", "rtl")
            assert_keyboard_focus_visible(page, "#session-class", "#session-course")

            # Checkpoint inputs are semantically labelled and keyboard operable.
            checkboxes = dialog.locator('input[type="checkbox"]')
            assert checkboxes.count() >= 1, "Synthetic curriculum checkpoints were not shown."
            assert dialog.get_by_role("checkbox", name="Synthetic checkpoint one", exact=True).count() == 1
            checkbox = checkboxes.first
            checkbox.focus()
            checkbox.press("Space")
            assert checkbox.is_checked(), "Keyboard activation did not select a lesson checkpoint."
            focus_style = checkbox.evaluate("""el => {
              const label = el.closest('label');
              const style = getComputedStyle(label);
              return {focusWithin: label.matches(':focus-within'), outlineWidth: style.outlineWidth};
            }""")
            assert focus_style["focusWithin"] and focus_style["outlineWidth"] != "0px", focus_style

            marker = f"Synthetic E2E session {secrets.token_hex(6)}"
            dialog.get_by_label("ملاحظات الحصة").fill(marker)
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and response.url.endswith("/api/sessions/")
            ) as session_response:
                dialog.get_by_role("button", name="حفظ الحصة ومزامنة التقدّم", exact=True).click()
            assert session_response.value.status == 201, session_response.value.text()
            session_data = session_response.value.json()
            assert session_data["lesson_plan"] == plan_id, session_data
            assert fixture["key_point"] in session_data["points_written"], session_data["points_written"]
            assert session_data["class_progress_after"]["percent"] == 100

            # Review: navigate from the same mobile drawer and verify the
            # analytics review now reflects the completed synthetic lesson.
            page.get_by_role("button", name="فتح القائمة", exact=True).click()
            with page.expect_response(
                lambda response: f"/api/classes/{fixture['class_id']}/analytics/" in response.url
                and response.status == 200
            ) as review_response:
                page.get_by_role("link", name="مراجعة التقدّم", exact=True).click()
            assert page.get_by_role("button", name="فتح القائمة").get_attribute("aria-expanded") == "false"
            review_data = review_response.value.json()
            assert review_data["curriculum"]["percent"] == 100, review_data["curriculum"]
            page.get_by_role("heading", name="مركز تحليلات الفوج ومراجعة الثلاثي").wait_for(timeout=12000)
            progress_card = page.locator(".analytics-stat").filter(has_text="تقدم المقرر")
            assert progress_card.locator(".stat-mini-num").inner_text().strip() == "100٪"
            assert_layout_matrix(page, "Review analytics", "ar", "rtl")

            # Smoke representative secondary workflows in the same isolated
            # database. Only screens are opened; no secondary write action runs.
            with monitor_api_writes(page, base_url) as route_writes:
                assert_secondary_route_smoke(page, browser_errors)
                assert_additional_route_smoke(page, browser_errors, base_url)
            assert not route_writes, f"Route smoke checks unexpectedly invoked API writes: {route_writes}"
            print("PASS: route smoke checks made no non-GET API requests.")
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.get_by_role("link", name="مراجعة التقدّم", exact=True).click()
            page.get_by_role("heading", name="مركز تحليلات الفوج ومراجعة الثلاثي").wait_for(timeout=12000)

            # Direction changes reload Bootstrap's matching CSS; translations
            # within the same LTR direction update without a reload.
            page.set_viewport_size({"width": 1440, "height": 1000})
            with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
                page.locator("#interface-language").select_option("en")
            page.get_by_role("heading", name="Class Analytics & Term Review Centre").wait_for(timeout=12000)
            assert page.get_by_role("link", name="Progress review", exact=True).count() == 1
            assert_layout_matrix(page, "English Review analytics", "en", "ltr")

            page.get_by_role("button", name="Open navigation", exact=True).click()
            assert page.get_by_role("link", name="Weekly planning", exact=True).is_visible()
            page.get_by_role("link", name="Weekly planning", exact=True).click()
            page.get_by_role("heading", name="Weekly Work Planner").wait_for(timeout=12000)
            assert_layout_matrix(page, "English weekly planner", "en", "ltr")

            page.set_viewport_size({"width": 1440, "height": 1000})
            page.locator("#interface-language").select_option("fr")
            page.get_by_role("heading", name="Centre de planification hebdomadaire").wait_for(timeout=12000)
            assert page.get_by_role("link", name="Planification hebdomadaire", exact=True).count() == 1
            assert_layout_matrix(page, "French weekly planner", "fr", "ltr")
            page.get_by_role("button", name="Ouvrir la navigation", exact=True).click()
            assert page.get_by_role("link", name="Planification hebdomadaire", exact=True).is_visible()

            assert not browser_errors, browser_errors
            print("PASS: synthetic Today → Plan → Teach → Review flow; plan/session linkage; curriculum checkpoint by keyboard; 100% Review.")
            print("PASS: targeted accessibility checks for labels, landmarks, named dialog, keyboard focus indicators, checkbox semantics, and drawer state.")
            print("PASS: no horizontal overflow at 390, 768, 1024, or 1440px on sign-in, dashboard, planner, plan editor, session dialog, and Review; Arabic RTL, English/French LTR.")
        finally:
            if logged_in:
                page.evaluate("""async () => {
                  const token = document.cookie.split(';').map((part) => part.trim())
                    .find((part) => part.startsWith('csrftoken='))?.split('=').slice(1).join('=');
                  if (token) return (await fetch('/api/auth/logout/', {
                    method: 'POST', credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json', 'X-CSRFToken': decodeURIComponent(token)},
                    body: '{}'
                  })).status;
                  return 0;
                }""")
            context.close()
            browser.close()


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="teacherhub-e2e-") as temp_dir:
        temp_root = Path(temp_dir)
        database_path = temp_root / "synthetic.sqlite3"
        backend_port = free_port()
        frontend_port = free_port()
        password = secrets.token_urlsafe(30)

        env = os.environ.copy()
        for key in (
            "DATABASE_URL", "DJANGO_DEBUG", "DJANGO_SECRET_KEY", "DJANGO_ALLOWED_HOSTS",
            "DJANGO_CSRF_TRUSTED_ORIGINS", "RENDER_EXTERNAL_HOSTNAME",
        ):
            env.pop(key, None)
        env.update({
            "DATABASE_URL": f"sqlite:///{database_path}",
            "DJANGO_DEBUG": "1",
            "DJANGO_SECRET_KEY": secrets.token_urlsafe(48),
            "DJANGO_ALLOWED_HOSTS": "127.0.0.1,localhost,testserver",
            "DJANGO_CSRF_TRUSTED_ORIGINS": f"http://127.0.0.1:{frontend_port}",
            "DJANGO_SETTINGS_MODULE": "config.settings",
            "TEACHERHUB_E2E_DB": str(database_path),
            "TEACHERHUB_E2E_PASSWORD": password,
        })
        backend_log = temp_root / "backend.log"
        frontend_log = temp_root / "frontend.log"
        backend_process = frontend_process = None
        failed = False
        print("Preparing a fresh temporary SQLite database with synthetic teacher/class/course/timetable data.")
        verify_disposable_database(env)
        migration = subprocess.run(
            [sys.executable, "manage.py", "migrate", "--noinput"],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
        )
        if migration.returncode:
            print(migration.stdout, file=sys.stderr)
            print(migration.stderr, file=sys.stderr)
            raise subprocess.CalledProcessError(migration.returncode, migration.args)
        fixture = create_synthetic_fixture(env)

        try:
            with backend_log.open("w", encoding="utf-8") as log:
                backend_process = subprocess.Popen(
                    [sys.executable, "manage.py", "runserver", "--noreload", f"127.0.0.1:{backend_port}"],
                    cwd=BACKEND,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
                wait_for_http(f"http://127.0.0.1:{backend_port}/api/auth/csrf/", backend_process, "Django API")

            frontend_env = env.copy()
            frontend_env["TEACHERHUB_API_PROXY"] = f"http://127.0.0.1:{backend_port}"
            with frontend_log.open("w", encoding="utf-8") as log:
                frontend_process = subprocess.Popen(
                    ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(frontend_port), "--strictPort"],
                    cwd=FRONTEND,
                    env=frontend_env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
                base_url = f"http://127.0.0.1:{frontend_port}"
                wait_for_http(base_url, frontend_process, "Vite frontend")

            run_browser_flow(base_url, fixture, password)
        except Exception:
            failed = True
            raise
        finally:
            stop_process(frontend_process)
            stop_process(backend_process)
            if failed:
                print("\n--- Django API log tail ---", file=sys.stderr)
                print(log_tail(backend_log), file=sys.stderr)
                print("\n--- Vite frontend log tail ---", file=sys.stderr)
                print(log_tail(frontend_log), file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
