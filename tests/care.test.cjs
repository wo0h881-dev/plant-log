/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader for application TypeScript tests. */
const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Load application TypeScript without adding a separate test runtime.
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args);
};
require.extensions[".ts"] = (module, filename) => {
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(source, filename);
};

const { calculateWateringStats, canShowInWateringList, isWateredToday, normalizeDay } = require("../lib/watering.ts");
const { readEnvironmentNote } = require("../lib/observation-environment.ts");
const { canOptimizePlantCover, NOTION_COVER_HOST } = require("../lib/plant-cover.ts");
const { plantCarouselPhotos, uniquePlantPhotos } = require("../lib/plant-photos.ts");
const plantsApi = require("../app/api/plants/route.ts");
const spacesApi = require("../app/api/space-plants/route.ts");
const locationsApi = require("../app/api/location-logs/route.ts");
const { locationStateFromPages } = require("../lib/notion-locations.ts");
const coverApi = require("../app/api/plant-cover/route.ts");
const observationApi = require("../app/api/plant-logs/route.ts");
const wateringApi = require("../app/api/watering-logs/route.ts");
const statsApi = require("../app/api/watering-stats/route.ts");
const { isRecentObservation } = require("../lib/notion-observation.ts");
const { parseNotionPlantPage, parseNotionPlantPages } = require("../lib/plants.ts");
const { LOCATIONS, LOCATION_GROUPS, emptyLocationState, parseLocationState, recordMovement } = require("../lib/plant-locations.ts");
const { locationTimeline } = require("../lib/plant-locations.ts");
const { environmentAt, isEnvironment, formatLocationEnvironment } = require("../lib/location-environment.ts");
const { canSelectPlant, matchesPlantSearch } = require("../lib/plant-search.ts");
const plantId = "11111111-1111-4111-8111-111111111111";
const originalFetch = global.fetch;
const envKeys = ["NOTION_TOKEN", "NOTION_PLANTS_DATA_SOURCE_ID", "NOTION_DATA_SOURCE_ID", "NOTION_DATABASE_ID", "NOTION_WATERING_DATA_SOURCE_ID", "NOTION_SETTINGS_DATA_SOURCE_ID", "NOTION_SETTINGS_DATABASE_ID"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  envKeys.forEach((key) => { process.env[key] = key === "NOTION_TOKEN" ? "test-only-not-a-token" : plantId; });
  global.fetch = async () => { throw new Error("Unexpected external request"); };
});
afterEach(() => {
  global.fetch = originalFetch;
  envKeys.forEach((key) => { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; });
});
const json = (payload) => Response.json(payload);
const request = (form, url = "/api/plants") => new Request(`http://localhost${url}`, { method: "POST", body: form });
const createForm = (values) => { const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, value)); return form; };
function returnedPage(properties) {
  return { id: plantId, properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, { type: Object.keys(value)[0], ...value, ...(value.title ? { title: value.title.map((item) => ({ plain_text: item.text.content })) } : {}) }])) };
}

function wateringPage(lastWateredAt, cycle = 2) {
  return returnedPage({
    식물명: { title: [{ text: { content: "밤비노 핑크" } }] },
    대분류: { select: { name: "알로카시아" } },
    "관수 주기": { number: cycle },
    "최근 물준날": { date: lastWateredAt ? { start: lastWateredAt } : null },
  });
}

test("plant list keeps cycle-day alerts and missing-date behavior", () => {
  const plants = parseNotionPlantPages([
    wateringPage("2026-10-21"), wateringPage("2026-10-22"),
    wateringPage("2026-10-23"), wateringPage(undefined),
    wateringPage("2026-10-21", null), wateringPage("2026-10-25"),
  ], new Date("2026-10-24T03:00:00Z"));
  assert.deepEqual(plants.map((plant) => [plant.daysSinceWatered, plant.isWateringDue]), [
    [3, true], [2, true], [1, false], [undefined, true], [3, false], [0, false],
  ]);
});

test("plant selection excludes deceased plants by default, explicitly allows My Plants, and keeps initial search", () => {
  assert.equal(canSelectPlant({ category: " 사망 " }), false);
  assert.equal(canSelectPlant({ category: "사망" }, true), true);
  assert.equal(canSelectPlant({ category: "자구" }), true);
  assert.equal(canSelectPlant({ category: "부활중" }), true);
  assert.equal(matchesPlantSearch({ name: "밤비노 핑크", category: "알로카시아" }, "ㅂㅂㄴ"), true);
});

test("plant list refreshes its reference day across Korean midnight and year end", () => {
  for (const [lastWateredAt, beforeMidnight] of [
    ["2026-10-23", "2026-10-24T14:59:59Z"],
    ["2026-12-30", "2026-12-31T14:59:59Z"],
    ["2028-02-28", "2028-02-29T14:59:59Z"],
  ]) {
    const page = wateringPage(lastWateredAt);
    const before = parseNotionPlantPages([page], new Date(beforeMidnight))[0];
    const after = parseNotionPlantPages([page], new Date(Date.parse(beforeMidnight) + 1000))[0];
    assert.equal(before.daysSinceWatered, 1);
    assert.equal(before.isWateringDue, false);
    assert.equal(after.daysSinceWatered, 2);
    assert.equal(after.isWateringDue, true);
  }
});

test("single-page parsing remains identical to batch parsing", () => {
  const pages = [wateringPage("2026-10-22"), wateringPage(undefined), returnedPage({})];
  assert.deepEqual(parseNotionPlantPages(pages), pages.map((page) => parseNotionPlantPage(page)).filter(Boolean));
  assert.deepEqual(parseNotionPlantPages([]), []);
});

test("plant date parsing preserves rollup, formula and invalid-date handling", () => {
  const rollup = wateringPage(undefined);
  rollup.properties["최근 물준날"] = { type: "rollup", rollup: { type: "array", array: [
    { type: "date", date: { start: "2026-10-20" } },
    { type: "date", date: { start: "2026-10-22" } },
  ] } };
  const formula = wateringPage(undefined);
  formula.properties["최근 물준날"] = { type: "formula", formula: { type: "date", date: { start: "2026-10-23" } } };
  const plants = parseNotionPlantPages([rollup, formula, wateringPage("invalid")], new Date("2026-10-24T03:00:00Z"));
  assert.deepEqual(plants.map((plant) => plant.daysSinceWatered), [2, 1, undefined]);
});

