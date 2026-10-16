/* eslint-disable @typescript-eslint/no-require-imports -- Mobile browser regression checks with mocked Notion responses. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    page.setDefaultTimeout(30000);
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    const plants = [
      { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아", isWateringDue: true, currentSoils: ["배흙"] },
      { id: "22222222-2222-4222-8222-222222222222", name: "세라미스 자구", category: "자구", isWateringDue: true, currentSoils: ["세라미스"] },
      { id: "33333333-3333-4333-8333-333333333333", name: "오늘 물준 벤자민", category: "고무나무", isWateringDue: true },
    ].map((plant, index) => ({ ...plant, coverPhotoUrl: `/fixture/cover-${index}.jpg` }));
    const recentId = "44444444-4444-4444-8444-444444444444";
    const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
    const imageRequests = [];
    await page.route("**/_next/image?**", async (route) => { imageRequests.push(route.request().url()); await route.fulfill({ contentType: "image/svg+xml", body: svg }); });
    await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
    const saved = []; let registration; let recent = null; let failAppend = false;
    await page.route("**/api/**", async (route) => {
      const req = route.request(), url = new URL(req.url()); let data = {};
      if (url.pathname === "/api/plants") {
        if (req.method() === "PATCH") {
          const body = req.postDataJSON(); const plant = plants.find((item) => item.id === body.plantId);
          Object.assign(plant, Object.fromEntries(Object.entries(body).filter(([key]) => key !== "plantId"))); data = { plant };
        } else if (req.method() === "POST") { registration = req.postData(); const plant = { id: recentId, name: "새 자구", category: "자구" }; plants.push(plant); data = { plant }; }
        else data = { plants, source: "notion" };
      } else if (url.pathname === "/api/options") data = { categoryOptions: ["알로카시아", "자구", "부활중", "사망", "고무나무"], observationTags: ["신엽", "좋음"] };
      else if (url.pathname === "/api/watering-logs") data = { plants: [{ id: plants[2].id, name: plants[2].name }] };
      else if (url.pathname === "/api/watering-stats") data = { wateringDays: 3, recentIntervals: 2, lastWateredAt: today, recentAverageDays: 2, averageDays: 2 };
      else if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { observations: [], photos: [] } : { recentPlants: plants.map((plant) => ({ plantId: plant.id, plantName: plant.name, plantCategory: plant.category, observedAt: today })) };
      else if (url.pathname === "/api/calendar") data = { events: plants.map((plant) => ({ id: plant.id, plantId: plant.id, plantName: plant.name, type: "watering", date: today })) };
      else if (url.pathname === "/api/plant-logs") {
        if (req.method() === "GET") { assert.ok(url.searchParams.get("plantId")); data = { recentObservation: recent }; }
        else {
          const body = req.postData();
          if (body.includes('name="appendToPageId"') && failAppend) { await route.fulfill({ status: 409, json: { message: "5분이 지났어요. 새 일지로 저장해주세요." } }); return; }
          saved.push(body); data = { pageId: recentId };
        }
      } else if (url.pathname !== "/api/plant-photos") throw new Error(`Unmocked API: ${url.pathname}`);
      await route.fulfill({ json: data });
    });
    const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa-care-updates"); await fs.mkdir(out, { recursive: true });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    const nav = page.getByRole("navigation"), active = page.locator("[data-screen]:not([hidden])");
    const due = page.getByRole("button", { name: /물줄 때 된 식물/ });
    await due.click(); assert.match(await due.innerText(), /1\s*개/);
    assert.equal(await page.getByRole("button", { name: /^자구 1개/ }).count(), 1);
    await page.getByRole("checkbox", { name: /밤비노 핑크/ }).first().click();
    await page.getByRole("button", { name: "오늘 물준 벤자민 식물 상세 보기", exact: true }).click();
    await active.getByRole("heading", { name: plants[2].name, exact: true }).waitFor();
    await page.getByRole("button", { name: `${plants[2].name} 최근 물 캘린더 보기`, exact: true }).click();
    await active.getByRole("heading", { name: "관리 캘린더" }).waitFor();
    assert.equal(await active.getByPlaceholder("식물 검색").inputValue(), plants[2].name);
    assert.equal(await active.getByRole("button", { name: /^밤비노 핑크 물주기/ }).count(), 0);
    await active.getByRole("button", { name: /^오늘 물준 벤자민 물주기/ }).click();
    await active.getByRole("heading", { name: plants[2].name, exact: true }).waitFor();
    for (const label of ["분갈이", "현재 흙"]) {
      await page.getByRole("button", { name: `${plants[2].name} ${label} 캘린더 보기`, exact: true }).click();
      assert.equal(await active.getByPlaceholder("식물 검색").inputValue(), plants[2].name);
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    }
    await active.getByRole("button", { name: "검색어 지우기" }).click();
    const searchResult = active.getByRole("button", { name: "밤비노 핑크 알로카시아", exact: true });
    await searchResult.locator("img").waitFor();
    assert.ok((await searchResult.locator("img").getAttribute("src")).includes("cover_icon=1"));
    await active.getByRole("heading", { name: "내 식물", exact: true }).click();
    await active.getByRole("button", { name: "전체보기", exact: true }).click();
    await active.locator("button.recent-plant img").first().waitFor();
    assert.equal(await active.locator("button.recent-plant").count(), 3);
    await page.screenshot({ path: path.join(out, "recent-all-covers.png"), fullPage: true });
    await active.locator("button.recent-plant").filter({ hasText: plants[0].name }).click();
    await page.getByRole("button", { name: "대분류 변경", exact: true }).click();
    await active.getByLabel("대분류", { exact: true }).selectOption("사망");
    await page.getByRole("button", { name: "대분류 저장", exact: true }).click();
    await page.getByText("대분류를 변경했습니다.", { exact: true }).waitFor();
    await nav.getByRole("button", { name: "물주기", exact: true }).click();
    assert.equal(await page.getByRole("checkbox", { name: /밤비노 핑크/ }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /개 물주기 저장/ }).count(), 0);
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await page.getByRole("button", { name: "대분류 변경", exact: true }).click();
    await active.getByLabel("대분류", { exact: true }).selectOption("부활중");
    await page.getByRole("button", { name: "대분류 저장", exact: true }).click();
    await page.getByText("대분류를 변경했습니다.", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "category-edited.png"), fullPage: true });
    await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
    const picture = await page.screenshot();
    const input = active.locator('input[type="file"]');
    await input.setInputFiles({ name: "first.png", mimeType: "image/png", buffer: picture });
    await active.getByText("1장 선택됨").waitFor();
    await active.locator('input[type="date"]').fill("2026-10-01");
    await input.setInputFiles({ name: "second.png", mimeType: "image/png", buffer: picture });
    await active.getByText("2장 선택됨").waitFor();
    assert.equal(await active.locator('input[type="date"]').inputValue(), "2026-10-01");
    await input.setInputFiles([]);
    assert.equal(await active.getByRole("button", { name: /^사진 \d 삭제$/ }).count(), 2);
    await active.getByRole("button", { name: "사진 2 삭제", exact: true }).click();
    await active.getByText("1장 선택됨").waitFor();
    await input.setInputFiles({ name: "third.png", mimeType: "image/png", buffer: picture });
    await active.getByText("2장 선택됨").waitFor();
    await active.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
    await active.getByPlaceholder("식물 검색").fill("ㅂㅂㄴ");
    await active.getByRole("button", { name: "밤비노 핑크 부활중", exact: true }).click();
    await active.getByRole("button", { name: "신엽", exact: true }).click();
    await active.getByPlaceholder("오늘의 변화를 기록해보세요.").fill("추가 메모");
    recent = { id: recentId, createdAt: new Date().toISOString(), note: "앞서 쓴 메모", photoCount: 1 };
    await active.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(saved.length, 0);
    await page.screenshot({ path: path.join(out, "append-choice.png") });
    failAppend = true;
    await page.getByRole("button", { name: "기존 일지에 추가", exact: true }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    assert.equal(saved.length, 0);
    assert.equal(await active.getByPlaceholder("오늘의 변화를 기록해보세요.").inputValue(), "추가 메모");
    failAppend = false;
    await page.getByRole("button", { name: "기존 일지에 추가", exact: true }).click();
    await active.getByText("기존 관찰일지에 추가했습니다.", { exact: true }).waitFor();
    assert.equal(saved.length, 1); assert.ok(saved[0].includes(recentId)); assert.ok(saved[0].includes("first.jpg")); assert.ok(saved[0].includes("third.jpg")); assert.ok(!saved[0].includes("second.jpg"));
    assert.equal(await active.getByRole("button", { name: "식물을 선택하세요", exact: true }).count(), 1);
    assert.equal(await active.getByRole("button", { name: /^사진 \d 삭제$/ }).count(), 0);
    await active.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
    await active.getByRole("button", { name: "밤비노 핑크 부활중", exact: true }).click();
    await active.getByRole("button", { name: "신엽", exact: true }).click();
    await active.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
    await page.getByRole("button", { name: "새 일지로 저장", exact: true }).click();
    await active.getByText("관찰일지를 Notion에 저장했습니다.", { exact: true }).waitFor();
    assert.equal(saved.length, 2); assert.ok(!saved[1].includes('name="appendToPageId"'));
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await page.getByRole("button", { name: "새 식물 등록", exact: true }).click();
    await page.getByRole("button", { name: "모주 선택 안 함", exact: true }).click();
    await page.getByRole("searchbox", { name: "모주 검색", exact: true }).fill("ㅂㅂㄴ");
    await page.getByRole("checkbox", { name: "밤비노 핑크 부활중", exact: true }).check();
    assert.ok(await page.getByRole("button", { name: "식물 등록", exact: true }).isEnabled());
    await page.screenshot({ path: path.join(out, "mother-picker.png"), fullPage: true });
    await page.getByRole("button", { name: "식물 등록", exact: true }).click();
    await active.getByRole("heading", { name: "새 자구", exact: true }).waitFor();
    assert.ok(registration.includes('name="motherPlantIds"')); assert.ok(registration.includes(plants[0].id));
    assert.ok(imageRequests.filter((url) => url.includes("cover_icon=1")).every((url) => Number(new URL(url).searchParams.get("w")) <= 144));
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
    assert.deepEqual(errors, []);
    console.log("PASS: cached small cover icons, recent all thumbnails, bidirectional plant/calendar navigation, category editing and watering exclusion, today-watered navigation, mature-only count, cumulative photos/removal/cancel/date preservation, append-choice/new-choice/failure recovery, mother-only registration, responsive layout");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
