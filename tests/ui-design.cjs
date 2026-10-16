/* eslint-disable @typescript-eslint/no-require-imports -- Read-only visual and responsive checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa-design");
    await fs.mkdir(out, { recursive: true });
    const live = process.env.LIVE_BASE;
    const payloads = new Map();
    const plant = { id: "11111111-1111-4111-8111-111111111111", name: "무늬 프라이덱 그린벨벳", category: "알로카시아", isWateringDue: true, coverPhotoUrl: "/icon.svg", wateringCycleDays: 4, currentSoils: ["세라미스", "펄라이트"] };
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      assert.equal(req.method(), "GET", "Visual checks must never modify Notion data");
      const url = new URL(req.url());
      const endpoint = `${url.pathname}${url.search}`;
      if (live) {
        if (!payloads.has(endpoint)) {
          const response = await page.request.get(`${live}${endpoint}`, { timeout: 90000 });
          assert.ok(response.ok(), `${endpoint}: ${response.status()}`);
          payloads.set(endpoint, await response.json());
        }
        return route.fulfill({ json: payloads.get(endpoint) });
      }
      let data = {};
      if (url.pathname === "/api/plants") data = { plants: [plant], source: "notion" };
      if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { photos: [], observations: [] } : { recentPlants: [{ plantId: plant.id, plantName: plant.name, observedAt: "2026-10-16" }] };
      if (url.pathname === "/api/watering-logs") data = { plants: [] };
      if (url.pathname === "/api/calendar") data = { events: [] };
      if (url.pathname === "/api/watering-stats") data = { wateringDays: 4, recentIntervals: 3, averageDays: 5, recentAverageDays: 5 };
      return route.fulfill({ json: data });
    });
    const recentResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/plant-details");
    await page.goto(process.env.APP_URL || "http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });
    await recentResponse;
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: /물줄 때 된 식물/ }).waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.body.textContent.includes("물줄 식물을확인하고 있어요"));
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(out, "design-water.png") });
    const hero = page.getByRole("button", { name: /물줄 때 된 식물/ });
    const collapsedHeight = (await hero.boundingBox()).height;
    await hero.click();
    await page.waitForFunction(() => document.querySelector('button[aria-expanded="true"]')?.getBoundingClientRect().height <= 117);
    assert.ok((await hero.boundingBox()).height < collapsedHeight);
    const check = page.getByRole("checkbox").first();
    if (await check.count()) {
      await check.click();
      const save = page.getByRole("button", { name: /개 물주기 저장/ });
      const button = await save.boundingBox();
      const nav = await page.getByRole("navigation").boundingBox();
      assert.ok(button.y + button.height <= nav.y, "Save button overlaps navigation");
    }
    await page.screenshot({ path: path.join(out, "design-water-open.png") });
    const nav = page.getByRole("navigation");
    assert.deepEqual(await nav.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.lastElementChild.textContent)), ["물주기", "관찰일지", "내 식물", "캘린더"]);
    for (const [label, file] of [["관찰일지", "observation"], ["내 식물", "plants"], ["캘린더", "calendar"]]) {
      await nav.getByRole("button", { name: label, exact: true }).click();
      if (label === "내 식물") {
        await page.getByRole("heading", { name: "최근 관찰한 식물", exact: true }).waitFor();
        await page.locator("[data-screen]:not([hidden])").getByText("사진 확인 중", { exact: true }).waitFor({ state: "detached" });
      }
      if (label === "캘린더") await page.getByText("기록을 불러오는 중...", { exact: true }).waitFor({ state: "detached" });
      await page.waitForLoadState("networkidle");
      await page.locator("[data-screen]:not([hidden]) img").evaluateAll(async (images) => Promise.all(images.map((image) => image.decode().catch(() => {}))));
      await page.waitForFunction(() => [...document.querySelectorAll('[data-screen]:not([hidden]) img')].every((image) => getComputedStyle(image).opacity === "1" || image.complete && image.naturalWidth === 0));
      await page.screenshot({ path: path.join(out, `design-${file}.png`) });
      for (const width of [320, 390, 430, 768]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label} overflows at ${width}`);
        const dock = await nav.boundingBox();
        assert.ok(dock.x >= 16 && dock.width <= 408, "Navigation must float inside the screen");
        assert.equal(await nav.locator('.nav-label[aria-hidden="false"]').count(), 1);
        assert.equal(await nav.locator('.nav-label[aria-hidden="false"]').innerText(), label);
        const tabs = await nav.getByRole("button").evaluateAll((buttons) => buttons.map((button) => ({ label: button.getAttribute("aria-label"), height: button.getBoundingClientRect().height, iconTop: button.querySelector("svg").getBoundingClientRect().top })));
        assert.deepEqual(tabs.map((tab) => tab.label), ["물주기", "관찰일지", "내 식물", "캘린더"]);
        assert.ok(tabs.every((tab) => tab.height >= 44 && Math.abs(tab.iconTop - tabs[0].iconTop) < 1), "Touch targets or icon alignment changed");
        const input = page.locator("[data-screen]:not([hidden])").getByPlaceholder("식물 검색");
        if (await input.count()) assert.ok(await input.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft) >= 40));
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: four screens, 320/390/430/768 widths, shrinking summary, save/nav separation, search icon spacing. Screenshots: ${out}`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