test("paginated plant list formats today once per request for 194 plants", async (t) => {
  const originalFormat = Intl.DateTimeFormat.prototype.formatToParts;
  let formats = 0;
  t.mock.method(Intl.DateTimeFormat.prototype, "formatToParts", function (...args) {
    formats++;
    return originalFormat.apply(this, args);
  });
  let queries = 0;
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    queries++;
    assert.equal(body.page_size, 100);
    return json({
      results: Array.from({ length: body.start_cursor ? 94 : 100 }, (_, index) => ({
        ...wateringPage("2026-10-22"), id: `plant-${body.start_cursor ? 100 + index : index}`,
      })),
      has_more: !body.start_cursor,
      next_cursor: body.start_cursor ? null : "page-two",
    });
  };
  for (let requestIndex = 1; requestIndex <= 2; requestIndex++) {
    const response = await plantsApi.GET();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(payload.source, "notion");
    assert.equal(payload.plants.length, 194);
    assert.equal(formats, requestIndex);
    assert.equal(queries, requestIndex * 2);
  }
});

test("watering hides dead plants and only moss-containing pups", () => {
  const plant = { id: plantId, name: "자구", category: "자구" };
  assert.equal(canShowInWateringList({ ...plant, currentSoils: ["수태", "펄라이트"] }), false);
  assert.equal(canShowInWateringList({ ...plant, currentSoils: ["세라미스", "펄라이트"] }), true);
  assert.equal(canShowInWateringList({ ...plant, category: "사망" }), false);
  assert.equal(canShowInWateringList({ ...plant, category: "알로카시아", currentSoils: ["수태"] }), true);
  assert.equal(isWateredToday(plant, [{ id: plantId.replaceAll("-", ""), name: "다른 이름" }], "2026-10-11"), true);
  assert.equal(isWateredToday({ ...plant, lastWateredAt: "2026-10-10T16:00:00Z" }, [], "2026-10-11"), true);
});

test("cover optimization allows only local files and the known Notion host", () => {
  assert.equal(canOptimizePlantCover("/fixture/cover.jpg"), true);
  assert.equal(canOptimizePlantCover(`https://${NOTION_COVER_HOST}/photo.jpg?signature=test`), true);
  assert.equal(canOptimizePlantCover(`http://${NOTION_COVER_HOST}/photo.jpg`), false);
  assert.equal(canOptimizePlantCover(`https://${NOTION_COVER_HOST}.example.com/photo.jpg`), false);
  assert.equal(canOptimizePlantCover(`https://${NOTION_COVER_HOST}:444/photo.jpg`), false);
  assert.equal(canOptimizePlantCover("//example.com/photo.jpg"), false);
  assert.equal(canOptimizePlantCover("invalid"), false);
});

test("carousel keeps cover first, deduplicates signed files, and preserves meaningful external queries", () => {
  const src = `https://${NOTION_COVER_HOST}/photo.jpg`;
  const recent = [
    { id: "same", name: "same", url: `${src}?X-Amz-Signature=renewed` },
    { id: "new", name: "new", url: "https://example.com/photo?id=2" },
  ];
  const photos = plantCarouselPhotos(plantId, "식물", `${src}?X-Amz-Signature=old`, recent);
  assert.deepEqual(photos.map((photo) => photo.id), [`${plantId}-cover`, "new"]);
  assert.equal(uniquePlantPhotos([{ id: "1", url: "https://example.com/photo?id=1" }, { id: "2", url: "https://example.com/photo?id=2" }]).length, 2);
  assert.equal(plantCarouselPhotos(plantId, "식물", undefined, []).length, 0);
});

test("watering means deduplicate days and ignore invalid/future dates", () => {
  const stats = calculateWateringStats(["2026-10-01", "2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-11", "2027-01-01", "bad"], "2026-10-11");
  assert.equal(stats.wateringDays, 7);
  assert.equal(stats.averageDays, 1.7);
  assert.equal(stats.recentAverageDays, 1.6);
  assert.equal(stats.recentIntervals, 5);
  assert.equal(stats.daysSinceWatered, 0);
  assert.equal(calculateWateringStats(["2026-10-01"], "2026-10-11").averageDays, undefined);
  assert.equal(normalizeDay("2026-02-30"), undefined);
});

test("environment accepts either value and independent above flags", () => {
  assert.equal(readEnvironmentNote(createForm({ temperature: "25", temperatureAbove: "true" }), true), "온도: 25°C 이상");
  assert.equal(readEnvironmentNote(createForm({ humidity: "80", humidityAbove: "true" }), true), "습도: 80% 이상");
  assert.equal(readEnvironmentNote(createForm({ temperature: "25", humidity: "80", humidityAbove: "true" }), true), "온도: 25°C\n습도: 80% 이상");
  assert.throws(() => readEnvironmentNote(createForm({ humidity: "101" }), true));
  assert.throws(() => readEnvironmentNote(new FormData(), true));
});

test("empty plant registration is rejected without writing", async () => {
  assert.equal((await plantsApi.POST(request(new FormData()))).status, 400);
});

test("each single registration field is sufficient, including zero price", async () => {
  for (const values of [{ name: "찬트핑" }, { category: "자구" }, { purchaseSource: "새 구매처" }, { adoptedAt: "2026-10-11" }, { price: "0" }, { wateringCycleDays: "2" }]) {
    let saved;
    global.fetch = async (_url, options) => { saved = JSON.parse(options.body); return json(returnedPage(saved.properties)); };
    const response = await plantsApi.POST(request(createForm(values)));
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.ok(payload.plant.name);
    assert.ok(payload.plant.category);
    if (values.price) assert.equal(saved.properties.가격.number, 0);
    if (values.purchaseSource) assert.deepEqual(saved.properties.구매처.select, { name: values.purchaseSource });
  }
});

