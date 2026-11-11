/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression test. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://localhost:3001";
  const output = path.join(__dirname, "../.next/qa/fertilizer-recipes");
  await fs.mkdir(output, { recursive: true });
  let state = { version: 1, batches: [], index: 0 };
  let revision = 0; let failSave = true; let waterCount = 0;
  const methods = [];
  const plant = { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아", wateringCycleDays: 2, isWateringDue: true };
  const threeDaysAgo = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 3 * 86_400_000));
  async function device(width) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
    page.setDefaultTimeout(30000);
    const errors = []; page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const request = route.request(); const url = new URL(request.url()); let data = {};
      methods.push(request.method());
      if (url.pathname === "/api/fertilizer-recipes") {
        if (request.method() === "PUT") {
          if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { message: "시험용 저장 실패" } }); }
          assert.equal(request.postDataJSON().revision, String(revision));
          state = request.postDataJSON().state; revision++;
        }
        data = { state, revision: String(revision) };
      } else if (url.pathname === "/api/plants") data = { plants: [plant], source: "notion" };
      else if (url.pathname === "/api/watering-logs") {
        if (request.method() === "POST") { waterCount++; data = { successCount: 1, results: [{ plantId: plant.id, plantName: plant.name, ok: true }] }; }
        else if (url.searchParams.get("view") === "last-fertilized") data = { dates: { [plant.id.replaceAll("-", "")]: threeDaysAgo } };
        else data = url.searchParams.has("options") ? { options: ["A", "B"] } : { plants: [] };
      } else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [], observations: [] };
      await route.fulfill({ json: data });
    });
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator('[data-screen="water"]').getByRole("checkbox").first().waitFor();
    await page.waitForFunction(() => !document.querySelector('[aria-label="비료"]').disabled);
    return { page, errors };
  }
  const open = async (page) => {
    const settings = page.getByRole("button", { name: "비료 설정", exact: true });
    if (await settings.count()) await settings.click();
    else await page.getByRole("button", { name: "비료", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "비료 선택", exact: true });
    await dialog.waitFor(); return dialog;
  };
  try {
    const { page, errors } = await device(390);
    await page.getByRole("checkbox", { name: /밤비노 핑크.*비료 3일 전/ }).first().waitFor();
    let dialog = await open(page);
    await dialog.getByRole("button", { name: "A", exact: true }).click();
    await dialog.getByLabel("물 (mL)", { exact: true }).fill("1000");
    await dialog.getByLabel("A (mL)", { exact: true }).fill("0.");
    await dialog.getByLabel("물통 이름", { exact: true }).fill("성장용");
    await dialog.getByLabel("새 비료 이름").fill("작성 중 비료");
    await page.mouse.click(2, 2);
    await dialog.waitFor({ state: "hidden" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[aria-label="비료"]').disabled);
    dialog = await open(page);
    assert.equal(await dialog.getByLabel("물 (mL)", { exact: true }).inputValue(), "1000");
    assert.equal(await dialog.getByLabel("A (mL)", { exact: true }).inputValue(), "0.");
    assert.equal(await dialog.getByLabel("물통 이름", { exact: true }).inputValue(), "성장용");
    assert.equal(await dialog.getByLabel("새 비료 이름").inputValue(), "작성 중 비료");
    await dialog.getByLabel("새 비료 이름").fill("");
    await dialog.getByLabel("A (mL)", { exact: true }).fill("10");
    await dialog.getByRole("button", { name: "B", exact: true }).click();
    await dialog.getByLabel("B (mL)", { exact: true }).fill("5");
    const tag = await dialog.getByRole("button", { name: "A", exact: true }).boundingBox();
    const add = await dialog.getByRole("button", { name: "물통 추가", exact: true }).boundingBox();
    assert.ok(Math.abs(tag.y - add.y) < 80, "fertilizer names stay beside the add-container control");
    await dialog.getByRole("button", { name: "물통 추가", exact: true }).click();
    await dialog.getByRole("button", { name: "A", exact: true }).click();
    await dialog.getByRole("group", { name: "물통 2", exact: true }).getByLabel("물 (mL)", { exact: true }).fill("500");
    await dialog.getByRole("group", { name: "물통 2", exact: true }).getByLabel("A (mL)", { exact: true }).fill("1");
    await dialog.getByRole("tab", { name: "성장용", exact: true }).click();
    await dialog.getByRole("button", { name: "물통 저장", exact: true }).click();
    await dialog.getByText("시험용 저장 실패", { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel("A (mL)", { exact: true }).first().inputValue(), "10");
    await page.screenshot({ path: path.join(output, "restored-draft.png") });
    await dialog.getByRole("button", { name: "물통 저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(state.batches.length, 2);
    assert.equal(state.batches[0].name, "성장용");
    assert.equal(state.batches[0].fertilizers.length, 2);
    assert.equal(await page.evaluate(() => localStorage.getItem("plant-log:fertilizer-draft:v1")), null);
    await page.locator('[data-screen="water"]').getByRole("checkbox").first().click();
    await page.getByRole("button", { name: /비료 저장/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-screen="water"] .save-dock') === null);
    assert.equal(waterCount, 1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tablist", { name: "사용할 물통" }).getByRole("tab", { name: "물통 2", exact: true }).waitFor();
    dialog = await open(page);
    assert.equal(await dialog.getByLabel("물 (mL)", { exact: true }).first().inputValue(), "1000");
    await dialog.getByRole("tab", { name: "물통 2", exact: true }).click();
    await dialog.getByRole("button", { name: "물통 2 삭제", exact: true }).click();
    await dialog.getByRole("button", { name: "물통 저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(state.batches.length, 1);
    const second = await device(320);
    await second.page.getByRole("tablist", { name: "사용할 물통" }).getByRole("tab", { name: "성장용", exact: true }).waitFor();
    const secondDialog = await open(second.page);
    const renamedTank = "봄여름 새잎 성장용 비료 물통";
    await secondDialog.getByLabel("물통 이름", { exact: true }).fill(renamedTank);
    await secondDialog.getByLabel("물 (mL)", { exact: true }).fill("750");
    await secondDialog.getByRole("button", { name: "물통 저장", exact: true }).click();
    await secondDialog.waitFor({ state: "hidden" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tablist", { name: "사용할 물통" }).getByRole("tab", { name: renamedTank, exact: true }).waitFor();
    assert.equal(await second.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: "비료 설정", exact: true }).waitFor();
    assert.ok((await page.getByRole("button", { name: "비료 설정", exact: true }).textContent()).includes("750mL"));
    dialog = await open(page);
    await dialog.getByRole("button", { name: `${renamedTank} 삭제`, exact: true }).click();
    await dialog.getByRole("button", { name: "물통 저장", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector('[aria-label="비료"]').disabled);
    assert.equal(await page.getByRole("tablist", { name: "사용할 물통" }).count(), 0);
    assert.equal(state.batches.length, 0);
    assert.equal(waterCount, 1, "recipe editing/removal never creates or removes watering records");
    assert.equal(methods.includes("DELETE"), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []); assert.deepEqual(second.errors, []);
    await second.page.context().close(); await page.context().close();
    console.log("PASS: outside dismissal and reload restore unfinished drafts, failed saves retain input, recipes survive watering/reload, edits sync between devices, and the last container can be removed without touching usage records");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
