/* eslint-disable @typescript-eslint/no-require-imports -- Browser workflow regression tests. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const base = process.env.APP_URL || "http://127.0.0.1:3001";
  const out = process.env.QA_OUTPUT || path.join(__dirname, "../.next/qa/rounded-care");
  await fs.mkdir(out, { recursive: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      page.setDefaultTimeout(30000);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const plants = [
        { id: "11111111-1111-4111-8111-111111111111", name: "무늬 프라이덱 그린벨벳", category: "알로카시아", coverPhotoUrl: "/fixture/one.png", wateringCycleDays: 2, daysSinceWatered: 4, isWateringDue: true },
        { id: "22222222-2222-4222-8222-222222222222", name: "밤비노 핑크", category: "알로카시아", coverPhotoUrl: "/fixture/two.png", wateringCycleDays: 5, daysSinceWatered: 6, isWateringDue: true },
        { id: "33333333-3333-4333-8333-333333333333", name: "오늘 물 준 식물", category: "기타", coverPhotoUrl: "/fixture/three.png", wateringCycleDays: 4 },
      ];
      const svg = await fs.readFile(path.join(__dirname, "../public/icon.svg"));
      await page.route("**/fixture/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: svg }));
      const patches = []; let fail = true; let observation;
      await page.route("**/api/**", async (route) => {
        const req = route.request(); const url = new URL(req.url()); let data = {};
        if (url.pathname === "/api/plants") {
          if (req.method() === "PATCH") {
            const edit = req.postDataJSON(); patches.push(edit);
            if (edit.plantId === plants[1].id && fail) { fail = false; return route.fulfill({ status: 503, json: { message: "fixture failure" } }); }
            const plant = plants.find((item) => item.id === edit.plantId); Object.assign(plant, edit); data = { plant };
          } else data = { plants, source: "notion" };
        } else if (url.pathname === "/api/watering-logs") data = { plants: [{ id: plants[2].id, name: plants[2].name }] };
        else if (url.pathname === "/api/plant-details") data = { recentPlants: [], photos: [{ id: "recent", name: plants[0].name, url: "/fixture/recent.png", date: "2026-10-25" }], observations: [
          { id: "entry1", date: "2026-10-25", tags: ["신엽"], note: "새 잎을 확인했어요." }, { id: "entry2", date: "2026-10-21", tags: ["좋음"], note: "건강한 잎을 기록해요." },
        ] };
        else if (url.pathname === "/api/plant-photos") data = { photos: [{ id: "recent", name: plants[0].name, url: "/fixture/recent.png", date: "2026-10-25" }] };
        else if (url.pathname === "/api/watering-stats") data = { wateringDays: 0, recentIntervals: 0 };
        else if (url.pathname === "/api/calendar") data = { events: [] };
        else if (url.pathname === "/api/plant-logs") { if (req.method() === "POST") observation = req.postData(); }
        await route.fulfill({ json: data });
      });
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      const water = page.locator('[data-screen="water"]');
      await water.getByRole("button", { name: /물줄 때 된 식물/ }).click();
      const due = water.locator(".watering-due-panel");
      for (const plant of plants.slice(0, 2)) await due.getByRole("checkbox").filter({ hasText: plant.name }).click();
      assert.equal(await due.evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(245, 246, 248)");
      await page.getByRole("button", { name: /관수주기 편집/ }).click();
      await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      assert.equal(await due.getByRole("checkbox", { checked: true }).count(), 2, "cancel preserves selection");
      await page.getByRole("button", { name: /관수주기 편집/ }).click();
      const cycle = page.getByRole("dialog", { name: "관수 주기 편집", exact: true });
      await cycle.getByRole("button", { name: "1일 줄이기", exact: true }).click();
      assert.ok(await cycle.getByRole("button", { name: "변경 저장", exact: true }).isDisabled());
      await cycle.getByRole("button", { name: "1일 늘리기", exact: true }).click();
      await cycle.getByLabel("추가할 일수", { exact: true }).fill("2");
      assert.ok((await cycle.innerText()).includes("2일 → 4일"));
      await cycle.getByRole("button", { name: "변경 저장", exact: true }).click();
      await cycle.getByRole("alert").waitFor();
      assert.equal(await due.getByRole("checkbox", { checked: true }).count(), 1, "only failed edit remains selected");
      assert.ok(await due.getByRole("checkbox").filter({ hasText: plants[1].name }).isChecked());
      await cycle.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      await page.getByRole("button", { name: /관수주기 편집/ }).click();
      assert.ok((await cycle.innerText()).includes("선택한 1개"));
      await cycle.getByLabel("추가할 일수", { exact: true }).fill("2");
      await cycle.getByRole("button", { name: "변경 저장", exact: true }).click();
      await cycle.getByRole("status").waitFor();
      assert.equal(patches.filter((edit) => edit.plantId === plants[0].id).length, 1);
      assert.equal(patches.filter((edit) => edit.plantId === plants[1].id).length, 2);
      assert.equal(plants[0].wateringCycleDays, 4); assert.equal(plants[1].wateringCycleDays, 7);
      assert.equal(patches.at(-1).wateringCycleDays, 7);
      await cycle.getByRole("button", { name: "완료", exact: true }).click();
      assert.equal(await water.getByRole("checkbox", { checked: true }).count(), 0, "successful edits clear both lists");
      await page.getByRole("button", { name: /관수주기 편집/ }).click();
      await page.getByText("물주기 목록에서 편집할 식물의 체크박스를 먼저 선택해주세요.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      const today = water.getByRole("button", { name: `${plants[2].name} 식물 상세 보기`, exact: true });
      await today.locator("img").waitFor();
      assert.ok((await today.boundingBox()).width <= 70);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `watering-${width}.png`), fullPage: true });
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      const obs = page.locator('[data-screen="observation"]');
      const chooser = obs.getByRole("button", { name: "식물을 선택하세요", exact: true });
      assert.equal(await chooser.locator("img").count(), 0);
      await chooser.click();
      await obs.getByRole("button", { name: new RegExp(plants[0].name) }).filter({ has: page.locator("img") }).click();
      await page.getByLabel("관찰 날짜", { exact: true }).fill("2026-10-03");
      const memo = obs.getByLabel("메모", { exact: true });
      await memo.fill("메모를 먼저 작성해요.");
      await obs.getByRole("button", { name: "관찰태그", exact: true }).click();
      const tags = page.getByRole("dialog", { name: "관찰태그", exact: true });
      assert.ok((await tags.boundingBox()).y > 0);
      assert.equal(await tags.evaluate((el) => getComputedStyle(el).borderRadius), "26px");
      await tags.getByRole("button", { name: "신엽", exact: true }).click();
      await tags.getByRole("button", { name: /선택 완료/ }).click();
      await obs.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
      await obs.getByText("관찰일지를 Notion에 저장했습니다.", { exact: true }).waitFor();
      assert.ok(observation.includes("2026-10-03") && observation.includes("신엽"));
      await nav.getByRole("button", { name: "내 식물", exact: true }).click();
      const search = page.locator(".app-header").getByRole("searchbox");
      await search.fill(plants[0].name);
      await page.locator(".app-header").getByRole("button", { name: new RegExp(plants[0].name) }).click();
      const profile = page.locator('[data-screen="profile"]');
      await profile.locator(".editorial-entry").first().waitFor();
      const identity = await profile.locator(".profile-card").boundingBox();
      const photo = await profile.locator(".detail-photo").boundingBox();
      assert.ok(identity.x + identity.width <= photo.x + 1);
      assert.ok(Math.abs(identity.y - photo.y) < 2);
      assert.equal(await profile.locator(".editorial-entry-number").first().evaluate((el) => getComputedStyle(el).borderRadius), "50%");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `profile-${width}.png`), fullPage: true });
      await profile.getByRole("button", { name: "최근 사진 보기", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "사진 닫기", exact: true }).click();
      await profile.getByRole("button", { name: "프로필 편집 메뉴", exact: true }).click();
      const popoverBox = await profile.locator('[popover]:popover-open').boundingBox();
      assert.ok(popoverBox.x >= 0 && popoverBox.x + popoverBox.width <= width);
      await page.getByRole("button", { name: "관수 주기 편집", exact: true }).click();
      await page.getByRole("dialog", { name: "관수 주기 편집", exact: true }).waitFor();
      await page.getByRole("button", { name: "관수 주기 편집 닫기", exact: true }).click();
      await nav.getByRole("button", { name: "캘린더", exact: true }).click();
      await page.locator(".app-header").getByRole("searchbox").fill(plants[0].name);
      await page.locator(".app-header").getByRole("button", { name: new RegExp(plants[0].name) }).click();
      await page.getByRole("heading", { name: `${plants[0].name} 관리 정보`, exact: true }).waitFor();
      await nav.getByRole("button", { name: "빠른 작업", exact: true }).click();
      const add = page.getByRole("dialog", { name: "추가", exact: true });
      assert.deepEqual(await add.locator(".quick-actions button").allTextContents(), ["새 식물 추가", "관찰일지 추가"]);
      await page.screenshot({ path: path.join(out, `add-${width}.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: rounded UI, checkbox-based additive cycle editing and partial retry, header search, memo/tag modal, two-column profile/gallery, timeline, compact today covers, two add actions at 320/390/1440px");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