test("photos-only registration uses first body photo as cover and preserves order", async () => {
  let index = 0;
  let saved;
  global.fetch = async (url, options) => {
    if (url.endsWith("/file_uploads")) return json({ id: `upload-${++index}`, status: "pending" });
    if (url.endsWith("/send")) return json({ id: `upload-${index}`, status: "uploaded" });
    saved = JSON.parse(options.body);
    return json(returnedPage(saved.properties));
  };
  const form = new FormData();
  form.append("photos", new File(["a"], "first.jpg", { type: "image/jpeg" }));
  form.append("photos", new File(["b"], "second.jpg", { type: "image/jpeg" }));
  assert.equal((await plantsApi.POST(request(form))).status, 201);
  assert.equal(saved.cover.file_upload.id, "upload-1");
  assert.deepEqual(saved.children.map((block) => block.image.file_upload.id), ["upload-1", "upload-2"]);
});

test("humidity-only observation writes one observation with the selected relation", async () => {
  const writes = [];
  global.fetch = async (_url, options) => { writes.push(JSON.parse(options.body)); return json({ id: plantId }); };
  const form = createForm({ plantId, plantName: "찬트핑", plantCategory: "알로카시아", createdAt: "2026-10-11", observationTags: '["온습도"]', humidity: "80", humidityAbove: "true" });
  assert.equal((await observationApi.POST(request(form, "/api/plant-logs"))).status, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].properties.식물.relation, [{ id: plantId }]);
  assert.equal(writes[0].properties.관찰일지.rich_text[0].text.content, "습도: 80% 이상");
  assert.equal(writes[0].properties.물줌, undefined);
});

test("today records and actual statistics read every page", async () => {
  const filters = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    filters.push(body.filter);
    return json({ results: [{ properties: { 이름: { title: [{ plain_text: "💧찬트핑" }] }, 식물: { relation: [{ id: plantId }] }, 날짜: { date: { start: body.start_cursor ? "2026-10-08" : "2026-10-11" } } } }], has_more: !body.start_cursor, next_cursor: body.start_cursor ? null : "page-two" });
  };
  const today = await wateringApi.GET(new Request("http://localhost/api/watering-logs?date=2026-10-11"));
  assert.equal((await today.json()).plants.length, 1);
  assert.equal(filters.length, 2);
  assert.deepEqual(filters[0].and[0], { property: "물줌", checkbox: { equals: true } });
  const stats = await statsApi.GET(new Request(`http://localhost/api/watering-stats?plantId=${plantId}`));
  assert.equal((await stats.json()).averageDays, 3);
  assert.equal(filters.length, 4);
  assert.deepEqual(filters[2].and[1], { property: "식물", relation: { contains: plantId } });
});

const renameRequest = (body) => new Request("http://localhost/api/plants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("rename updates only the existing plant title and keeps its ID", async () => {
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노 핑크" } }] }, 대분류: { select: { name: "자구" } }, "현재 흙": { multi_select: [{ name: "세라미스" }] } }), parent: { data_source_id: plantId } };
  const writes = [];
  global.fetch = async (url, options) => {
    assert.ok(url.endsWith(`/pages/${plantId}`));
    if (options.method !== "PATCH") return json(original);
    const payload = JSON.parse(options.body);
    writes.push(payload);
    return json({ ...original, properties: { ...original.properties, ...returnedPage(payload.properties).properties } });
  };
  const response = await plantsApi.PATCH(renameRequest({ plantId, name: "  밤비노 핑크 2호  " }));
  assert.equal(response.status, 200);
  const { plant } = await response.json();
  assert.equal(plant.id, plantId);
  assert.equal(plant.name, "밤비노 핑크 2호");
  assert.deepEqual(plant.currentSoils, ["세라미스"]);
  assert.deepEqual(writes, [{ properties: { 식물명: { title: [{ text: { content: "밤비노 핑크 2호" } }] } } }]);
});

test("rename rejects invalid input without accessing Notion", async () => {
  for (const body of [{ plantId, name: " " }, { plantId, name: "a".repeat(101) }, { plantId: "bad", name: "새 이름" }, { plantId, name: 1 }, null]) {
    assert.equal((await plantsApi.PATCH(renameRequest(body))).status, 400);
  }
});

test("rename cannot update another database or an archived plant", async () => {
  for (const extra of [{ parent: { data_source_id: "22222222-2222-4222-8222-222222222222" } }, { parent: { data_source_id: plantId }, in_trash: true }]) {
    let calls = 0;
    global.fetch = async () => { calls++; return json({ ...returnedPage({ 식물명: { title: [] } }), ...extra }); };
    assert.equal((await plantsApi.PATCH(renameRequest({ plantId, name: "새 이름" }))).status, 404);
    assert.equal(calls, 1);
  }
});

test("rename reports a Notion write failure", async () => {
  global.fetch = async (_url, options) => options.method === "PATCH"
    ? Response.json({ message: "write failed" }, { status: 500 })
    : json({ ...returnedPage({ 식물명: { title: [] } }), parent: { data_source_id: plantId } });
  assert.equal((await plantsApi.PATCH(renameRequest({ plantId, name: "새 이름" }))).status, 500);
});

test("watering cycle edit changes only its number and supports clearing", async () => {
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노" } }] }, 대분류: { select: { name: "알로카시아" } } }), parent: { data_source_id: plantId } };
  for (const cycle of [2, null]) {
    let saved;
    global.fetch = async (_url, options) => {
      if (options.method !== "PATCH") return json(original);
      saved = JSON.parse(options.body);
      return json({ ...original, properties: { ...original.properties, ...returnedPage(saved.properties).properties } });
    };
    const response = await plantsApi.PATCH(renameRequest({ plantId, wateringCycleDays: cycle }));
    assert.equal(response.status, 200);
    assert.deepEqual(saved, { properties: { "관수 주기": { number: cycle } } });
    assert.equal((await response.json()).plant.name, "밤비노");
  }
  for (const cycle of [0, -1, "2", "bad"]) assert.equal((await plantsApi.PATCH(renameRequest({ plantId, wateringCycleDays: cycle }))).status, 400);
});

