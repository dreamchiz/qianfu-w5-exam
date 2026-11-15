"""長白山旅遊網站：獨立品質驗收。資料、桌機、平板、手機皆檢查。"""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SIZES = [(1440,900),(1024,800),(820,900),(390,844),(375,812),(320,740)]

async def verify():
    assert 'lang="zh-Hant"' in HTML, "缺少繁體中文語言設定"
    data = json.loads(re.search(r'<script id="tripdb" type="application/json">([\s\S]*?)</script>', HTML).group(1))
    assert len(data["days"]) == 8, "行程必須為八天"
    assert all(d["hotel"] for d in data["days"]), "每日住宿資訊缺漏"
    assert all(not re.search(r'Park Hyatt|Holiday Inn|Crowne Plaza|MGallery|Swissotel', d["hotel"], re.I) for d in data["days"]), "飯店名稱必須為中文"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for width, height in SIZES:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.route("**/*", lambda route: route.abort())
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            await page.set_content(HTML, wait_until="domcontentloaded")
            result = await page.evaluate("""() => {
              const rows = [...document.querySelectorAll('.overview-row')];
              const first = rows[0];
              const main = first.querySelector('.overview-main').getBoundingClientRect();
              const hotel = first.querySelector('.overview-hotel').getBoundingClientRect();
              return {
                count: rows.length,
                hotelCount: rows.filter(r => r.querySelector('.overview-hotel strong')?.innerText).length,
                detailCount: document.querySelectorAll('.overview-detail').length,
                rightOfItinerary: hotel.left >= main.right - 1,
                noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 4,
                grid: getComputedStyle(first).display === 'grid'
              };
            }""")
            assert result["count"] == 8 and result["hotelCount"] == 8 and result["detailCount"] == 8, (width,result)
            assert result["rightOfItinerary"] and result["noOverflow"] and result["grid"], (width,result)
            await page.evaluate("document.querySelectorAll('.overview-detail')[2].click()")
            assert await page.locator("#itinerary").evaluate("(x) => x.classList.contains('active')"), f"{width}: 明細連結失效"
            assert not errors, (width, errors)
            print(f"PASS: {width}px，住宿右欄、詳情、無溢出、無腳本錯誤")
            await page.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
