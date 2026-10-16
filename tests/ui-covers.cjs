/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser performance regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    page.setDefaultTimeout(45000);
    const plants = Array.from({ length: 100 }, (_, index) => ({
      id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      name: `테스트 식물 ${String(index).padStart(3, "0")}`, category: index === 99 ? "자구" : "알로카시아",
      currentSoils: ["세라미스"], isWateringDue: true,
      coverPhotoUrl: `https://prod-files-secure.s3.us-west-2.amazonaws.com/fixture/cover-${index}.jpg?signature=test`,
    }));
    const thumbnailRequests = new Set();
    const widths = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const pixel = await fs.readFile(path.join(__dirname, "..", "public", "icon.svg"));
    await page.route("https://prod-files-secure.s3.us-west-2.amazonaws.com/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: pixel }));
    await page.route("**/_next/image?**", (route) => {
      const params = new URL(route.request().url()).searchParams;
      const src = params.get("url");
      thumbnailRequests.add(src);
      widths.push(Number(params.get("w")));
      return src.includes("cover-98.jpg")
        ? route.fulfill({ status: 404, body: "missing cover" })
        : route.fulfill({ contentType: "image/svg+xml", body: pixel });
    });
    await page.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      return route.fulfill({ json: pathname === "/api/plants" ? { plants, source: "notion" } : pathname === "/api/watering-logs" ? { plants: [] } : pathname === "/api/plant-details" ? { recentPlants: [] } : {} });
    });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:3001", { waitUntil: "domcontentloaded", timeout: 90000 });
    const search = page.getByPlaceholder("이름 또는 초성으로 검색");
    const otherList = page.getByRole("checkbox", { name: /테스트 식물 000/ }).locator("..");
    await page.getByRole("checkbox", { name: /테스트 식물 000/ }).locator("img").waitFor();
    await page.waitForFunction(() => [...document.images].some((image) => image.src.includes("/_next/image") && image.complete && image.naturalWidth));
    assert.ok(thumbnailRequests.size < 15, `Initial requests: ${thumbnailRequests.size}`);
    assert.ok(![...thumbnailRequests].some((src) => src.includes("cover-99.jpg")));
    assert.equal(await page.getByRole("checkbox", { name: /테스트 식물 000/ }).locator("img").getAttribute("loading"), "lazy");
    assert.equal(await page.getByRole("checkbox", { name: /테스트 식물 000/ }).locator("img").getAttribute("fetchpriority"), "low");
    await otherList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await page.getByRole("checkbox", { name: /테스트 식물 099/ }).scrollIntoViewIfNeeded();
    await page.getByRole("checkbox", { name: /테스트 식물 099/ }).locator("img").waitFor();
    await search.fill("099");
    const matched = page.getByRole("checkbox", { name: /테스트 식물 099/ });
    await matched.waitFor();
    await matched.locator("img").waitFor();
    const matchedSource = new URL(await matched.locator("img").getAttribute("src"), page.url());
    assert.equal(matchedSource.searchParams.get("url"), plants[99].coverPhotoUrl);
    await matched.locator("img").click();
    assert.equal(await matched.getAttribute("aria-checked"), "true");
    const missingResponse = page.waitForResponse((response) => response.url().includes("/_next/image") && new URL(response.url()).searchParams.get("url")?.includes("cover-98.jpg") && response.status() === 404);
    await search.fill("098");
    const missing = page.getByRole("checkbox", { name: /테스트 식물 098/ });
    await missingResponse;
    await missing.locator("img").waitFor({ state: "detached" });
    await missing.click();
    assert.equal(await missing.getAttribute("aria-checked"), "true");
    assert.ok(widths.length > 0 && widths.every((width) => width > 0 && width <= 144), `Thumbnail widths: ${widths}`);
    const out = process.env.QA_OUTPUT || path.join(__dirname, "..", ".next", "qa");
    await fs.mkdir(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "watering-covers.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS: 100 plants; ${thumbnailRequests.size} covers requested after scrolling/search; initial visible-only loading, optimized widths, failed cover fallback, selection unchanged`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