test("new cover uploads a permanent Notion file and appends a body image", async () => {
  const writes = [];
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노" } }] }, 대분류: { select: { name: "알로카시아" } } }), parent: { data_source_id: plantId } };
  global.fetch = async (url, options) => {
    if (url.endsWith("/file_uploads")) return json({ id: "new-upload", status: "pending" });
    if (url.endsWith("/send")) return json({ id: "new-upload", status: "uploaded" });
    if (options.method === "PATCH") { const body = JSON.parse(options.body); writes.push(body); return json({ ...original, cover: { type: "file", file: { url: `https://${NOTION_COVER_HOST}/new-cover.jpg` } } }); }
    return json(original);
  };
  const form = createForm({ plantId });
  form.set("photo", new File(["image"], "cover.jpg", { type: "image/jpeg" }));
  const response = await coverApi.POST(request(form, "/api/plant-cover"));
  assert.equal(response.status, 200);
  assert.deepEqual(writes[0], { cover: { type: "file_upload", file_upload: { id: "new-upload" } } });
  assert.equal(writes[1].children[0].image.file_upload.id, "new-upload");
  assert.ok((await response.json()).plant.coverPhotoUrl.includes("new-cover"));
});

test("existing cover selection is limited to this plant and never stores an expiring external link", async () => {
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노" } }] }, 대분류: { select: { name: "알로카시아" } } }), parent: { data_source_id: plantId } };
  const writes = [];
  global.fetch = async (url, options) => {
    url = String(url);
    if (url.startsWith(`https://${NOTION_COVER_HOST}/`)) {
      if (options.redirect === "error") throw new TypeError('Invalid redirect value, must be one of "follow" or "manual"');
      assert.equal(options.redirect, "manual");
      return new Response("image", { headers: { "Content-Type": "image/jpeg" } });
    }
    if (url.includes("/children?")) return json({ results: [{ id: "body-photo", type: "image", image: { file: { url: `https://${NOTION_COVER_HOST}/old.jpg?X-Amz-Signature=old` } } }], has_more: false });
    if (url.endsWith("/query")) return json({ results: [], has_more: false });
    if (url.endsWith("/file_uploads")) return json({ id: "copied-upload", status: "pending" });
    if (url.endsWith("/send")) return json({ id: "copied-upload", status: "uploaded" });
    if (options.method === "PATCH") { writes.push(JSON.parse(options.body)); return json({ ...original, cover: { type: "file", file: { url: `https://${NOTION_COVER_HOST}/copied-cover.jpg` } } }); }
    return json(original);
  };
  const response = await coverApi.POST(request(createForm({ plantId, photoId: "body-photo" })));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.plant.coverPhotoUrl, `https://${NOTION_COVER_HOST}/copied-cover.jpg`);
  assert.equal(result.plant.id, plantId);
  assert.equal(result.plant.name, "밤비노");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(writes, [{ cover: { type: "file_upload", file_upload: { id: "copied-upload" } } }]);
  writes.length = 0;
  assert.equal((await coverApi.POST(request(createForm({ plantId, photoId: "another-plant-photo" })))).status, 400);
  assert.equal(writes.length, 0);
});

function mockCoverDownload(download) {
  const original = { ...wateringPage(undefined), cover: { type: "file", file: { url: `https://${NOTION_COVER_HOST}/unchanged.jpg` } }, parent: { data_source_id: plantId } };
  let downloadCount = 0;
  global.fetch = async (urlValue, options = {}) => {
    const url = String(urlValue);
    if (url.startsWith(`https://${NOTION_COVER_HOST}/`)) {
      downloadCount++;
      assert.equal(options.redirect, "manual");
      return download();
    }
    assert.notEqual(url, "https://other.example/photo.jpg");
    if (url.includes("/children?")) return json({ results: [{ id: "body-photo", type: "image", image: { file: { url: `https://${NOTION_COVER_HOST}/body.jpg` } } }], has_more: false });
    if (url.endsWith("/query")) return json({ results: [], has_more: false });
    assert.notEqual(options.method, "PATCH");
    assert.equal(options.method, undefined);
    return json(original);
  };
  return { original, downloads: () => downloadCount };
}

test("existing cover rejects every HTTP redirect without uploading, following or changing plant data", async () => {
  for (const status of [301, 302, 303, 304, 307, 308]) {
    const fixture = mockCoverDownload(() => new Response(status === 304 ? null : "redirect", { status, headers: { Location: "https://other.example/photo.jpg", "Content-Type": "image/jpeg" } }));
    const before = JSON.stringify(fixture.original);
    const response = await coverApi.POST(request(createForm({ plantId, photoId: "body-photo" })));
    assert.equal(response.status, 400);
    assert.ok((await response.json()).message.includes("사진 주소가 변경"));
    assert.equal(fixture.downloads(), 1);
    assert.equal(JSON.stringify(fixture.original), before);
  }
});

test("cover download and upstream errors never expose internal messages or signed URLs", async () => {
  for (const reason of [new TypeError('Invalid redirect value: private-internal-detail'), new Error(`https://${NOTION_COVER_HOST}/photo.jpg?X-Amz-Signature=private`), new DOMException("private timeout", "TimeoutError")]) {
    mockCoverDownload(() => { throw reason; });
    const response = await coverApi.POST(request(createForm({ plantId, photoId: "body-photo" })));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { message: "커버사진을 변경하지 못했어요. 잠시 후 다시 시도해주세요." });
  }
  for (const status of [401, 403, 429, 500]) {
    global.fetch = async () => Response.json({ message: "private upstream detail" }, { status });
    const form = createForm({ plantId });
    form.set("photo", new File(["image"], "new.jpg", { type: "image/jpeg" }));
    const response = await coverApi.POST(request(form));
    assert.equal(response.status, 502);
    assert.ok(!(await response.json()).message.includes("private"));
  }
});

