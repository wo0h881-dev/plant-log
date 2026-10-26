/* eslint-disable @typescript-eslint/no-require-imports -- Touch and overflow browser regressions. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/contained-carousel"); await fs.mkdir(out, { recursive: true });
  try {
    for (const [width, count] of [[280, 1], [320, 5], [390, 12], [430, 0], [1440, 7]]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, isMobile: width < 500, serviceWorkers: "block", reducedMotion: "reduce" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: `무늬 프라이덱 그린벨벳 ${"BotanicalRecord".repeat(3)}`, category: "알로카시아", coverPhotoUrl: count ? "/fixture/cover.png" : undefined, isWateringDue: true, wateringCycleDays: 3 };
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()); let data = {};
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { plants: [plant], source: "notion" };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [{ plantId: plant.id, plantName: plant.name, plantCategory: plant.category }], observations: [], photos: Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({ id: `photo-${i}`, name: plant.name, url: `/fixture/${i}.png`, date: "2026-10-26" })) };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        else if (url.pathname === "/api/calendar") data = { events: [] };
        else if (url.pathname === "/api/location-logs") data = { source: "notion", state: { positions: {}, history: [], labels: {} } };
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForFunction(() => !document.querySelector(".header-date").disabled);
      const date = page.locator(".header-date-pill");
      assert.equal(await date.locator("svg").count(), 1);
      const fit = await date.evaluate((el) => ({ width: el.getBoundingClientRect().width, content: el.querySelector("svg").getBoundingClientRect().width + el.querySelector("span").getBoundingClientRect().width }));
      assert.ok(fit.width - fit.content < 28, `date padding: ${JSON.stringify(fit)}`);
      const cycle = page.getByRole("button", { name: "관수주기 편집", exact: true });
      assert.equal(await cycle.innerText(), "관수주기"); assert.equal(await cycle.locator("svg").count(), 1);
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      await page.locator(".app-header").getByRole("searchbox").fill(plant.name);
      await page.locator(".app-header").getByRole("button", { name: new RegExp(plant.name) }).click();
      const profile = page.locator('[data-screen="profile"]');
      const carousel = profile.getByRole("region", { name: "식물 사진" }).or(profile.locator('[aria-roledescription="carousel"]'));
      await profile.getByText("아직 관찰 기록이 없어요.", { exact: true }).waitFor();
      const photo = profile.locator(".detail-photo");
      if (count > 1) {
        const frame = await photo.boundingBox();
        for (const button of await photo.locator(".carousel-controls button").all()) {
          const box = await button.boundingBox();
          assert.ok(box.x >= frame.x - 1 && box.x + box.width <= frame.x + frame.width + 1 && box.y >= frame.y && box.y + box.height <= frame.y + frame.height + 1, `control escaped: ${JSON.stringify({ frame, box })}`);
        }
        await profile.getByRole("button", { name: "다음 캐러셀 사진", exact: true }).click();
        await profile.locator(".carousel-counter").filter({ hasText: `2 / ${count}` }).waitFor();
        await profile.getByRole("button", { name: "이전 캐러셀 사진", exact: true }).click();
        await profile.locator(".carousel-counter").filter({ hasText: `1 / ${count}` }).waitFor();
        const frameAfterScroll = await photo.boundingBox();
        const cdp = await page.context().newCDPSession(page);
        const y = frameAfterScroll.y + frameAfterScroll.height * .45;
        const startX = frameAfterScroll.x + frameAfterScroll.width * .85;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
        for (let step = 1; step <= 10; step++) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX - frameAfterScroll.width * .72 * step / 10, y }] });
          await page.evaluate(() => new Promise(requestAnimationFrame));
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => {
          const track = document.querySelector('[data-screen="profile"] .carousel-track');
          const counter = document.querySelector('[data-screen="profile"] .carousel-counter');
          return track.scrollLeft >= track.clientWidth * .9 && Number(counter.textContent.trim().split("/")[0]) > 1;
        });
        assert.equal(await page.getByRole("dialog").count(), 0, "swiping must not open gallery");
        await cdp.detach();
      } else assert.equal(await carousel.locator(".carousel-controls").count(), 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `profile-${width}-${count}.png`), fullPage: true });
      for (const tab of ["물주기", "관찰일지", "내 식물", "캘린더"]) {
        await nav.getByRole("button", { name: tab, exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${tab} document overflow at ${width}`);
        const escaped = await page.locator(".app-shell").evaluate((shell) => {
          const root = shell.getBoundingClientRect();
          return [...shell.querySelectorAll("button,input,select,textarea,h1,h2,h3,p")].filter((el) => {
            if (!el.getClientRects().length || !el.checkVisibility()) return false;
            let parent = el.parentElement;
            while (parent && parent !== shell) { const s = getComputedStyle(parent); if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX)) return false; parent = parent.parentElement; }
            const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < root.left - 1 || r.right > root.right + 1);
          }).map((el) => ({ tag: el.tagName, text: el.textContent.slice(0, 60) }));
        });
        assert.deepEqual(escaped, [], `${tab} content outside app at ${width}`);
      }
      await page.getByRole("button", { name: "식물방 열기", exact: true }).click();
      await page.locator(".spaces-embedded").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []); await page.context().close();
    }
    console.log("PASS: compact icon date/cycle pills, contained arrow/dot controls, native touch swiping, no accidental gallery opening, 0/1/5/7/12 photos and overflow checks across five screens at 280/320/390/430/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
