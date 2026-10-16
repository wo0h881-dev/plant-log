/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression checks. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const errors = [];
    page.setDefaultTimeout(45000);
    page.on("pageerror", (error) => errors.push(error.message));
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
    const ids = Array.from({ length: 6 }, (_, index) => `11111111-1111-4111-8111-11111111111${index}`);
    const plants = [
      { id: ids[0], name: "오늘 물준 벤자민", category: "고무나무", isWateringDue: true, currentSoils: ["배흙"] },
      { id: ids[1], name: "수태 자구", category: "자구", isWateringDue: true, currentSoils: ["수태", "펄라이트"] },
      { id: ids[2], name: "밤비노 핑크", category: "자구", isWateringDue: true, currentSoils: ["세라미스"], coverPhotoUrl: "/fixture/one.png" },
      { id: ids[3], name: "사망 식물", category: "사망", isWateringDue: true },
      { id: ids[4], name: "찬트핑", category: "알로카시아", isWateringDue: false, currentSoils: ["배흙"] },
      { id: ids[5], name: "프라이덱 그린벨벳", category: "알로카시아", isWateringDue: true, currentSoils: ["배흙"] },
    ];
    let observation;
    let registration;
    let rename;
    let failRename = true;
    let statsRequests = 0;
    const pixel = await fs.readFile(path.join(__dirname, "..", "public", "icon.svg"));
    await page.route("**/fixture/*.png", (route) => route.fulfill({ contentType: "image/svg+xml", body: pixel }));
    await page.route("**/_next/image?**", (route) => route.fulfill({ contentType: "image/svg+xml", body: pixel }));
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      let data;
      if (url.pathname === "/api/plants") {
        if (req.method() === "PATCH") {
          rename = req.postDataJSON();
          if (failRename) { failRename = false; await route.fulfill({ status: 500, json: { message: "이름 변경 테스트 오류" } }); return; }
          const plant = plants.find((item) => item.id === rename.plantId);
          plant.name = rename.name;
          data = { plant };
        } else if (req.method() === "POST") { registration = req.postData(); data = { plant: { id: ids[0], name: "이름 없는 식물", category: "기타" } }; }
        else data = { plants, source: "notion" };
      } else if (url.pathname === "/api/watering-logs") data = { plants: [{ id: ids[0], name: plants[0].name }] };
      else if (url.pathname === "/api/options") data = { observationTags: ["신엽", "하엽", "과습", "꽃", "새 상태 태그"], soilOptions: ["배흙", "수태", "세라미스"], categoryOptions: ["알로카시아", "자구"], purchaseSourceOptions: ["풀판다"] };
      else if (url.pathname === "/api/plant-details") data = url.searchParams.has("plantId") ? { observations: [], photos: [1, 2].map((n) => ({ id: `photo-${n}`, name: "사진", url: `/fixture/${n === 1 ? "one" : "two"}.png`, date: today })) } : { recentPlants: [{ plantId: ids[2], plantName: plants[2].name, plantCategory: "자구", photoUrl: "/fixture/one.png", observedAt: today }] };
      else if (url.pathname === "/api/plant-photos") data = { photos: [] };
      else if (url.pathname === "/api/watering-stats") { statsRequests++; data = { lastWateredAt: today, daysSinceWatered: 0, recentAverageDays: 2, averageDays: 3, wateringDays: 8, recentIntervals: 5 }; }
      else if (url.pathname === "/api/plant-logs") { observation = req.postData(); data = {}; }
      else if (url.pathname === "/api/calendar") data = { events: plants.slice(0, 3).map((plant) => ({ id: plant.id, type: "watering", date: today, plantId: plant.id, plantName: plant.name })) };
      else throw new Error(`Unhandled endpoint ${url.pathname}`);
      await route.fulfill({ status: 200, json: data });
    });
    const out = process.env.QA_OUTPUT || path.join(__dirname, "..", ".next", "qa");
    await fs.mkdir(out, { recursive: true });
    await page.goto(process.env.APP_URL || "http://127.0.0.1:3001", { waitUntil: "domcontentloaded", timeout: 90000 });
    const nav = page.getByRole("navigation", { name: "주요 화면" });
    await page.getByRole("button", { name: /물줄 때 된 식물/ }).click();
    assert.equal(await page.getByRole("checkbox", { name: /오늘 물준 벤자민|수태 자구|사망 식물/ }).count(), 0);
    assert.equal(await page.getByRole("checkbox", { name: /밤비노 핑크/ }).count(), 1);
    const pupsToggle = page.getByRole("button", { name: /^자구 \d+개/ });
    assert.equal(await pupsToggle.getAttribute("aria-expanded"), "false");
    await pupsToggle.click();
    assert.equal(await page.getByRole("checkbox", { name: /밤비노 핑크/ }).count(), 2);
    await page.locator("#due-pups").getByRole("checkbox", { name: /밤비노 핑크/ }).click();
    await pupsToggle.click();
    await page.getByRole("button", { name: "1개 물주기 저장", exact: true }).waitFor();
    await page.getByRole("button", { name: "전체선택", exact: true }).click();
    await page.getByRole("button", { name: "2개 물주기 저장", exact: true }).waitFor();
    await page.getByRole("button", { name: "전체해제", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /개 물주기 저장/ }).count(), 0);
    await page.screenshot({ path: path.join(out, "watering.png"), fullPage: true });

    await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
    await page.getByRole("button", { name: "식물을 선택하세요" }).click();
    await page.getByPlaceholder("식물 검색").fill("ㅂㅂㄴ");
    await page.getByRole("button", { name: "밤비노 핑크 자구", exact: true }).click();
    await page.getByRole("button", { name: "온습도", exact: true }).click();
    await page.getByLabel("습도 (%)").fill("80");
    await page.getByLabel("이상", { exact: true }).nth(1).check();
    assert.equal(await page.getByRole("group", { name: "상태", exact: true }).getByRole("button", { name: "새 상태 태그" }).count(), 1);
    await page.screenshot({ path: path.join(out, "observation.png"), fullPage: true });
    await page.getByRole("button", { name: "관찰일지 저장", exact: true }).click();
    await page.getByText("관찰일지를 Notion에 저장했습니다.", { exact: true }).waitFor();
    assert.ok(observation.includes(ids[2]));
    assert.ok(observation.includes('name="humidity"\r\n\r\n80'));
    assert.equal(await page.getByRole("button", { name: "식물을 선택하세요" }).count(), 1);
    await page.getByRole("button", { name: "식물을 선택하세요" }).click();
    await page.getByPlaceholder("식물 검색").fill("밤비노");
    await page.getByRole("button", { name: "밤비노 핑크 자구", exact: true }).click();

    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    assert.equal(await page.locator("img").count(), 1);
    await page.getByPlaceholder("식물 검색").fill("ㅍㅋ");
    assert.equal(await page.getByRole("button", { name: "밤비노 핑크 자구", exact: true }).locator("img").count(), 0);
    await page.getByRole("button", { name: "밤비노 핑크 자구", exact: true }).click();
    await page.getByText("아직 관찰 기록이 없어요.").waitFor();
    await page.getByText("전체 평균 (8일 기록)").waitFor();
    assert.equal(await page.getByRole("heading", { name: "실제 물주기" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "사진 크게 보기", exact: true }).count(), 0);
    assert.ok(statsRequests >= 1);
    assert.equal(await page.locator("img").count(), 1);
    await page.screenshot({ path: path.join(out, "plant-details.png"), fullPage: true });
    await page.getByRole("button", { name: "식물 사진 크게 보기", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "다음 사진", exact: true }).click();
    await page.getByText("2 / 2", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);

    await nav.getByRole("button", { name: "더보기", exact: true }).click();
    assert.equal(await page.getByRole("heading", { name: "실제 물주기" }).count(), 0);
    await page.getByPlaceholder("식물 검색").fill("ㅂㅂㄴ");
    await page.getByRole("button", { name: "밤비노 핑크 자구", exact: true }).click();
    await page.getByText("전체 평균 (8일 기록)").waitFor();
    assert.ok(statsRequests >= 1);
    await page.screenshot({ path: path.join(out, "calendar-selected.png"), fullPage: true });
    assert.equal(await page.getByRole("button", { name: /^오늘 물준 벤자민/ }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /^밤비노 핑크 물주기/ }).count(), 1);
    await page.getByRole("button", { name: "검색어 지우기" }).click();
    assert.equal(await page.getByRole("heading", { name: "실제 물주기" }).count(), 0);
    await page.keyboard.press("Escape");
    await page.getByRole("heading", { name: "관리 캘린더" }).click();
    assert.equal(await page.getByRole("button", { name: /^오늘 물준 벤자민 물주기/ }).count(), 1);
    await page.screenshot({ path: path.join(out, "calendar.png"), fullPage: true });

    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await page.getByRole("button", { name: "이름 변경", exact: true }).click();
    await page.getByLabel("새 식물명").fill("밤비노 핑크 2호");
    await page.getByRole("button", { name: "이름 변경 저장", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "이름 변경 테스트 오류" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "밤비노 핑크", exact: true }).count(), 1);
    await page.getByRole("button", { name: "이름 변경 저장", exact: true }).click();
    await page.getByText("이름을 변경했습니다.", { exact: true }).waitFor();
    assert.deepEqual(rename, { plantId: ids[2], name: "밤비노 핑크 2호" });
    assert.equal(await page.getByPlaceholder("식물 검색").inputValue(), "밤비노 핑크 2호");
    assert.equal(await page.getByRole("heading", { name: "밤비노 핑크 2호", exact: true }).count(), 1);
    await page.screenshot({ path: path.join(out, "plant-renamed.png"), fullPage: true });
    await nav.getByRole("button", { name: "관찰일지", exact: true }).click();
    await page.getByRole("button", { name: "밤비노 핑크 2호 자구", exact: true }).waitFor();
    await nav.getByRole("button", { name: "더보기", exact: true }).click();
    await page.getByPlaceholder("식물 검색").fill("밤비노 핑크 2호");
    await page.getByRole("button", { name: "밤비노 핑크 2호 자구", exact: true }).click();
    await page.getByRole("heading", { name: "밤비노 핑크 2호 관리 정보", exact: true }).waitFor();
    await nav.getByRole("button", { name: "내 식물", exact: true }).click();
    await page.getByRole("button", { name: "새 식물 등록", exact: true }).click();
    await page.getByLabel("가격 (원)").fill("0");
    assert.equal(await page.getByRole("button", { name: "식물 등록", exact: true }).isEnabled(), true);
    await page.screenshot({ path: path.join(out, "new-plant.png"), fullPage: true });
    await page.getByRole("button", { name: "식물 등록", exact: true }).click();
    await page.getByRole("heading", { name: "내 식물", exact: true }).waitFor();
    assert.ok(registration.includes('name="price"\r\n\r\n0'));
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: collapsed pups, bulk selection, watering exclusions, initials search, observation save, lazy gallery, calendar care summary, rename failure/retry, one-field registration, responsive widths");
    console.log(`Screenshots: ${out}`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