test("cover download still rejects missing, non-image and oversized originals without changing plant data", async () => {
  for (const download of [
    () => new Response("expired", { status: 403 }),
    () => new Response("not an image", { headers: { "Content-Type": "text/plain" } }),
    () => new Response(new Uint8Array(4_000_001), { headers: { "Content-Type": "image/jpeg" } }),
  ]) {
    const fixture = mockCoverDownload(download);
    const response = await coverApi.POST(request(createForm({ plantId, photoId: "body-photo" })));
    assert.equal(response.status, 400);
    assert.equal(fixture.downloads(), 1);
  }
});

test("cover upload validates input and reports a partial body-image failure", async () => {
  assert.equal((await coverApi.POST(request(createForm({ plantId })))).status, 400);
  const invalid = createForm({ plantId }); invalid.set("photo", new File(["bad"], "bad.txt", { type: "text/plain" }));
  assert.equal((await coverApi.POST(request(invalid))).status, 400);
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노" } }] }, 대분류: { select: { name: "알로카시아" } } }), parent: { data_source_id: plantId } };
  global.fetch = async (url) => {
    if (url.endsWith("/file_uploads")) return json({ id: "upload", status: "pending" });
    if (url.endsWith("/send")) return json({ id: "upload", status: "uploaded" });
    if (url.endsWith("/children")) return Response.json({ message: "append failed" }, { status: 500 });
    return json(original);
  };
  const form = createForm({ plantId }); form.set("photo", new File(["image"], "cover.jpg", { type: "image/jpeg" }));
  const response = await coverApi.POST(request(form));
  assert.equal(response.status, 200);
  assert.ok((await response.json()).warning.includes("본문"));
});

test("mother-only registration links existing plants and rejects foreign or malformed relations", async () => {
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "모주" } }] } }), parent: { data_source_id: plantId } };
  let saved;
  global.fetch = async (_url, options) => {
    if (options.method !== "POST") return json(original);
    saved = JSON.parse(options.body); return json(returnedPage(saved.properties));
  };
  assert.equal((await plantsApi.POST(request(createForm({ motherPlantIds: JSON.stringify([plantId, plantId]) })))).status, 201);
  assert.deepEqual(saved.properties.모주.relation, [{ id: plantId }]);
  for (const value of ['["wrong"]', '{}', 'not json']) assert.equal((await plantsApi.POST(request(createForm({ motherPlantIds: value })))).status, 400);
  let reads = 0;
  global.fetch = async () => { reads++; return json({ ...original, parent: { data_source_id: "22222222-2222-4222-8222-222222222222" } }); };
  assert.equal((await plantsApi.POST(request(createForm({ motherPlantIds: JSON.stringify([plantId]) })))).status, 404);
  assert.equal(reads, 1);
});

test("category editing only updates the select and preserves the plant and soil", async () => {
  const original = { ...returnedPage({ 식물명: { title: [{ text: { content: "밤비노" } }] }, 대분류: { select: { name: "자구" } }, "현재 흙": { multi_select: [{ name: "세라미스" }] } }), parent: { data_source_id: plantId } };
  let saved;
  global.fetch = async (_url, options) => {
    if (options.method !== "PATCH") return json(original);
    saved = JSON.parse(options.body); return json({ ...original, properties: { ...original.properties, ...returnedPage(saved.properties).properties } });
  };
  for (const category of ["부활중", "알로카시아", "사망"]) {
    const response = await plantsApi.PATCH(renameRequest({ plantId, category }));
    assert.equal(response.status, 200);
    const { plant } = await response.json();
    assert.equal(plant.category, category); assert.equal(plant.name, "밤비노"); assert.deepEqual(plant.currentSoils, ["세라미스"]);
    assert.deepEqual(saved, { properties: { 대분류: { select: { name: category } } } });
  }
  for (const category of [" ", 1, "a".repeat(101)]) assert.equal((await plantsApi.PATCH(renameRequest({ plantId, category }))).status, 400);
});

const observationId = "22222222-2222-4222-8222-222222222222";
function recentPage(extra = {}) {
  return { id: observationId, created_time: new Date(Date.now() - 60_000).toISOString(), parent: { data_source_id: plantId }, properties: {
    식물: { relation: [{ id: plantId }] }, 관찰일: { date: { start: "2026-10-16" } },
    관찰일지: { rich_text: [{ type: "text", plain_text: "기존 메모", text: { content: "기존 메모" }, annotations: { bold: true } }] },
    관찰태그: { multi_select: [{ name: "신엽" }, { name: "안좋음" }] },
    사진: { files: [{ type: "file", name: "old.jpg", file: { url: "https://notion.example/old.jpg", expiry_time: "2099-01-01" } }] },
  }, ...extra };
}
const observationForm = (extra = {}) => createForm({ plantId, plantName: "밤비노", plantCategory: "알로카시아", createdAt: "2026-10-16", observationTags: '["좋음"]', note: "새 메모", ...extra });

test("recent observation eligibility uses creation time, plant, source and observed day", () => {
  const now = Date.now();
  for (const age of [0, 120_000, 300_000]) assert.ok(isRecentObservation(recentPage({ created_time: new Date(now - age).toISOString() }), plantId, plantId, "2026-10-16", now));
  for (const age of [-1000, 300_001]) assert.equal(isRecentObservation(recentPage({ created_time: new Date(now - age).toISOString() }), plantId, plantId, "2026-10-16", now), false);
  assert.equal(isRecentObservation(recentPage(), observationId, plantId, "2026-10-16", now), false);
  assert.equal(isRecentObservation(recentPage(), plantId, observationId, "2026-10-16", now), false);
  assert.equal(isRecentObservation(recentPage(), plantId, plantId, "2026-10-15", now), false);
  assert.equal(isRecentObservation(recentPage({ in_trash: true }), plantId, plantId, "2026-10-16", now), false);
});

