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
const plantsApi = require("../app/api/plants/route.ts");
const observationApi = require("../app/api/plant-logs/route.ts");
const wateringApi = require("../app/api/watering-logs/route.ts");
const statsApi = require("../app/api/watering-stats/route.ts");
const plantId = "11111111-1111-4111-8111-111111111111";
const originalFetch = global.fetch;
const envKeys = ["NOTION_TOKEN", "NOTION_PLANTS_DATA_SOURCE_ID", "NOTION_DATA_SOURCE_ID", "NOTION_DATABASE_ID", "NOTION_WATERING_DATA_SOURCE_ID"];
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

test("watering hides dead plants and only moss-containing pups", () => {
  const plant = { id: plantId, name: "자구", category: "자구" };
  assert.equal(canShowInWateringList({ ...plant, currentSoils: ["수태", "펄라이트"] }), false);
  assert.equal(canShowInWateringList({ ...plant, currentSoils: ["세라미스", "펄라이트"] }), true);
  assert.equal(canShowInWateringList({ ...plant, category: "사망" }), false);
  assert.equal(canShowInWateringList({ ...plant, category: "알로카시아", currentSoils: ["수태"] }), true);
  assert.equal(isWateredToday(plant, [{ id: plantId.replaceAll("-", ""), name: "다른 이름" }], "2026-10-11"), true);
  assert.equal(isWateredToday({ ...plant, lastWateredAt: "2026-10-10T16:00:00Z" }, [], "2026-10-11"), true);
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
