/* eslint-disable @typescript-eslint/no-require-imports -- Browser icon asset regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/navigation-assets");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/**", (route) => route.fulfill({ json: { plants: [], recentPlants: [], events: [], source: "notion" } }));
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByLabel("물 준 날짜", { exact: true }).waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector(".header-date").disabled);
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      const tabs = [["물주기", "droplet"], ["관찰일지", "pen"], ["내 식물", "pen"], ["캘린더", "calendar-search"]];
      for (const [label, asset] of tabs) {
        await nav.getByRole("button", { name: label, exact: true }).click();
        for (const [otherLabel, otherAsset] of tabs) {
          const button = nav.getByRole("button", { name: otherLabel, exact: true });
          const style = await button.evaluate((el) => ({ mask: getComputedStyle(el.querySelector(".nav-asset")).maskImage, color: getComputedStyle(el.querySelector(".nav-asset")).backgroundColor, background: getComputedStyle(el).backgroundColor }));
          assert.ok(style.mask.includes(`${otherAsset}-${otherLabel === label ? "filled" : "outline"}-48x48.png`));
          assert.equal(style.color, otherLabel === label ? "rgb(66, 99, 235)" : "rgb(145, 153, 166)");
          assert.equal(style.background, "rgba(0, 0, 0, 0)");
          assert.equal(await button.innerText(), "");
        }
        await nav.screenshot({ path: path.join(out, `${asset}-${label}-${width}.png`) });
      }
      const files = ["droplet-outline", "droplet-filled", "pen-outline", "pen-filled", "calendar-search-outline", "calendar-search-filled", "plus-outline"];
      for (const file of files) {
        const shape = await page.evaluate(async (name) => {
          const img = new Image(); img.src = `/navigation/${name}-48x48.png`; await img.decode();
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 48;
          const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
          const rgba = ctx.getImageData(0, 0, 48, 48).data;
          let visible = 0; let transparent = 0;
          for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] > 0) visible++; else transparent++; }
          return { width: img.naturalWidth, height: img.naturalHeight, visible, transparent };
        }, file);
        assert.equal(shape.width, 48); assert.equal(shape.height, 48);
        assert.ok(shape.visible > 20 && shape.transparent > 20, `${file} must have a visible alpha mask`);
      }
      await nav.getByRole("button", { name: "빠른 작업", exact: true }).click();
      await page.getByRole("dialog", { name: "추가", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: all supplied PNG masks render, outline/filled switching, blue icons only, unchanged labels/background, central add action at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