test("recent lookup scopes its Notion query and never writes", async () => {
  let body;
  global.fetch = async (url, options) => { assert.ok(url.endsWith("/query")); body = JSON.parse(options.body); return json({ results: [recentPage()] }); };
  const response = await observationApi.GET(new Request(`http://localhost/api/plant-logs?plantId=${plantId}&date=2026-10-16`));
  assert.equal(response.status, 200); assert.equal((await response.json()).recentObservation.id, observationId);
  assert.deepEqual(body.filter.and.slice(0, 2), [{ property: "식물", relation: { contains: plantId } }, { property: "관찰일", date: { equals: "2026-10-16" } }]);
  assert.equal((await observationApi.GET(new Request(`http://localhost/api/plant-logs?plantId=${plantId}&date=2026-02-30`))).status, 400);
});

test("append keeps old attachments, rich text and body while merging tags", async () => {
  const writes = []; let reads = 0;
  global.fetch = async (url, options) => {
    if (url.endsWith("/file_uploads")) return json({ id: "new-photo", status: "pending" });
    if (url.endsWith("/send")) return json({ id: "new-photo", status: "uploaded" });
    if (options.method !== "PATCH") { reads++; return json(recentPage()); }
    writes.push({ url, body: JSON.parse(options.body) }); return json({ id: observationId });
  };
  const form = observationForm({ appendToPageId: observationId }); form.append("photos", new File(["image"], "new.jpg", { type: "image/jpeg" }));
  const response = await observationApi.POST(request(form));
  assert.equal(response.status, 200); assert.equal((await response.json()).appended, true); assert.equal(reads, 2);
  const properties = writes[0].body.properties;
  assert.deepEqual(properties.관찰태그.multi_select, [{ name: "신엽" }, { name: "좋음" }]);
  assert.equal(properties.관찰일지.rich_text.map((part) => part.text.content).join(""), "기존 메모\n\n새 메모");
  assert.equal(properties.관찰일지.rich_text[0].annotations.bold, true);
  assert.deepEqual(properties.사진.files, [{ type: "file", name: "old.jpg", file: { url: "https://notion.example/old.jpg" } }, { type: "file_upload", name: "new.jpg", file_upload: { id: "new-photo" } }]);
  assert.equal(properties.식물, undefined); assert.equal(properties.관찰일, undefined);
  assert.ok(writes[1].url.endsWith(`/blocks/${observationId}/children`)); assert.equal(writes[1].body.children.length, 1);
});

test("append rejects expired, wrong-plant, wrong-source and different-day targets before uploading", async () => {
  for (const page of [recentPage({ created_time: new Date(Date.now() - 360_000).toISOString() }), recentPage({ parent: { data_source_id: observationId } }), recentPage({ properties: { ...recentPage().properties, 식물: { relation: [{ id: observationId }] } } }), recentPage({ properties: { ...recentPage().properties, 관찰일: { date: { start: "2026-10-15" } } } })]) {
    let requests = 0;
    global.fetch = async (_url, options) => { assert.notEqual(options.method, "POST"); assert.notEqual(options.method, "PATCH"); requests++; return json(page); };
    assert.equal((await observationApi.POST(request(observationForm({ appendToPageId: observationId })))).status, 409);
    assert.equal(requests, 1);
  }
});

test("append validates again after photo upload, and partial body errors return a warning instead of inviting duplicate retry", async () => {
  for (const expireAfterUpload of [true, false]) {
    let reads = 0, writes = 0;
    global.fetch = async (url, options) => {
      if (url.endsWith("/file_uploads")) return json({ id: "new-photo", status: "pending" });
      if (url.endsWith("/send")) return json({ id: "new-photo", status: "uploaded" });
      if (url.endsWith("/children")) return Response.json({ message: "body failed" }, { status: 500 });
      if (options.method === "PATCH") { writes++; return json({ id: observationId }); }
      reads++; return json(recentPage(reads === 2 && expireAfterUpload ? { created_time: new Date(Date.now() - 360_000).toISOString() } : {}));
    };
    const form = observationForm({ appendToPageId: observationId }); form.append("photos", new File(["image"], "new.jpg", { type: "image/jpeg" }));
    const response = await observationApi.POST(request(form));
    assert.equal(response.status, expireAfterUpload ? 409 : 200); assert.equal(writes, expireAfterUpload ? 0 : 1);
    if (!expireAfterUpload) { const payload = await response.json(); assert.equal(payload.pageId, observationId); assert.ok(payload.warning.includes("본문")); }
  }
});

test("observation rejects combined upload limit before external requests", async () => {
  const form = observationForm();
  for (let i = 0; i < 21; i++) form.append("photos", new File(["image"], `${i}.jpg`, { type: "image/jpeg" }));
  assert.equal((await observationApi.POST(request(form))).status, 400);
});

test("room defines all 14 spaces in bottom-to-top order including every five-tier shelf", () => {
  assert.equal(LOCATIONS.length, 14);
  assert.deepEqual(LOCATION_GROUPS.map((group) => group.levels.length), [3, 5, 4, 2]);
  assert.equal(LOCATIONS.find((location) => location.id === "right-black:1").name, "온실");
  assert.equal(LOCATIONS.find((location) => location.id === "right-black:2").name, "실습");
  assert.equal(LOCATIONS.find((location) => location.id === "left-five:1").name, "미니온실 1번");
});

