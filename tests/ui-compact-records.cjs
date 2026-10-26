/* eslint-disable @typescript-eslint/no-require-imports -- Browser layout and filtering checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/compact-records");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plants = [{ id: "one", name: "프라이덱", category: "알로카시아", coverPhotoUrl: "/fixture/one.png", isWateringDue: true }, { id: "two", name: "밤비노 핑크", category: "알로카시아", coverPhotoUrl: "/fixture/two.png" }];
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()); let data = {};
        if (url.pathname === "/api/plants") data = { plants, source: "notion" };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { observations: [], photos: [{ id: "photo", name: "관찰 사진", url: "/fixture/photo.png", date: today }] } : { recentPlants: plants.map((plant) => ({ plantId: plant.id, plantName: plant.name, plantCategory: plant.category, observedAt: today })) };
        else if (url.pathname === "/api/calendar") data = { events: ["watering", "observation", "repotting"].map((type, index) => ({ id: type, type, date: today, plantId: plants[index % 2].id, plantName: plants[index % 2].name, note: `${type} 상세 기록`, tags: type === "observation" ? ["신엽"] : [] })) };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      await page.waitForFunction(() => !document.querySelector(".header-date").disabled);
      assert.deepEqual(await nav.locator("button").allTextContents(), ["", "", "", "", ""]);
      assert.equal(await page.locator(".header-date").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(238, 242, 255)");
      const dateBox = await page.locator(".header-date").boundingBox();
      const cycleBox = await page.locator(".header-cycle-button").boundingBox();
      assert.equal(dateBox.height, cycleBox.height);
      assert.ok(dateBox.x + dateBox.width <= width);
      await page.getByRole("button", { name: /물줄 때 된 식물/ }).click();
      assert.equal(await page.locator(".due-panel-list").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      const input = page.locator(".app-header").getByRole("searchbox");
      assert.equal(await input.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
      await input.click(); assert.equal(await input.getAttribute("data-expanded"), "true");
      await input.click(); assert.equal(await input.getAttribute("data-expanded"), "false");
      await input.click(); assert.equal(await input.getAttribute("data-expanded"), "true");
      await page.locator(".app-header").getByRole("button", { name: /프라이덱/ }).click();
      assert.equal(await input.getAttribute("data-expanded"), "false");
      await page.locator(".app-header").getByRole("button", { name: "검색어 지우기", exact: true }).click();
      await page.keyboard.press("Escape");
      const recent = page.locator('[data-screen="profile"]');
      const tile = recent.getByRole("button", { name: "프라이덱 식물 상세 보기", exact: true });
      await tile.locator("img").waitFor(); assert.ok((await tile.boundingBox()).width <= 72);
      const caption = recent.locator(".featured-caption");
      await caption.waitFor();
      const photoBox = await recent.locator(".recent-featured .detail-photo").boundingBox();
      const captionBox = await caption.boundingBox();
      assert.ok(captionBox.y >= photoBox.y && captionBox.y + captionBox.height <= photoBox.y + photoBox.height + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      await recent.getByRole("button", { name: /전체보기/ }).click();
      await recent.locator(".plant-icon-grid").getByRole("button").first().waitFor();
      await nav.getByRole("button", { name: "캘린더", exact: true }).click();
      const calendar = page.locator('[data-screen="more"]');
      await calendar.locator(".calendar-event-tile").first().waitFor();
      assert.equal(await calendar.locator(".calendar-event-tile").count(), 3);
      for (const [label, type] of [["물주기", "watering"], ["관찰일지", "observation"], ["분갈이", "repotting"]]) {
        await calendar.getByRole("tab", { name: label, exact: true }).click();
        assert.equal(await calendar.locator(".calendar-event-tile").count(), 1);
        assert.equal(await calendar.locator(".calendar-event-tile").getAttribute("data-event-type"), type);
        await calendar.locator(".calendar-event-tile img").waitFor();
      }
      await calendar.getByRole("tab", { name: "전체", exact: true }).click();
      await page.keyboard.press("ArrowRight");
      assert.equal(await calendar.getByRole("tab", { name: "물주기", exact: true }).getAttribute("aria-selected"), "true");
      await calendar.getByRole("tab", { name: "전체", exact: true }).click();
      assert.equal(await calendar.locator(".calendar-event-tile").count(), 3);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `calendar-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: pill dates, icon-only navigation, white due list, toggleable white header search, compact recent/calendar tiles, photo caption and keyboard-accessible event filters at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
