/* eslint-disable @typescript-eslint/no-require-imports -- Search and mobile sizing regression tests. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://localhost:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/search-rules");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: "block", timezoneId: "Asia/Seoul", isMobile: width < 400, hasTouch: width < 400 });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-10-27T03:00:00Z") });
      const plants = [
        { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아", coverPhotoUrl: "/fixture/cover.png" },
        { id: "22222222-2222-4222-8222-222222222222", name: "떠난 식물", category: "사망" },
      ];
      await page.addInitScript(() => localStorage.setItem("plant-log:recent-plants", JSON.stringify(["사망 - 떠난 식물"])));
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/api/**", (route) => {
        const url = new URL(route.request().url()); let data = {};
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { source: "notion", plants };
        else if (url.pathname === "/api/location-logs") data = { source: "notion", state: { version: 1, positions: {}, history: [], commonCare: [], environments: [] } };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 1, recentIntervals: 0, wateringDates: ["2026-10-26"] };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [], observations: [{ id: "obs", date: "2026-10-27", note: "기존 관찰 기록 유지", tags: ["신엽"] }] };
        else if (url.pathname === "/api/options") data = { categoryOptions: ["알로카시아", "사망"] };
        else if (url.pathname === "/api/calendar") data = { events: [
          { id: "old-record", type: "observation", date: "2026-10-27", plantId: plants[1].id, plantName: plants[1].name, note: "과거 기록 보존" },
          { id: "legacy", type: "observation", date: "2026-10-27", plantName: plants[1].name, note: "관계형 없는 과거 기록 보존" },
        ] };
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      const water = page.locator('[data-screen="water"]');
      await water.getByRole("checkbox").waitFor();
      assert.equal(await water.getByRole("checkbox").count(), 1);
      await water.getByRole("searchbox").fill("떠난");
      assert.equal(await water.getByRole("checkbox").count(), 0);
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      const obs = page.locator('[data-screen="observation"]');
      await obs.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
      assert.equal(await obs.getByRole("button", { name: /떠난 식물/ }).count(), 0, "dead recent chips are hidden too");
      await obs.getByRole("searchbox").fill("떠난");
      assert.equal(await obs.getByRole("button", { name: /떠난 식물/ }).count(), 0);
      await nav.getByRole("button", { name: "캘린더", exact: true }).click();
      const headerSearch = page.locator(".app-header").getByRole("searchbox");
      await headerSearch.fill("떠난");
      assert.equal(await page.locator(".app-header").getByRole("button", { name: /떠난 식물/ }).count(), 0);
      assert.equal(await page.locator(".calendar-event-tile").count(), 0);
      await headerSearch.fill(""); await page.keyboard.press("Escape");
      await page.getByText("과거 기록 보존", { exact: true }).waitFor();
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      await headerSearch.fill("떠난");
      await page.locator(".app-header").getByRole("button", { name: /떠난 식물/ }).click();
      await page.locator(".editorial-journal").getByText("기존 관찰 기록 유지", { exact: true }).waitFor();
      assert.equal((await page.locator(".editorial-journal").innerText()).includes("물줌"), false);
      await nav.getByRole("button", { name: "빠른 작업", exact: true }).click();
      await page.getByRole("button", { name: "새 식물 추가", exact: true }).click();
      await page.getByRole("button", { name: "모주 선택 안 함", exact: true }).click();
      const mothers = page.getByRole("region", { name: "모주 선택", exact: true });
      await mothers.getByRole("searchbox").fill("떠난");
      assert.equal(await mothers.getByRole("checkbox").count(), 0);
      assert.ok(await mothers.getByRole("searchbox").evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
      await page.getByRole("button", { name: "식물 등록 닫기", exact: true }).click();
      await page.getByRole("button", { name: "식물방 열기", exact: true }).click();
      const room = page.locator('[data-screen="spaces"]');
      const search = room.getByRole("searchbox", { name: "이동할 식물 검색", exact: true });
      await room.getByRole("checkbox").waitFor();
      assert.equal(await room.getByRole("checkbox").count(), 1);
      await room.locator(".spaces-plant-row").first().scrollIntoViewIfNeeded();
      await room.locator(".spaces-plant-row img").waitFor();
      const before = await search.boundingBox();
      const scale = await page.evaluate(() => visualViewport.scale);
      await search.click();
      const after = await search.boundingBox();
      assert.equal(before.width, after.width); assert.equal(before.height, after.height);
      assert.equal(await page.evaluate(() => visualViewport.scale), scale);
      assert.ok(await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
      await search.fill("떠난");
      assert.equal(await room.getByRole("checkbox").count(), 0);
      await search.fill("ㅂㅂㄴ");
      await room.locator(".spaces-plant-row img").waitFor();
      assert.equal(await room.getByRole("checkbox").count(), 1);
      await page.screenshot({ path: path.join(out, `room-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: dead plants only in My Plants search; other search lists/recent chips exclude them, historic calendar records retained, room cover icons and initials search work, 16px stable focus sizing, no watering timeline entries");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
