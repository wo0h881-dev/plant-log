/* eslint-disable @typescript-eslint/no-require-imports -- Mobile interaction regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  let releaseImages, releaseSave;
  const imageGate = new Promise((resolve) => { releaseImages = resolve; });
  const saveGate = new Promise((resolve) => { releaseSave = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    page.setDefaultTimeout(45000);
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    const plant = { id: "11111111-1111-4111-8111-111111111111", name: "무늬 프라이덱 그린벨벳", category: "알로카시아", coverPhotoUrl: "/fixture/cover.jpg", isWateringDue: true, wateringCycleDays: 2 };
    const photos = ["cover", "one", "two", "three"].map((name, index) => ({ id: name, name: `사진 ${index + 1}`, url: `/fixture/${name}.jpg`, date: `2026-10-${16 - index}` }));
    const imageRequests = new Set();
    let observationRequests = 0;
    const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
    await page.route("**/fixture/*.jpg", async (route) => { imageRequests.add(new URL(route.request().url()).pathname); await imageGate; await route.fulfill({ contentType: "image/svg+xml", body: svg }); });
    await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
    await page.route("**/api/**", async (route) => {
      const req = route.request(); const url = new URL(req.url()); let data = {};
      if (url.pathname === "/api/plants") data = { plants: [plant], source: "notion" };
      if (url.pathname === "/api/watering-logs") data = { plants: [] };
      if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { photos, observations: [] } : { recentPlants: [{ plantId: plant.id, plantName: plant.name, observedAt: "2026-10-16" }] };
      if (url.pathname === "/api/options") data = { observationTags: ["신엽", "하엽", "새 상태 태그"] };
      if (url.pathname === "/api/plant-photos") data = { photos: [] };
      if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
      if (url.pathname === "/api/calendar") data = { events: [] };
      if (url.pathname === "/api/plant-logs") { observationRequests++; await saveGate; }
      await route.fulfill({ json: data });
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:3001", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const nav = page.getByRole("navigation");
    const active = page.locator("[data-screen]:not([hidden])");
    assert.deepEqual(await nav.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.lastElementChild.textContent)), ["물주기", "관찰일지", "내 식물", "캘린더"]);
    await page.getByRole("button", { name: /물줄 때 된 식물/ }).click();
    await page.getByRole("checkbox").first().click();
    await page.evaluate(() => window.scrollTo(0, 120));
    const savedScroll = await page.evaluate(() => scrollY);
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await active.getByText("1 / 4", { exact: true }).waitFor();
    assert.ok(await active.getByRole("status", { name: "사진 불러오는 중", exact: true }).count());
    assert.ok(await nav.getByRole("button", { name: "관찰일지", exact: true }).isEnabled());
    assert.ok(imageRequests.size <= 2, "Carousel downloaded all photos on first open");
    assert.equal(await nav.locator('[aria-current="page"] .nav-icon').evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(238, 242, 255)");
    const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa-blue"); await fs.mkdir(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "blue-photo-loading.png") });
    releaseImages();
    await page.waitForFunction(() => document.querySelector('[data-screen="profile"]')?.querySelectorAll(".photo-skeleton").length === 0);
    await active.getByRole("button", { name: "다음 캐러셀 사진", exact: true }).click();
    await active.getByText("2 / 4", { exact: true }).waitFor();
    await active.getByRole("button", { name: "4번째 사진으로 이동", exact: true }).click();
    await active.getByText("4 / 4", { exact: true }).waitFor();
    await active.getByRole("button", { name: "최근 사진 보기", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").locator('img[src$="/fixture/three.jpg"]').waitFor();
    await page.getByRole("button", { name: "사진 닫기", exact: true }).click();
    await nav.getByRole("button", { name: /물주기/ }).click();
    await page.waitForFunction((position) => Math.abs(scrollY - position) < 3, savedScroll);
    assert.equal(await page.getByRole("checkbox").first().getAttribute("aria-checked"), "true");
    await page.getByRole("button", { name: "1개 물주기 저장", exact: true }).waitFor();
    await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
    assert.equal(await active.getByRole("button", { name: "관찰일지 저장", exact: true }).count(), 0);
    await active.getByRole("button", { name: "식물을 선택하세요", exact: true }).click();
    const search = active.getByPlaceholder("식물 검색");
    await search.fill("ㅍㄹㅇㄷ");
    assert.ok(await search.evaluate((element) => parseFloat(getComputedStyle(element).fontSize) >= 16));
    await active.getByRole("button", { name: `${plant.name} ${plant.category}`, exact: true }).click();
    assert.equal(await active.getByPlaceholder("식물 검색").count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.tagName === "INPUT"), false);
    await active.getByRole("button", { name: "신엽", exact: true }).click();
    await active.getByRole("button", { name: "좋음", exact: true }).click();
    await active.getByRole("button", { name: "안좋음", exact: true }).click();
    assert.equal(await active.getByRole("button", { name: "좋음", exact: true }).getAttribute("aria-pressed"), "false");
    await active.getByRole("button", { name: "온습도", exact: true }).click();
    await active.getByLabel("습도 (%)").fill("80");
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
    assert.equal(await active.getByLabel("습도 (%)").inputValue(), "80");
    const save = active.getByRole("button", { name: "관찰일지 저장", exact: true });
    assert.equal(await save.evaluate((element) => getComputedStyle(element).backgroundColor), "rgb(66, 99, 235)");
    const bounds = await save.boundingBox(); const navBounds = await nav.boundingBox(); assert.ok(bounds.y + bounds.height <= navBounds.y);
    await page.screenshot({ path: path.join(out, "blue-observation.png"), fullPage: true });
    await save.evaluate((element) => { element.click(); element.click(); });
    await page.getByRole("button", { name: "저장 중...", exact: true }).waitFor();
    assert.equal(observationRequests, 1);
    releaseSave();
    await active.getByText("관찰일지를 Notion에 저장했습니다.", { exact: true }).waitFor();
    assert.equal(await active.getByRole("button", { name: "식물을 선택하세요", exact: true }).count(), 1);
    for (const width of [320, 390, 430, 768]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
    assert.deepEqual(errors, []);
    console.log("PASS: blue navigation, scoped image skeleton, cover-first deduplicated carousel, lazy images, search blur/16px, retained tab state/scroll, grouped tags, save dock, duplicate-submit guard");
  } finally { releaseImages(); releaseSave(); await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