test("trial plant list returns only names and IDs and never writes to Notion", async () => {
  let reads = 0;
  global.fetch = async (_url, options) => {
    assert.equal(options.method, "POST");
    assert.ok(String(_url).endsWith("/query"));
    reads++;
    return json({ results: [wateringPage("2026-10-22")], has_more: false });
  };
  const response = await spacesApi.GET(new Request("http://localhost/api/space-plants"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, { source: "notion", plants: [{ id: plantId, name: "밤비노 핑크", category: "알로카시아" }] });
  assert.equal(reads, 1);
});

const trialPlants = [{ id: "one", name: "밤비노 핑크" }, { id: "two", name: "프라이덱" }];
const trialNow = new Date("2026-10-24T12:00:00Z");
test("local placement and movement retain original positions and history without mutating input", () => {
  const empty = emptyLocationState();
  const first = recordMovement(empty, trialPlants, "left-five:1", "2026-10-23", "첫 배치", "first", trialNow);
  assert.deepEqual(empty, emptyLocationState());
  assert.equal(first.history.length, 2);
  assert.equal(first.history[0].from, null);
  const next = recordMovement(first, [trialPlants[0]], "lerberg:3", "2026-10-24", " 빛 조절 ", "second", trialNow);
  assert.deepEqual(next.positions, { one: "lerberg:3", two: "left-five:1" });
  assert.equal(next.history[0].from, "left-five:1");
  assert.equal(next.history[0].reason, "빛 조절");
  assert.equal(next.history.length, 3);
  assert.equal(first.positions.one, "left-five:1");
  assert.deepEqual(parseLocationState(JSON.stringify(next)), next);
});

test("duplicate selections, retries and same-location saves do not duplicate history", () => {
  const first = recordMovement(emptyLocationState(), [...trialPlants, trialPlants[0]], "lerberg:1", "2026-10-24", "", "same", trialNow);
  assert.equal(first.history.length, 2);
  const retry = recordMovement(first, trialPlants, "lerberg:1", "2026-10-24", "", "same", trialNow);
  assert.deepEqual(retry, first);
  assert.deepEqual(recordMovement(first, trialPlants, "lerberg:1", "2026-10-24", "", "new", trialNow), first);
});

test("movement rejects malformed, future, stale dates and unknown spaces", () => {
  for (const date of ["2026-02-30", "2026-99-01", "bad", "2026-10-25"]) {
    assert.throws(() => recordMovement(emptyLocationState(), trialPlants, "lerberg:1", date, "", "op", trialNow));
  }
  assert.throws(() => recordMovement(emptyLocationState(), trialPlants, "unknown", "2026-10-24", "", "op", trialNow));
  assert.throws(() => recordMovement(emptyLocationState(), [], "lerberg:1", "2026-10-24", "", "op", trialNow));
  const first = recordMovement(emptyLocationState(), trialPlants, "lerberg:1", "2026-10-24", "", "op", trialNow);
  assert.throws(() => recordMovement(first, trialPlants, "lerberg:2", "2026-10-23", "", "op2", trialNow));
});

test("corrupt local data is rejected rather than silently overwritten", () => {
  assert.deepEqual(parseLocationState(null), emptyLocationState());
  for (const raw of ["broken", "null", "{}", '{"version":2,"positions":{},"history":[]}', '{"version":1,"positions":[],"history":[]}']) assert.throws(() => parseLocationState(raw));
  assert.deepEqual(parseLocationState('{"version":1,"positions":{"one":"unknown"},"history":[{},null]}'), emptyLocationState());
});

test("custom shelf names survive reloads and subsequent movements", () => {
  const renamed = { ...emptyLocationState(), labels: { "left-five:5": "육묘 공간" } };
  const moved = recordMovement(renamed, trialPlants, "left-five:5", "2026-10-24", "", "op", trialNow);
  assert.deepEqual(parseLocationState(JSON.stringify(moved)).labels, renamed.labels);
  assert.equal(moved.history.length, 2);
  assert.equal(moved.positions.one, "left-five:5");
});

const secondLocationPlantId = "33333333-3333-4333-8333-333333333333";
const locationOperation = "44444444-4444-4444-8444-444444444444";
const locationRequest = (payload, method = "POST") => new Request("http://localhost/api/location-logs", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const locationPayload = (extra = {}) => ({ plantIds: [plantId], destination: "left-five:5", date: "2026-10-24", note: "빛 조절", operationId: locationOperation, ...extra });

function mockLocationNotion({ failSecond = false } = {}) {
  const pages = []; const bodies = []; let fail = failSecond;
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/query")) return json({ results: pages, has_more: false });
    if (options.method !== "POST") return json({ ...wateringPage("2026-10-22"), id: String(url).split("/").at(-1), parent: { data_source_id: plantId } });
    const body = JSON.parse(options.body);
    if (fail && body.properties.식물?.relation?.[0]?.id === secondLocationPlantId) { fail = false; return Response.json({ message: "temporary failure" }, { status: 503 }); }
    bodies.push(body);
    const page = { ...returnedPage(body.properties), id: `history-${pages.length + 1}`, created_time: `2026-10-24T10:00:0${pages.length}Z` };
    pages.push(page); return json(page);
  };
  return { pages, bodies };
}

test("Notion location writes use the existing settings source and plant relation, and retry is deduplicated", async () => {
  const mock = mockLocationNotion();
  for (let i = 0; i < 2; i++) {
    const response = await locationsApi.POST(locationRequest(locationPayload()));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).results[0].success, true);
  }
  assert.equal(mock.bodies.length, 1);
  assert.equal(mock.bodies[0].parent.data_source_id, plantId);
  assert.deepEqual(mock.bodies[0].properties.식물.relation, [{ id: plantId }]);
  assert.equal(mock.bodies[0].properties.유형.select.name, "위치");
  assert.equal(mock.bodies[0].properties.위치.rich_text[0].text.content, "5단장 · 5단");
  assert.equal(mock.bodies[0].properties.식물등, undefined);
  const response = await locationsApi.GET();
  const { state } = await response.json();
  assert.equal(state.positions[plantId], "left-five:5");
  assert.equal(state.history[0].plantName, "밤비노 핑크");
  assert.equal(state.history.length, 1);
});

test("Notion location partial failures retain successes and retries only create missing records", async () => {
  const mock = mockLocationNotion({ failSecond: true });
  const payload = locationPayload({ plantIds: [plantId, secondLocationPlantId] });
  const first = await (await locationsApi.POST(locationRequest(payload))).json();
  assert.deepEqual(first.results.map((result) => result.success), [true, false]);
  const retried = await (await locationsApi.POST(locationRequest(payload))).json();
  assert.deepEqual(retried.results.map((result) => result.success), [true, true]);
  assert.equal(mock.pages.length, 2);
});

