/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression test. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width === 320, hasTouch: width === 320, timezoneId: "Asia/Seoul", serviceWorkers: "block" });
      const plants = [
        { id: "11111111-1111-4111-8111-111111111111", name: "밤비노 핑크", category: "알로카시아" },
        { id: "22222222-2222-4222-8222-222222222222", name: "무늬 몬스테라", category: "몬스테라" },
      ];
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const posts = [];
      let recentChecks = 0;
      let failSecond = true;
      const date = "2026-11-06";
      await page.clock.install({ time: new Date(date + "T03:00:00Z") });
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        let data = {};
        if (url.pathname === "/api/plants") data = { plants, source: "notion" };
        if (url.pathname === "/api/watering-logs") data = { plants: [] };
        if (url.pathname === "/api/fertilizer-recipes") data = { state: { version: 1, batches: [], index: 0 }, revision: null };
        if (url.pathname === "/api/plant-logs") {
          if (request.method() === "GET") recentChecks++;
          else {
            const form = await new Response(request.postDataBuffer(), { headers: { "Content-Type": request.headers()["content-type"] } }).formData();
            posts.push(Object.fromEntries(form));
            if (form.get("plantId") === plants[1].id && failSecond) {
              failSecond = false;
              return route.fulfill({ status: 502, json: { message: "시험용 저장 실패" } });
            }
            data = { pageId: form.get("plantId") };
          }
        }
        if (url.pathname === "/api/calendar") data = { events: [
          { id: "fertilizer-1", type: "fertilizer", date, plantId: plants[0].id, plantName: plants[0].name, note: "영양제 A · 물 1000mL" },
          { id: "water-1", type: "watering", date, plantId: plants[0].id, plantName: plants[0].name },
        ] };
        return route.fulfill({ json: data });
      });
      await page.goto(process.env.APP_URL || "http://localhost:3001", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('[data-screen="water"]').getByRole("checkbox").first().waitFor();
      const nav = page.getByRole("navigation", { name: "주요 화면" });
      await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
      const observation = page.locator('[data-screen="observation"]');
      await observation.getByRole("checkbox", { name: "여러 식물 선택", exact: true }).check();
      await observation.getByRole("button", { name: "식물을 체크하세요", exact: true }).click();
      const search = observation.getByRole("searchbox");
      await search.fill("ㅂㅂㄴ");
      await observation.getByRole("checkbox", { name: /밤비노 핑크/ }).check();
      await search.fill("ㅁㄴ");
      await observation.getByRole("checkbox", { name: /무늬 몬스테라/ }).check();
      await observation.getByRole("button", { name: "선택 완료 (2)", exact: true }).click();
      await observation.getByLabel("메모", { exact: true }).fill("같은 관찰 메모");
      await observation.getByRole("button", { name: "관찰태그", exact: true }).click();
      const tags = page.getByRole("dialog", { name: "관찰태그", exact: true });
      await tags.getByRole("button", { name: "신엽", exact: true }).click();
      await tags.getByRole("button", { name: /선택 완료/ }).click();
      await observation.getByRole("button", { name: "2개 식물 관찰일지 저장", exact: true }).click();
      await observation.getByText(/저장 실패: 무늬 몬스테라/).waitFor();
      assert.equal(await observation.getByLabel("메모", { exact: true }).inputValue(), "같은 관찰 메모");
      await observation.getByRole("button", { name: "1개 식물 관찰일지 저장", exact: true }).click();
      await observation.getByText("1개 식물의 관찰일지를 저장했어요.", { exact: true }).waitFor();
      assert.deepEqual(posts.map((post) => post.plantId), [plants[0].id, plants[1].id, plants[1].id]);
      assert.ok(posts.every((post) => post.note === "같은 관찰 메모" && post.observationTags === '["신엽"]'));
      assert.equal(recentChecks, 0, "batch saves never append to a recent journal entry");
      await nav.getByRole("button", { name: "캘린더", exact: true }).click();
      const calendar = page.locator('[data-screen="more"]');
      await calendar.getByRole("tab", { name: "분갈이", exact: true }).click();
      await page.keyboard.press("ArrowRight");
      assert.equal(await calendar.getByRole("tab", { name: "비료", exact: true }).getAttribute("aria-selected"), "true");
      await calendar.getByText("영양제 A · 물 1000mL", { exact: true }).waitFor();
      assert.equal(await calendar.locator('[data-event-type="watering"]').count(), 0);
      assert.equal(await calendar.locator(".calendar-markers .calendar-fertilizer").count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    console.log("PASS: batch initials search, shared memo/tags, retry only failed plant, and calendar fertilizer tab/markers");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
