/* eslint-disable @typescript-eslint/no-require-imports -- Owned-app mocked integration tests. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://localhost:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/room-notices");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [280, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plants = [
        { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아" },
        { id: "22222222-2222-4222-8222-222222222222", name: "무늬 프라이덱", category: "알로카시아" },
        { id: "33333333-3333-4333-8333-333333333333", name: "지난 식물", category: "사망" },
      ];
      const state = { version: 1, positions: { [plants[0].id]: "left-five:2", [plants[1].id]: "lerberg:1" }, history: [], labels: {}, environments: [], commonCare: [] };
      let apiReads = 0; const writes = []; let fail = true;
      await page.route("**/api/**", async (route) => {
        const req = route.request(), url = new URL(req.url()); let data = {};
        if (req.method() === "GET") apiReads++;
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { plants, source: "notion" };
        else if (url.pathname === "/api/location-logs") {
          if (req.method() === "POST") {
            const input = req.postDataJSON(); writes.push(input);
            if (fail) { fail = false; return route.fulfill({ status: 503, json: {} }); }
            state.commonCare.push({ id: "common", date: input.date, recordedAt: new Date().toISOString(), title: input.title, note: input.note, excludedPlantIds: input.excludedPlantIds });
          }
          data = { source: "notion", success: true, state };
        } else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [], observations: [{ id: "obs", date: "2026-10-27", tags: ["신엽"], note: "개별 관찰" }] };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        await route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('[data-screen="water"]').getByRole("checkbox").first().waitFor();
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      await page.getByLabel("관찰 날짜", { exact: true }).fill("2026-10-27");
      await page.getByLabel("메모", { exact: true }).fill("개별 기록 초안");
      const header = page.locator(".app-header");
      const noticeBox = await header.getByRole("button", { name: "전체 공지", exact: true }).boundingBox();
      const dateBox = await header.locator(".header-date-pill").boundingBox();
      assert.ok(noticeBox.x + noticeBox.width <= dateBox.x && dateBox.x + dateBox.width <= width);
      await header.getByRole("button", { name: "전체 공지", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "전체 공지", exact: true });
      assert.equal(await dialog.getByLabel("기록 날짜").inputValue(), "2026-10-27");
      await dialog.getByLabel("공지 제목", { exact: true }).fill("공동 해충 관리");
      await dialog.getByLabel("메모", { exact: true }).fill("처리 내역");
      await dialog.locator("summary").click();
      const search = dialog.getByRole("searchbox", { name: "공지 제외 식물 검색", exact: true });
      await search.fill("ㅂㅂㄴ");
      assert.ok(await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
      await dialog.getByRole("checkbox", { name: "밤비노 핑크 공지 제외", exact: true }).check();
      await search.fill("사망"); assert.equal(await dialog.getByRole("checkbox").count(), 0);
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await dialog.getByRole("alert").waitFor();
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await page.getByText("전체 공지를 저장했어요.", { exact: true }).waitFor();
      assert.equal(writes.length, 2); assert.equal(writes[0].operationId, writes[1].operationId);
      assert.deepEqual(writes[1].excludedPlantIds, [plants[0].id]); assert.equal(state.commonCare.length, 1);
      assert.equal(await page.getByLabel("메모", { exact: true }).inputValue(), "개별 기록 초안");
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      const profileSearch = header.getByRole("searchbox");
      await profileSearch.fill(plants[0].name); await header.getByRole("button", { name: /밤비노 핑크/ }).click();
      await page.locator(".editorial-journal").getByText("개별 관찰", { exact: true }).waitFor();
      assert.equal(await page.locator(".editorial-journal").getByText("공동 해충 관리", { exact: false }).count(), 0);
      await profileSearch.fill(plants[1].name); await header.getByRole("button", { name: /무늬 프라이덱/ }).click();
      await page.locator(".editorial-journal").getByText("공동 해충 관리", { exact: false }).waitFor();
      await page.getByRole("button", { name: "식물방 열기", exact: true }).click();
      const room = page.locator('[data-screen="spaces"]');
      const plan = room.getByRole("group", { name: "식물방 2.5D 배치도" });
      await plan.locator("canvas").waitFor();
      await page.waitForFunction(() => document.querySelector('[data-rack="center-white-1"]')?.style.left?.endsWith("px"));
      assert.equal(await room.getByRole("button", { name: "공통 기록 추가", exact: true }).count(), 0);
      assert.equal(await plan.locator(".room-rack-label").count(), 7);
      const groups = [["left-three", "3단장", 3], ["left-five", "5단장", 5], ["center-white-1", "흰색 5단장 1", 5], ["center-white-2", "흰색 5단장 2", 5], ["lerberg", "레르베리", 4], ["right-trolley", "3단 트롤리", 3], ["right-black", "검은색장", 2]];
      for (const [id, name, levels] of groups) {
        await room.locator(".spaces-group-tabs").getByRole("button", { name, exact: true }).click();
        assert.equal(await plan.locator(".space-pin").count(), levels);
        await plan.locator(`[data-zone="${id}:${levels}"]`).click();
        assert.equal(await plan.locator(`[data-zone="${id}:${levels}"]`).getAttribute("aria-pressed"), "true");
      }
      await room.locator(".spaces-group-tabs").getByRole("button", { name: "흰색 5단장 1", exact: true }).click();
      await plan.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-count-zone="center-white-1:1"]')?.style.left?.endsWith("px"));
      await plan.screenshot({ path: path.join(out, `room-labels-${width}.png`) });
      const counterBoxes = await plan.locator(".space-zone-count").evaluateAll((items) => items.map((item) => { const box = item.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }).sort((a, b) => a.top - b.top));
      for (let index = 1; index < counterBoxes.length; index++) assert.ok(counterBoxes[index].top >= counterBoxes[index - 1].bottom - 1, `shelf count labels must not overlap: ${JSON.stringify(counterBoxes)}`);
      const pixels = async () => plan.locator("canvas").evaluate((source) => {
        const copy = document.createElement("canvas"); copy.width = source.width; copy.height = source.height;
        const ctx = copy.getContext("2d"); ctx.drawImage(source, 0, 0);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data; let dark = 0, hash = 0;
        for (let i = 0; i < data.length; i += 16) { if (data[i] < 160) dark++; hash = (Math.imul(hash, 31) + data[i] + data[i + 1]) | 0; }
        return { dark, hash };
      });
      const first = await pixels(); assert.ok(first.dark > 150, `blank canvas: ${JSON.stringify(first)}`);
      await plan.screenshot({ path: path.join(out, `room-default-${width}.png`) });
      const reads = apiReads;
      await plan.getByRole("button", { name: "식물방 왼쪽 회전", exact: true }).click();
      await page.waitForTimeout(150);
      const second = await pixels(); assert.notEqual(first.hash, second.hash, "rotation must change the scene");
      await page.waitForTimeout(150); assert.equal((await pixels()).hash, second.hash, "idle scene stays still");
      assert.equal(apiReads, reads, "rotating the room does not call the server");
      assert.deepEqual(state.positions, { [plants[0].id]: "left-five:2", [plants[1].id]: "lerberg:1" });
      await plan.screenshot({ path: path.join(out, `room-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: seven racks/27 slots, preserved original positions, nonblank interactive idle-stable 3D room, observation-header notices, searchable exclusions, retry deduplication, draft preservation, filtered timelines and responsive layout");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
