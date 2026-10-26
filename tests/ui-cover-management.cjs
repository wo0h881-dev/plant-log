/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser feature and cache checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    page.setDefaultTimeout(45000);
    const errors = []; page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
    const plant = { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아", coverPhotoUrl: "/fixture/cover.jpg", wateringCycleDays: 2 };
    const photos = [{ id: "recent-1", name: "최근 사진", url: "/fixture/recent.jpg", date: "2026-10-16" }, { id: "old-1", name: "이전 사진", url: "/fixture/old.jpg", date: "2026-10-15" }];
    const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
    await page.route("**/fixture/*.jpg", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
    await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
    let lastCover;
    let lastCycle;
    let coverFailure = "";
    await page.route("**/api/**", async (route) => {
      const req = route.request(); const url = new URL(req.url()); let data = {};
      if (url.pathname === "/api/plants") {
        if (req.method() === "PATCH") { lastCycle = req.postDataJSON(); plant.wateringCycleDays = lastCycle.wateringCycleDays; data = { plant }; }
        else data = { plants: [plant], source: "notion" };
      } else if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { photos, observations: [] } : { recentPlants: [{ plantId: plant.id, plantName: plant.name, plantCategory: plant.category, photoUrl: "/fixture/recent.jpg" }] };
      else if (url.pathname === "/api/plant-photos") data = { photos: url.searchParams.has("all") ? photos : [] };
      else if (url.pathname === "/api/watering-logs") data = { plants: [] };
      else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
      else if (url.pathname === "/api/plant-cover") {
        if (coverFailure === "network") return route.abort();
        if (coverFailure === "html") return route.fulfill({ status: 502, contentType: "text/html", body: "<h1>private internal detail</h1>" });
        if (coverFailure) return route.fulfill({ status: 500, json: { message: "Invalid redirect value: private internal detail" } });
        lastCover = req.postData(); plant.coverPhotoUrl = lastCover.includes('name="photoId"') ? "/fixture/selected-cover.jpg" : "/fixture/uploaded-cover.jpg"; data = { plant };
      }
      await route.fulfill({ json: data });
    });
    await page.goto(`${base}/?plant=${plant.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByRole("heading", { name: plant.name, exact: true }).waitFor();
    const nav = page.getByRole("navigation");
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    const mainPhoto = page.getByRole("button", { name: "최근 사진 보기", exact: true });
    await mainPhoto.locator("img").waitFor();
    assert.equal(new URL(await mainPhoto.locator("img").getAttribute("src"), base).pathname, "/fixture/cover.jpg");
    await mainPhoto.click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("dialog").locator('img[src$="/fixture/recent.jpg"]').waitFor();
    await page.getByRole("button", { name: "사진 닫기", exact: true }).click();
    assert.equal(new URL(await page.getByRole("button", { name: "최근 사진 보기", exact: true }).locator("img").getAttribute("src"), base).pathname, "/fixture/cover.jpg");
    await page.getByRole("button", { name: "프로필 편집 메뉴", exact: true }).click();
    await page.getByRole("button", { name: "관수 주기 편집", exact: true }).click();
    await page.getByLabel("관수 주기 (일)").fill("5");
    await page.getByRole("button", { name: "관수 주기 저장", exact: true }).click();
    await page.getByText("관수 주기를 변경했습니다.", { exact: true }).waitFor();
    assert.deepEqual(lastCycle, { plantId: plant.id, wateringCycleDays: 5 });
    await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
    await page.getByRole("button", { name: "커버사진 변경", exact: true }).click();
    await page.getByRole("button", { name: "이전 사진 선택", exact: true }).click();
    for (const failure of ["server", "html", "network"]) {
      coverFailure = failure;
      await page.getByRole("button", { name: "커버로 지정", exact: true }).click();
      await page.getByRole("dialog").getByRole("alert").filter({ hasText: "커버사진을 변경하지 못했어요. 잠시 후 다시 시도해주세요." }).waitFor();
      assert.equal(plant.coverPhotoUrl, "/fixture/cover.jpg");
      assert.equal(lastCover, undefined);
      assert.ok(!(await page.getByRole("dialog").getByRole("alert").innerText()).includes("private"));
    }
    coverFailure = "";
    await page.getByRole("button", { name: "커버로 지정", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.ok(lastCover.includes('name="photoId"\r\n\r\nold-1'));
    assert.equal(new URL(await page.getByRole("button", { name: "최근 사진 보기", exact: true }).locator("img").getAttribute("src"), base).pathname, "/fixture/selected-cover.jpg");
    const png = Buffer.from(await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; const ctx = canvas.getContext("2d"); ctx.fillStyle = "#284F2A"; ctx.fillRect(0, 0, 16, 16); return canvas.toDataURL("image/png").split(",")[1]; }), "base64");
    await page.getByRole("button", { name: "커버사진 변경", exact: true }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "new-cover.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "커버로 지정", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.ok(lastCover.includes('name="photo"'));
    assert.equal(new URL(await page.getByRole("button", { name: "최근 사진 보기", exact: true }).locator("img").getAttribute("src"), base).pathname, "/fixture/uploaded-cover.jpg");
    const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa"); await fs.mkdir(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "cover-and-cycle.png"), fullPage: true });
    assert.deepEqual(errors, []);
    await page.context().close();

    const context = await browser.newContext({ serviceWorkers: "allow" });
    let network = 0;
    await context.route("**/api/**", (route) => route.fulfill({ json: { plants: [], recentPlants: [] } }));
    await context.route("**/_next/image?**", (route) => { network++; return route.fulfill({ contentType: "image/png", headers: { "Cache-Control": "no-store" }, body: png }); });
    const cachePage = await context.newPage();
    await cachePage.goto(base, { waitUntil: "domcontentloaded" });
    await cachePage.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await cachePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const imageUrl = (file, signature) => `/_next/image?${new URLSearchParams({ url: `https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/${file}.jpg?X-Amz-Signature=${signature}`, w: "96", q: "75", cover_icon: "1" })}`;
    const load = (src) => cachePage.evaluate((url) => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = () => reject(new Error("Cached icon failed")); image.src = url; }), src);
    await load(imageUrl("same", "first"));
    await cachePage.waitForFunction(async () => (await (await caches.open("plant-log-cover-icons-v1")).keys()).length === 1);
    await load(imageUrl("same", "renewed"));
    assert.equal(network, 1);
    await load(imageUrl("changed", "new"));
    assert.equal(network, 2);
    await cachePage.waitForFunction(async () => (await (await caches.open("plant-log-cover-icons-v1")).keys()).length === 2);
    assert.equal(await cachePage.evaluate(async () => (await (await caches.open("plant-log-cover-icons-v1")).keys()).length), 2);
    await context.close();
    console.log("PASS: safe error messages, unchanged cover after failures, immediate existing/new cover refresh, watering cycle edit, real service-worker cache reuse and changed-cover refetch");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