test("location rename events preserve current positions and past movements", async () => {
  const mock = mockLocationNotion();
  await locationsApi.POST(locationRequest(locationPayload()));
  const renamed = await locationsApi.PATCH(locationRequest({ locationId: "left-five:5", name: "육묘 공간", operationId: locationOperation }, "PATCH"));
  assert.equal(renamed.status, 200);
  const state = locationStateFromPages(mock.pages);
  assert.equal(state.labels["left-five:5"], "육묘 공간");
  assert.equal(state.positions[plantId], "left-five:5");
  assert.equal(state.history.length, 1);
  assert.equal(mock.pages.length, 2);
  await locationsApi.PATCH(locationRequest({ locationId: "left-five:5", name: "육묘 공간", operationId: locationOperation }, "PATCH"));
  assert.equal(mock.pages.length, 2);
});

test("location API rejects invalid input, foreign plants and absent connections without creating a record", async () => {
  for (const extra of [{ plantIds: [] }, { plantIds: Array(9).fill(plantId) }, { plantIds: ["invalid"] }, { destination: "unknown" }, { date: "2026-02-30" }, { note: "x".repeat(501) }, { operationId: "bad" }]) {
    assert.equal((await locationsApi.POST(locationRequest(locationPayload(extra)))).status, 400);
  }
  global.fetch = async (url, options = {}) => {
    assert.notEqual(String(url), "https://api.notion.com/v1/pages");
    return options.method === "POST" ? json({ results: [], has_more: false }) : json({ ...wateringPage(undefined), parent: { data_source_id: secondLocationPlantId } });
  };
  const foreign = await (await locationsApi.POST(locationRequest(locationPayload()))).json();
  assert.equal(foreign.results[0].success, false);
  delete process.env.NOTION_TOKEN;
  assert.equal((await locationsApi.GET()).status, 503);
});

test("room environment retains each last known field and ignores measurements after the event day", () => {
  const environments = [
    { id: "a", locationId: "left-five:2", date: "2026-10-20", recordedAt: "2026-10-20T00:00:00Z", temperature: 26, humidity: 85 },
    { id: "b", locationId: "left-five:2", date: "2026-10-23", recordedAt: "2026-10-23T00:00:00Z", temperature: 27 },
    { id: "c", locationId: "left-five:2", date: "2026-10-25", recordedAt: "2026-10-25T00:00:00Z", humidity: 90 },
  ];
  assert.deepEqual(environmentAt(environments, "left-five:2", "2026-10-24"), { temperature: 27, humidity: 85 });
  assert.deepEqual(environmentAt(environments, "left-five:2", "2026-11-01"), { temperature: 27, humidity: 90 });
  assert.equal(environmentAt(environments, "left-five:1", "2026-11-01"), undefined);
  const state = { ...emptyLocationState(), environments };
  const moved = recordMovement(state, trialPlants, "left-five:2", "2026-10-24", "자리 이동", "snapshot", trialNow);
  assert.deepEqual(moved.history[0].environment, { temperature: 27, humidity: 85 });
  assert.match(locationTimeline(moved, trialPlants[0].id)[0].title, /미니온실 2번\(27℃ \/ 85%\)으로 이동/);
  assert.equal(formatLocationEnvironment({ temperature: 0, humidity: 0 }), "0℃ / 0%");
  assert.equal(isEnvironment({ temperature: Infinity }), false);
});

test("Notion stores environment readings once and snapshots movements without changing old history", async () => {
  const mock = mockLocationNotion();
  const payload = { kind: "environment", locationId: "left-five:5", date: "2026-10-23", environment: { temperature: 26, humidity: 85 }, note: "첫 측정", operationId: locationOperation };
  for (let i = 0; i < 2; i++) assert.equal((await locationsApi.POST(locationRequest(payload))).status, 200);
  assert.equal(mock.pages.length, 1);
  assert.equal(mock.pages[0].properties.식물, undefined);
  await locationsApi.POST(locationRequest(locationPayload()));
  let state = locationStateFromPages(mock.pages);
  assert.deepEqual(state.history[0].environment, { temperature: 26, humidity: 85 });
  assert.equal(state.history[0].reason, "빛 조절");
  await locationsApi.POST(locationRequest({ ...payload, date: "2026-10-25", environment: { humidity: 90 }, operationId: secondLocationPlantId }));
  state = locationStateFromPages(mock.pages);
  assert.deepEqual(environmentAt(state.environments, "left-five:5", "2026-10-26"), { temperature: 26, humidity: 90 });
  assert.deepEqual(state.history[0].environment, { temperature: 26, humidity: 85 });
  assert.equal(state.environments[0].note, "첫 측정");
  assert.equal(state.environments.length, 2);
});

test("shared care creates one event, appears on every plant timeline, and never changes positions", async () => {
  const mock = mockLocationNotion();
  const input = { kind: "common", date: "2026-10-24", title: "뿌리깍지벌레 발견", note: "코니도 입제 처리", operationId: locationOperation };
  for (let i = 0; i < 2; i++) assert.equal((await locationsApi.POST(locationRequest(input))).status, 200);
  const state = locationStateFromPages(mock.pages);
  assert.equal(mock.pages.length, 1); assert.equal(state.commonCare.length, 1);
  assert.deepEqual(state.positions, {}); assert.equal(state.history.length, 0);
  for (const id of [plantId, secondLocationPlantId]) {
    assert.equal(locationTimeline(state, id)[0].category, "전체 공통");
    assert.equal(locationTimeline(state, id)[0].note, "코니도 입제 처리");
  }
});

test("room environment and common record validation rejects invalid input before Notion writes", async () => {
  for (const environment of [{}, { temperature: 81 }, { humidity: 101 }, { temperature: "26" }, { humidity: null }]) {
    assert.equal((await locationsApi.POST(locationRequest({ kind: "environment", locationId: "left-five:2", date: "2026-10-24", environment, operationId: locationOperation }))).status, 400);
  }
  assert.equal((await locationsApi.POST(locationRequest({ kind: "common", date: "2026-02-30", title: "기록", operationId: locationOperation }))).status, 400);
  assert.equal((await locationsApi.POST(locationRequest({ kind: "common", date: "2026-10-24", title: " ", operationId: locationOperation }))).status, 400);
});
