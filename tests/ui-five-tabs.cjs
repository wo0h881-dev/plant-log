/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/five-tabs");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [390, 320, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: "무늬 프라이덱 그린벨벳", category: "알로카시아", coverPhotoUrl: "/fixture/cover.jpg", wateringCycleDays: 2, daysSinceWatered: 3, isWateringDue: true };
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()); let data = {};
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { plants: [plant], source: "notion" };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [{ id: "photo", name: plant.name, url: plant.coverPhotoUrl, date: today }], observations: [{ id: "entry", date: today, tags: ["신엽"], note: "새 잎의 변화를 기록합니다." }] };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        else if (url.pathname === "/api/calendar") data = { events: ["watering", "observation", "repotting"].map((type) => ({ id: type, plantId: plant.id, plantName: plant.name, type, date: today })) };
        else if (url.pathname === "/api/location-logs") data = { source: "notion", state: { positions: {}, history: [], labels: {} } };
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded" });
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      assert.deepEqual(await nav.locator("button").allTextContents(), ["물주기", "관찰일지", "", "내 식물", "캘린더"]);
      const water = page.locator('[data-screen="water"]');
      await water.getByRole("button", { name: `${plant.name} 캘린더 보기`, exact: true }).click();
      await page.locator('.app-header input[type="search"]').waitFor();
      assert.equal(await page.locator('.app-header input[type="search"]').inputValue(), plant.name);
      const palette = await page.locator(".calendar-legend .calendar-dot").evaluateAll((dots) => dots.map((dot) => getComputedStyle(dot).backgroundColor));
      assert.equal(new Set(palette).size, 3);
      await page.locator('.app-header input[type="search"]').click();
      await page.locator('.app-header').getByRole("button", { name: new RegExp(plant.name) }).filter({ has: page.locator("img") }).first().waitFor();
      await page.screenshot({ path: path.join(out, `calendar-${width}.png`), fullPage: true });
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      await page.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
      const observation = page.locator('[data-screen="observation"]');
      await observation.getByRole("button", { name: new RegExp(plant.name) }).filter({ has: page.locator("img") }).first().click();
      await page.evaluate(() => window.scrollTo(0, 400));
      assert.equal(Math.round((await page.locator(".app-header").boundingBox()).y), 0);
      await page.screenshot({ path: path.join(out, `observation-${width}.png`), fullPage: true });
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      const profile = page.locator('[data-screen="profile"]');
      await page.locator('.app-header').getByRole("searchbox").fill(plant.name);
      await page.locator('.app-header').getByRole("button", { name: new RegExp(plant.name) }).filter({ has: page.locator("img") }).first().click();
      await profile.locator(".editorial-title").waitFor();
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "식물방 열기", exact: true }).click();
      await page.locator(".spaces-embedded .space-isometric canvas").waitFor();
      assert.equal(await page.locator(".app-header h1").textContent(), "식물방");
      assert.equal(await page.locator("h1:visible").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      const navBox = await nav.boundingBox();
      assert.ok(navBox.x >= 0 && navBox.x + navBox.width <= width + 1);
      await page.screenshot({ path: path.join(out, `spaces-${width}.png`), fullPage: true });
      await nav.getByRole("button", { name: "물주기", exact: true }).click();
      assert.equal(await water.getByRole("checkbox").first().getAttribute("aria-checked"), "false");
      await water.getByRole("checkbox").first().click();
      assert.equal(await water.getByRole("checkbox").first().getAttribute("aria-checked"), "true");
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: four tabs and central add action, sticky header, search cover icons, watering/calendar actions, distinct event palette, profile and header room shortcut at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
