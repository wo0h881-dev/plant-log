/* eslint-disable @typescript-eslint/no-require-imports -- Browser layout regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/clean-profile"); await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" }); page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: "무늬 프라이덱 그린벨벳 화이트핑크", category: "알로카시아", coverPhotoUrl: "/fixture/cover.png", wateringCycleDays: 4, currentSoils: ["세라미스", "펄라이트"] };
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()); let data = {};
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { plants: [plant], source: "notion" };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [{ id: "photo", name: plant.name, url: "/fixture/recent.png", date: today }], observations: [{ id: "obs", date: today, tags: ["신엽"], note: "새 잎을 확인했어요." }] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 3, recentIntervals: 2, averageDays: 4, recentAverageDays: 4, lastWateredAt: today };
        else if (url.pathname === "/api/calendar") data = { events: ["watering", "observation", "repotting"].map((type) => ({ id: type, type, date: today, plantId: plant.id, plantName: plant.name, note: type === "watering" ? "" : `${type} 메모`, tags: ["신엽"] })) };
        else if (url.pathname === "/api/location-logs") data = { source: "notion", state: { positions: {}, history: [], labels: {} } };
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForFunction(() => !document.querySelector(".header-date").disabled);
      assert.equal(await page.locator(".header-date-pill > span").textContent(), today.replaceAll("-", "."));
      await page.getByLabel("물 준 날짜", { exact: true }).fill("2026-10-02");
      assert.equal(await page.locator(".header-date-pill > span").textContent(), "2026.10.02");
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      assert.equal(await nav.locator(".nav-add .nav-asset").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(145, 153, 166)");
      await nav.getByRole("button", { name: "빠른 작업", exact: true }).click();
      const add = page.getByRole("dialog", { name: "추가", exact: true });
      assert.equal(await add.getByRole("heading").count(), 0); assert.equal(await add.getByRole("button").count(), 2);
      await page.screenshot({ path: path.join(out, `add-${width}.png`) });
      await page.keyboard.press("Escape");
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      assert.ok((await nav.getByRole("button", { name: "내 식물", exact: true }).locator(".nav-asset").getAttribute("style")).includes("heart5-filled"));
      const search = page.locator(".app-header").getByRole("searchbox");
      const before = await search.boundingBox();
      assert.equal(await search.evaluate((el) => getComputedStyle(el).fontSize), "16px");
      await search.fill(plant.name);
      const after = await search.boundingBox(); assert.equal(before.height, after.height); assert.equal(before.width, after.width);
      await page.locator(".app-header").getByRole("button", { name: new RegExp(plant.name) }).click();
      const profile = page.locator('[data-screen="profile"]');
      await profile.locator(".editorial-entry").waitFor();
      const text = await profile.locator(".profile-card").boundingBox(); const photo = await profile.locator(".detail-photo").boundingBox();
      assert.ok(Math.abs(text.height - photo.height) < 2, `heights ${text.height}/${photo.height}`);
      assert.equal(await profile.locator(".plant-profile-panel .profile-care").count(), 1);
      const order = await profile.locator(".editorial-entry").first().evaluate((el) => ({ time: el.querySelector("time").getBoundingClientRect().y, tag: el.querySelector("h3").getBoundingClientRect().y, note: el.querySelector("p").getBoundingClientRect().y }));
      assert.ok(order.time < order.tag && order.tag < order.note);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      await nav.getByRole("button", { name: "캘린더", exact: true }).click();
      const calendar = page.locator('[data-screen="more"]'); await calendar.locator(".calendar-event-tile").first().waitFor();
      for (const tile of await calendar.locator(".calendar-event-tile").all()) {
        const lines = await tile.locator(":scope > span").allTextContents();
        assert.equal(lines.length, 3); assert.ok(!lines.slice(1).some((line) => ["물주기", "분갈이", "관찰일지", "신엽"].includes(line)));
      }
      await page.getByRole("button", { name: "식물방 열기", exact: true }).click();
      await page.getByRole("button", { name: "캘린더로 돌아가기", exact: true }).click();
      assert.equal(await nav.getByRole("button", { name: "캘린더", exact: true }).getAttribute("aria-current"), "page");
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, `calendar-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []); await page.context().close();
    }
    const future = await browser.newPage({ serviceWorkers: "block" });
    const dateErrors = []; future.on("pageerror", (error) => dateErrors.push(error.message));
    await future.clock.install({ time: new Date("2026-11-01T03:00:00Z") });
    await future.route("**/api/**", (route) => route.fulfill({ json: { plants: [], recentPlants: [] } }));
    await future.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
    await future.waitForFunction(() => document.querySelector(".header-date-pill > span")?.textContent === "2026.11.01");
    assert.deepEqual(dateErrors, []); await future.context().close();
    console.log("PASS: compact date picker and post-deployment date hydration, heart/plus icons, headerless add modal, fixed 16px search, matched profile/photo heights, contained vertical care, date-tag-note timeline, clean calendar tiles and room return at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
