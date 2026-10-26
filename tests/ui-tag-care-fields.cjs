/* eslint-disable @typescript-eslint/no-require-imports -- Dialog care field and save regressions. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/tag-care-fields"); await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [280, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" }); page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: "찬트핑", category: "알로카시아", currentSoils: ["배흙"] };
      const saves = [];
      await page.route("**/api/**", (route) => {
        const req = route.request(); const url = new URL(req.url()); let data = {};
        if (url.pathname === "/api/plants") data = { plants: [plant], source: "notion" };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/options") data = { soilOptions: ["배흙", "수태", "세라미스"], observationTags: ["신엽", "분갈이", "온습도"] };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [] };
        else if (url.pathname === "/api/plant-logs" && req.method() === "POST") { saves.push(req.postData()); data = {}; }
        return route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForFunction(() => !document.querySelector(".header-date").disabled);
      assert.equal(await page.locator(".header-date-pill").evaluate((el) => getComputedStyle(el).paddingLeft), "10px");
      assert.equal(await page.locator(".header-cycle-button").evaluate((el) => getComputedStyle(el).paddingLeft), "11px");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      const obs = page.locator('[data-screen="observation"]');
      async function choosePlant() {
        await obs.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
        await obs.getByRole("button", { name: "찬트핑 알로카시아", exact: true }).click();
      }
      await choosePlant();
      await obs.getByRole("button", { name: "관찰태그", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "관찰태그", exact: true });
      await dialog.getByRole("button", { name: "분갈이", exact: true }).click();
      await dialog.getByRole("button", { name: "온습도", exact: true }).click();
      await dialog.getByRole("button", { name: "세라미스", exact: true }).click();
      await dialog.getByLabel("분갈이 이유", { exact: true }).fill("뿌리무름");
      await dialog.getByLabel("온도 (°C)", { exact: true }).fill("25");
      await dialog.getByLabel("습도 (%)", { exact: true }).fill("80");
      await dialog.getByRole("checkbox", { name: "이상", exact: true }).nth(0).check();
      await dialog.getByRole("checkbox", { name: "이상", exact: true }).nth(1).check();
      await page.screenshot({ path: path.join(out, `tag-details-${width}.png`), fullPage: true });
      await dialog.getByRole("button", { name: /선택 완료/ }).click();
      assert.equal(await obs.getByLabel("온도 (°C)", { exact: true }).count(), 0);
      assert.equal(await obs.getByLabel("분갈이 이유", { exact: true }).count(), 0);
      await obs.getByRole("button", { name: /관찰태그/ }).click();
      assert.equal(await dialog.getByLabel("온도 (°C)", { exact: true }).inputValue(), "25");
      assert.equal(await dialog.getByLabel("분갈이 이유", { exact: true }).inputValue(), "뿌리무름");
      await dialog.getByRole("button", { name: /선택 완료/ }).click();
      await obs.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
      await obs.getByText("관찰일지와 분갈이 기록을 Notion에 저장했습니다.", { exact: true }).waitFor();
      for (const text of ["세라미스", "뿌리무름", 'name="temperature"\r\n\r\n25', 'name="humidity"\r\n\r\n80', 'name="temperatureAbove"\r\n\r\ntrue', 'name="humidityAbove"\r\n\r\ntrue']) assert.ok(saves[0].includes(text), text);
      await choosePlant();
      await obs.getByRole("button", { name: "관찰태그", exact: true }).click();
      await dialog.getByRole("button", { name: "온습도", exact: true }).click();
      assert.equal(await dialog.getByLabel("온도 (°C)", { exact: true }).inputValue(), "");
      await dialog.getByLabel("습도 (%)", { exact: true }).fill("120");
      await dialog.getByRole("button", { name: /선택 완료/ }).click();
      assert.ok(await dialog.isVisible(), "out-of-range values must keep the dialog open");
      await dialog.getByLabel("습도 (%)", { exact: true }).fill("75");
      await dialog.getByRole("button", { name: /선택 완료/ }).click();
      await obs.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
      await obs.getByText("관찰일지를 Notion에 저장했습니다.", { exact: true }).waitFor();
      assert.ok(saves[1].includes('name="humidity"\r\n\r\n75'));
      assert.ok(saves[1].includes('name="temperature"\r\n\r\n\r\n'));
      assert.deepEqual(errors, []); await page.context().close();
    }
    console.log("PASS: repot/environment fields live only in tag dialog, draft reopening/reset, soil/reason/temperature/humidity/above saves, humidity-only save and invalid range protection; header spacing fits 280/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
