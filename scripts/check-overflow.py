#!/usr/bin/env python3
"""
Optional dev check: fails if any page scrolls horizontally at common widths.
jsdom cannot measure layout, so this uses a real browser (Python Playwright, not an app dependency).

  npm run build && npx vite preview --port 4173 &
  pip install playwright && playwright install chromium
  python3 scripts/check-overflow.py http://localhost:4173
"""
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173").rstrip("/")
WIDTHS = (390, 768, 1024, 1280, 1366, 1440, 1920)
ROUTES = {
    "dashboard": "#/",
    "forecasts": "#/forecasts",
    "menus": "#/menus",
    "ops (awaiting approval)": "#/kitchen-operations?date=2026-10-14&meal=dinner",
    "ops (approved)": "#/kitchen-operations?date=2026-10-14&meal=lunch",
    "ops (completed)": "#/kitchen-operations?date=2026-10-14&meal=breakfast",
    "waste analytics": "#/waste-analytics",
    "settings": "#/settings",
}
PAGE_OVERFLOW = "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"

failures = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for width in WIDTHS:
        for name, route in ROUTES.items():
            page = browser.new_page(viewport={"width": width, "height": 900})
            page.goto(f"{BASE}/{route}")
            page.wait_for_timeout(400)
            overflow = page.evaluate(PAGE_OVERFLOW)
            if overflow > 0:
                failures.append(f"{width}px  {name}: page scrolls horizontally by {overflow}px")
            page.close()
    browser.close()

if failures:
    print("\n".join(failures))
    sys.exit(1)
print(f"OK: no horizontal page overflow on {len(ROUTES)} routes x {len(WIDTHS)} widths")
