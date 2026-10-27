/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression test. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/profile-actions");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아", coverPhotoUrl: "/fixture/cover.jpg", wateringCycleDays: 2, isWateringDue: true };
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      let watering; let observation; let edit; let failWatering = true;
      await page.route("**/api/**", async (route) => {
        const req = route.request(); const url = new URL(req.url()); let data = {};
        if (url.pathname === "/api/plants") {
          if (req.method() === "PATCH") { edit = req.postDataJSON(); Object.assign(plant, edit); data = { plant }; }
          else data = { plants: [plant], source: "notion" };
        } else if (url.pathname === "/api/watering-logs") {
          if (req.method() === "POST" && failWatering) { failWatering = false; return route.fulfill({ json: { successCount: 0, failureCount: 1, results: [{ plantId: plant.id, plantName: plant.name, ok: false }] } }); }
          if (req.method() === "POST") { watering = req.postDataJSON(); data = { successCount: 1, results: [{ plantId: plant.id, plantName: plant.name, ok: true }] }; }
          else data = { plants: [] };
        } else if (url.pathname === "/api/plant-logs") { if (req.method() === "POST") observation = req.postData(); data = {}; }
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [], observations: [] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        await route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      assert.equal(await page.locator(".app-header h1").evaluate((el) => getComputedStyle(el).textAlign), "left");
      const box = await nav.boundingBox(); assert.equal(Math.round(box.y + box.height), 832);
      assert.equal(await nav.locator("button").nth(2).getAttribute("aria-label"), "빠른 작업");
      await page.locator('[data-screen="water"]').getByRole("checkbox").first().waitFor();
      await page.getByRole("button", { name: /관수주기 편집/ }).click();
      await page.getByText("물주기 목록에서 편집할 식물의 체크박스를 먼저 선택해주세요.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      await page.getByLabel("물 준 날짜", { exact: true }).fill("2026-10-01");
      await page.locator('[data-screen="water"]').getByRole("checkbox").first().click();
      await page.getByRole("button", { name: /물주기 저장/ }).click();
      await page.getByRole("button", { name: "실패한 1개 다시 저장", exact: true }).waitFor();
      assert.equal(await page.locator('[data-screen="water"]').getByRole("checkbox", { checked: true }).count(), 1);
      await page.getByRole("button", { name: "실패한 1개 다시 저장", exact: true }).click();
      await page.waitForFunction(() => document.body.textContent.includes("1개 식물의 물주기를 저장했습니다."));
      assert.equal(watering.wateredAt, "2026-10-01");
      assert.equal(await page.locator('[data-screen="water"]').getByRole("checkbox", { checked: true }).count(), 0);
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      await page.getByLabel("관찰 날짜", { exact: true }).fill("2026-10-02");
      await page.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
      await page.locator('[data-screen="observation"]').getByRole("button", { name: /밤비노 핑크/ }).click();
      await page.getByRole("button", { name: "관찰태그", exact: true }).click();
      const sheet = page.getByRole("dialog", { name: "관찰태그", exact: true });
      assert.ok((await sheet.boundingBox()).y > 0);
      await sheet.getByRole("button", { name: "신엽", exact: true }).click();
      await page.screenshot({ path: path.join(out, `tags-${width}.png`) });
      await sheet.getByRole("button", { name: /선택 완료/ }).click();
      await page.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
      await page.waitForFunction(() => document.body.textContent.includes("관찰일지를 Notion에 저장했습니다."));
      assert.ok(observation.includes('name="createdAt"\r\n\r\n2026-10-02'));
      assert.ok(observation.includes("신엽"));
      await page.getByRole("button", { name: "식물을 선택하세요", exact: true }).waitFor();
      assert.equal(await page.getByLabel("메모", { exact: true }).inputValue(), "");
      assert.equal(await page.locator('[data-screen="observation"] .status-chips button[aria-pressed="true"]').count(), 0);
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      await page.locator('.app-header').getByRole("searchbox").fill(plant.name);
      await page.locator('.app-header').getByRole("button", { name: /밤비노 핑크/ }).click();
      await page.getByRole("button", { name: "프로필 편집 메뉴", exact: true }).click();
      await page.getByRole("button", { name: "식물 이름 편집", exact: true }).click();
      await page.getByLabel("새 식물명", { exact: true }).fill("밤비노 핑크 1");
      await page.getByRole("button", { name: "이름 변경 저장", exact: true }).click();
      await page.getByText("이름을 변경했습니다.", { exact: true }).waitFor();
      assert.equal(edit.name, "밤비노 핑크 1");
      await page.getByRole("button", { name: "식물 이름 편집 닫기", exact: true }).click();
      await page.getByRole("button", { name: "프로필 편집 메뉴", exact: true }).click();
      await page.getByRole("button", { name: "관수 주기 편집", exact: true }).click();
      await page.getByLabel("관수 주기 (일)", { exact: true }).fill("5");
      await page.getByRole("button", { name: "관수 주기 저장", exact: true }).click();
      await page.getByText("관수 주기를 변경했습니다.", { exact: true }).waitFor();
      assert.equal(edit.wateringCycleDays, 5);
      await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "빠른 작업", exact: true }).click();
      await page.getByRole("button", { name: "새 식물 추가", exact: true }).click();
      await page.getByRole("heading", { name: "새 식물", exact: true }).waitFor();
      await page.getByRole("button", { name: "식물 등록 닫기", exact: true }).click();
      await page.getByRole("button", { name: "빠른 작업", exact: true }).click();
      await page.getByRole("button", { name: "관찰일지 추가", exact: true }).click();
      assert.equal(await nav.getByRole("button", { name: "관찰일지", exact: true }).getAttribute("aria-current"), "page");
      await page.getByRole("button", { name: "빠른 작업", exact: true }).click(); await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: header dates save correctly, floating navigation with central add action, tag sheet, profile popover/edit, global cycle/add/observation actions, Escape/focus/scroll cleanup at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
