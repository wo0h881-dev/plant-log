/* eslint-disable @typescript-eslint/no-require-imports -- Browser integration checks for the isolated local trial. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const directory = path.resolve(__dirname, "../../artifacts/plant-spaces");
  await fs.mkdir(directory, { recursive: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block", isMobile: viewport.width === 390, hasTouch: viewport.width === 390 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const writes = [];
      await page.route("**/api/**", async (route) => {
        if (route.request().method() !== "GET") writes.push(route.request().url());
        await route.fulfill({ json: { source: "notion", plants: [
          { id: "one", name: "밤비노 핑크", category: "알로카시아" },
          { id: "two", name: "무늬 프라이덱", category: "알로카시아" },
          { id: "three", name: "찬트핑", category: "알로카시아" },
        ] } });
      });
      await page.goto("http://127.0.0.1:3001/spaces", { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.getByRole("checkbox").first().waitFor();
      await page.getByRole("button", { name: "레르베리 · 실습 1단", exact: true }).waitFor();
      const plan = page.getByRole("group", { name: "식물방 2.5D 배치도" });
      await plan.waitFor();
      assert.equal(await plan.locator("h2").count(), 3);
      assert.equal(await plan.getByRole("button").count(), 14);
      await plan.locator("canvas").waitFor();
      await page.waitForFunction(() => document.querySelector('[data-zone="lerberg:1"]')?.style.left?.endsWith("px"));
      const pixels = await page.evaluate(() => {
        const source = document.querySelector("canvas"); const copy = document.createElement("canvas");
        copy.width = source.width; copy.height = source.height;
        const ctx = copy.getContext("2d"); ctx.drawImage(source, 0, 0);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
        const dark = [0, 0, 0];
        for (let y = 0; y < copy.height; y += 2) for (let x = 0; x < copy.width; x += 2) {
          const i = (y * copy.width + x) * 4;
          if (data[i] < 180 && data[i + 1] < 185 && data[i + 2] < 190) dark[Math.min(2, Math.floor(x / copy.width * 3))]++;
        }
        return dark;
      });
      assert.ok(pixels.every((count) => count > 100), `blank shelf region: ${pixels}`);
      const regions = await plan.locator("h2").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      }));
      assert.ok(regions[0].x < regions[1].x && regions[1].x < regions[2].x);
      assert.ok(regions.every((region) => region.y === regions[0].y && region.width > 90));
      for (const name of ["3단장 · 실습 3단", "레르베리 · 실습 4단", "검은색장 · 온실"]) {
        const button = plan.getByRole("button", { name, exact: true });
        await button.click();
        assert.equal(await button.getAttribute("aria-pressed"), "true");
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.screenshot({ path: path.join(directory, `room-${viewport.width}.png`) });
      await page.getByRole("button", { name: "5단장 · 미니온실 1번", exact: true }).click();
      await page.getByRole("button", { name: /위치 미지정 3/ }).click();
      await page.getByRole("textbox", { name: "이동할 식물 검색" }).fill("ㅂㅂㄴ");
      assert.equal(await page.getByRole("checkbox").count(), 1);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "공간 이동", exact: true }).click();
      await page.getByLabel("옮길 공간").selectOption("left-five:1");
      await page.getByLabel("메모", { exact: true }).fill("첫 배치");
      await page.screenshot({ path: path.join(directory, `move-${viewport.width}.png`) });
      await page.getByRole("button", { name: "1개 식물 이동 기록", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "1개 식물" }).waitFor();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("plant-log:location-trial:v1")));
      assert.equal(stored.positions.one, "left-five:1");
      assert.equal(stored.history[0].from, null);
      await page.reload();
      await page.getByRole("button", { name: /위치 미지정 2/ }).waitFor();
      await page.getByRole("button", { name: "전체", exact: true }).click();
      await page.getByRole("checkbox", { name: /밤비노 핑크/ }).check();
      await page.getByRole("button", { name: "공간 이동", exact: true }).click();
      await page.getByLabel("옮길 공간").selectOption("right-black:1");
      await page.getByRole("button", { name: "1개 식물 이동 기록", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "1개 식물" }).waitFor();
      const moved = await page.evaluate(() => JSON.parse(localStorage.getItem("plant-log:location-trial:v1")));
      assert.equal(moved.positions.one, "right-black:1");
      assert.equal(moved.history.length, 2);
      assert.equal(moved.history[0].from, "left-five:1");
      await page.getByRole("button", { name: /이동 기록 2건/ }).click();
      assert.equal(await page.locator(".spaces-history article").count(), 2);
      await page.screenshot({ path: path.join(directory, `history-${viewport.width}.png`), fullPage: true });
      await page.getByRole("button", { name: /위치 미지정 2/ }).click();
      await page.getByRole("button", { name: "전체 선택", exact: true }).click();
      assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 2);
      await page.getByRole("button", { name: "전체 해제", exact: true }).click();
      assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 0);
      await page.getByRole("button", { name: "전체 선택", exact: true }).click();
      await page.getByRole("button", { name: "공간 이동", exact: true }).click();
      await page.getByLabel("옮길 공간").selectOption("lerberg:4");
      await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === "plant-log:location-trial:v1") throw new Error("저장 공간이 부족해요."); return original.call(this, key, value); }; });
      await page.getByRole("button", { name: "2개 식물 이동 기록", exact: true }).click();
      await page.getByRole("alert").filter({ hasText: "저장 공간이 부족해요" }).waitFor();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("plant-log:location-trial:v1")).history.length), 2);
      await page.reload();
      await page.getByRole("button", { name: /위치 미지정 2/ }).waitFor();
      await page.getByRole("button", { name: "전체 선택", exact: true }).click();
      await page.getByRole("button", { name: "공간 이동", exact: true }).click();
      await page.getByLabel("옮길 공간").selectOption("lerberg:4");
      await page.getByRole("button", { name: "2개 식물 이동 기록", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "2개 식물" }).waitFor();
      const batch = await page.evaluate(() => JSON.parse(localStorage.getItem("plant-log:location-trial:v1")));
      assert.equal(batch.history.length, 4);
      assert.equal(batch.positions.two, "lerberg:4");
      assert.equal(batch.positions.three, "lerberg:4");
      await plan.getByRole("button", { name: "검은색장 · 온실", exact: true }).click();
      await page.getByRole("button", { name: "검은색장 · 온실 식물 카드 보기", exact: true }).click();
      const cards = page.getByRole("dialog", { name: "공간 안의 식물 카드" });
      await cards.waitFor();
      const cardBounds = await cards.boundingBox();
      assert.equal(cardBounds.y, 0);
      assert.equal(cardBounds.height, viewport.height);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
      assert.equal(await cards.getByRole("link").count(), 1);
      assert.equal(await cards.getByRole("link", { name: "밤비노 핑크 내 식물 상세 보기" }).getAttribute("href"), "/?plant=one");
      const countBadge = plan.getByLabel("검은색장 · 온실 식물 1개", { exact: true });
      await countBadge.waitFor();
      assert.equal(await countBadge.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(233, 238, 255)");
      await page.screenshot({ path: path.join(directory, `cards-${viewport.width}.png`) });
      await cards.getByRole("button", { name: "식물방으로 돌아가기", exact: true }).click();
      assert.equal(await cards.count(), 0);
      const markerPlacement = await page.evaluate(() => {
        return [...document.querySelectorAll("[data-count-zone]")].map((badge) => {
          const number = document.querySelector(`[data-zone="${badge.getAttribute("data-count-zone")}"]`);
          const a = number.getBoundingClientRect(), b = badge.getBoundingClientRect();
          return { id: badge.getAttribute("data-count-zone"), dx: b.left + b.width / 2 - a.left - a.width / 2, dy: a.top + a.height / 2 - b.top - b.height / 2, overlaps: !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top), above: b.top + b.height / 2 < a.top + a.height / 2 };
        });
      });
      assert.ok(markerPlacement.every((item) => item.above && !item.overlaps), JSON.stringify(markerPlacement));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(directory, `centered-counts-${viewport.width}.png`) });
      await plan.getByRole("button", { name: "5단장 · 5단", exact: true }).click();
      await page.getByRole("button", { name: "선택한 공간 이름 변경", exact: true }).click();
      await page.getByRole("textbox", { name: "공간 이름", exact: true }).fill("육묘 공간");
      await page.getByRole("button", { name: "공간 이름 저장", exact: true }).click();
      await plan.getByRole("button", { name: "5단장 · 육묘 공간", exact: true }).waitFor();
      await page.reload();
      await plan.getByRole("button", { name: "5단장 · 육묘 공간", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("plant-log:location-trial:v1")).history.length), 4);
      await plan.getByRole("button", { name: "검은색장 · 온실", exact: true }).click();
      await page.getByRole("button", { name: "검은색장 · 온실 식물 카드 보기", exact: true }).click();
      await cards.getByRole("link", { name: "밤비노 핑크 내 식물 상세 보기" }).click();
      await page.getByRole("heading", { name: "밤비노 핑크", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "내 식물", exact: true }).getAttribute("aria-current"), "page");
      assert.deepEqual(writes, []);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport, planeZones: regions.length, clickableLevels: 14, renamed: true, savedAndReloaded: true, historyRetained: true, notionWrites: writes.length }));
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const remote = { version: 1, positions: {}, history: [], labels: {} };
    const operations = [];
    let partial = true;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      if (request.url().includes("/api/location-logs")) {
        if (request.method() === "GET") return route.fulfill({ json: { source: "notion", state: remote } });
        const data = request.postDataJSON();
        if (request.method() === "PATCH") { remote.labels[data.locationId] = data.name; return route.fulfill({ json: { source: "notion", success: true } }); }
        operations.push(data.operationId);
        const results = data.plantIds.map((id) => {
          if (id === "two" && partial) return { plantId: id, success: false, message: "두 번째 식물 저장 실패" };
          remote.history.push({ id: `${data.operationId}:${id}`, plantId: id, plantName: id, from: remote.positions[id] ?? null, to: data.destination, date: data.date, reason: data.note, recordedAt: new Date().toISOString() });
          remote.positions[id] = data.destination;
          return { plantId: id, success: true };
        });
        partial = false;
        return route.fulfill({ json: { results, source: "notion" } });
      }
      return route.fulfill({ json: { source: "notion", plants: [{ id: "one", name: "밤비노 핑크", category: "알로카시아" }, { id: "two", name: "프라이덱", category: "알로카시아" }] } });
    });
    await page.goto("http://127.0.0.1:3001/spaces", { waitUntil: "domcontentloaded" });
    await page.getByText("식물 세팅 변경 기록 DB와 연결되어 있어요", { exact: true }).waitFor();
    await page.getByRole("button", { name: "전체 선택", exact: true }).click();
    await page.getByRole("button", { name: "공간 이동", exact: true }).click();
    await page.getByRole("button", { name: "2개 식물 이동 기록", exact: true }).click();
    await page.getByRole("dialog").getByText("프라이덱 · 두 번째 식물 저장 실패", { exact: true }).waitFor();
    assert.equal(remote.history.length, 1);
    await page.getByRole("button", { name: "1개 식물 이동 기록", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1개 식물 위치를 노션에 저장" }).waitFor();
    assert.equal(operations[0], operations[1]);
    assert.equal(remote.history.length, 2);
    await page.reload();
    await page.getByRole("button", { name: /위치 미지정 0/ }).waitFor();
    await page.getByRole("button", { name: "선택한 공간 이름 변경", exact: true }).click();
    await page.getByRole("textbox", { name: "공간 이름", exact: true }).fill("새 자리");
    await page.getByRole("button", { name: "공간 이름 저장", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "공간 이름을 노션에 저장" }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "레르베리 · 새 자리", exact: true }).waitFor();
    console.log(JSON.stringify({ mode: "mocked-notion", partialFailureRetry: true, sameOperationId: true, reloadRetainsPositionsAndNames: true }));
    await context.close();
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
