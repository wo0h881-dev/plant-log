/* eslint-disable @typescript-eslint/no-require-imports -- Mocked browser workflow; never writes to Notion. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://localhost:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/room-records");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plant = { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아" };
      const state = { version: 1, positions: {}, history: [], environments: [], commonCare: [] };
      const writes = []; let failFirst = true;
      await page.route("**/api/**", async (route) => {
        const req = route.request(); const url = new URL(req.url()); let data = {};
        if (["/api/plants", "/api/space-plants"].includes(url.pathname)) data = { source: "notion", plants: [plant] };
        else if (url.pathname === "/api/location-logs") {
          if (req.method() === "POST") {
            const input = req.postDataJSON(); writes.push(input);
            if (input.kind === "environment" && failFirst) { failFirst = false; return route.fulfill({ status: 503, json: { message: "fixture failure" } }); }
            const common = { id: input.operationId, date: input.date, recordedAt: new Date().toISOString() };
            if (input.kind === "environment") state.environments.push({ ...common, locationId: input.locationId, ...input.environment });
            else if (input.kind === "common") state.commonCare.push({ ...common, title: input.title, note: input.note });
            else {
              const environment = {};
              for (const item of state.environments.filter((record) => record.locationId === input.destination && record.date <= input.date)) Object.assign(environment, { ...(item.temperature !== undefined ? { temperature: item.temperature } : {}), ...(item.humidity !== undefined ? { humidity: item.humidity } : {}) });
              state.history.unshift({ ...common, plantId: plant.id, plantName: plant.name, from: state.positions[plant.id] || null, to: input.destination, reason: input.note, environment, destinationLabel: "5단장 · 미니온실 2번" });
              state.positions[plant.id] = input.destination;
              return route.fulfill({ json: { source: "notion", results: [{ plantId: plant.id, success: true }] } });
            }
          }
          data = { source: "notion", success: true, state };
        } else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [], observations: [{ id: "obs", date: "2026-10-25", tags: ["신엽"], note: "새 잎 확인" }] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 2, recentIntervals: 1, wateringDates: ["2026-10-24"], lastWateredAt: "2026-10-24" };
        else if (url.pathname === "/api/watering-logs") data = { plants: [] };
        await route.fulfill({ json: data });
      });
      await page.goto(`${base.replace(/\/$/, "")}/spaces`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByRole("button", { name: "5단장 선택", exact: true }).click();
      await page.getByRole("button", { name: "5단장 · 미니온실 2번", exact: true }).click();
      await page.getByRole("button", { name: "온습도 기록", exact: true }).click();
      let dialog = page.getByRole("dialog", { name: "공간 온습도 기록", exact: true });
      await dialog.getByLabel("공간 온도", { exact: true }).fill("26");
      await dialog.getByLabel("공간 습도", { exact: true }).fill("85");
      await dialog.getByLabel("기록 날짜", { exact: true }).fill("2026-10-23");
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await dialog.getByRole("alert").waitFor();
      assert.equal(await dialog.getByLabel("공간 온도", { exact: true }).inputValue(), "26");
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("dialog[open]"));
      assert.equal(writes[0].operationId, writes[1].operationId);
      await page.locator(".spaces-environment strong").getByText("26℃ / 85%", { exact: true }).waitFor();
      await page.getByRole("button", { name: "온습도 기록", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "공간 온습도 기록", exact: true });
      await dialog.getByLabel("공간 습도", { exact: true }).fill("90");
      await dialog.getByLabel("기록 날짜", { exact: true }).fill("2026-10-24");
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("dialog[open]"));
      await page.locator(".spaces-environment strong").getByText("26℃ / 90%", { exact: true }).waitFor();
      await page.getByRole("button", { name: /위치 미지정 1/ }).click();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "공간 이동", exact: true }).click();
      await page.getByLabel("옮길 공간").selectOption("left-five:2");
      await page.getByLabel("이동 날짜", { exact: true }).fill("2026-10-23");
      await page.getByText("5단장 · 미니온실 2번(26℃ / 85%)으로 이동", { exact: true }).waitFor();
      await page.getByRole("button", { name: "1개 식물 이동 기록", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "1개 식물 위치" }).waitFor();
      assert.deepEqual(state.history[0].environment, { temperature: 26, humidity: 85 });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('[data-screen="water"]').getByRole("checkbox").first().waitFor();
      await page.getByRole("navigation", { name: "주요 화면" }).getByRole("button", { name: "관찰일지", exact: true }).click();
      await page.locator(".app-header").getByRole("button", { name: "전체 공지", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "전체 공지", exact: true });
      await dialog.getByLabel("공지 제목", { exact: true }).fill("뿌리깍지벌레 발견");
      await dialog.getByLabel("메모", { exact: true }).fill("코니도 입제 처리");
      await dialog.getByLabel("기록 날짜", { exact: true }).fill("2026-10-24");
      await dialog.getByRole("button", { name: "기록 저장", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector("dialog[open]"));
      await page.goto(`${base.replace(/\/$/, "")}/spaces`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForFunction(() => document.querySelector(".spaces-environment button")?.disabled === false);
      await page.getByRole("button", { name: /관리 타임라인/ }).click();
      await page.locator(".spaces-history").getByText("전체 공지", { exact: true }).waitFor();
      assert.equal(state.commonCare.length, 1);
      await page.screenshot({ path: path.join(out, `room-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.goto(`${base.replace(/\/$/, "")}/?plant=${plant.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      const timeline = page.locator(".editorial-journal");
      await timeline.getByText("뿌리깍지벌레 발견", { exact: false }).waitFor();
      await timeline.getByText("5단장 · 미니온실 2번(26℃ / 85%)으로 이동", { exact: false }).waitFor();
      await timeline.getByText("새 잎 확인", { exact: true }).waitFor();
      assert.equal((await timeline.innerText()).includes("물줌"), false);
      assert.ok((await timeline.innerText()).includes("26℃ / 90%"));
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: room measurements/partial carry-forward, retry ID, historical move snapshots, single shared-care event, profile observation/location/common timeline without watering entries, mobile and desktop containment");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
