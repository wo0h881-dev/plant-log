/* eslint-disable @typescript-eslint/no-require-imports -- Service worker isolation tests. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const origin = "https://plant.example";
const source = "https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/photo.jpg";
const icon = (asset, width = 96, marked = true) => `${origin}/_next/image?${new URLSearchParams({ url: asset, w: String(width), q: "75", ...(marked ? { cover_icon: "1" } : {}) })}`;
const helper = fs.readFileSync(path.join(__dirname, "../public/cover-icon-cache.js"), "utf8");
const worker = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");

function runtime(storageFails = false) {
  const handlers = {};
  const saved = new Map();
  let networkRequests = 0;
  const context = vm.createContext({ URL, URLSearchParams, Request, Response, Promise,
    self: { location: { origin }, addEventListener: (name, callback) => { handlers[name] = callback; } },
    caches: { open: async () => {
      if (storageFails) throw new Error("Storage disabled");
      return { match: async (request) => saved.get(request.url)?.clone(), put: async (request, response) => { saved.set(request.url, response.clone()); }, keys: async () => [...saved.keys()].map((url) => new Request(url)), delete: async (request) => saved.delete(request.url) };
    } },
    fetch: async () => { networkRequests++; return new Response("image-bytes", { headers: { "Content-Type": "image/webp" } }); },
  });
  context.importScripts = () => vm.runInContext(helper, context);
  vm.runInContext(worker, context);
  async function image(url) {
    const waits = [];
    let response;
    const request = new Request(url, { headers: { Accept: "image/webp" } });
    Object.defineProperty(request, "destination", { value: "image" });
    handlers.fetch({ request, respondWith: (promise) => { response = promise; }, waitUntil: (promise) => { waits.push(promise); } });
    if (!response) return;
    const value = await response;
    await Promise.all(waits);
    return value.text();
  }
  return { context, image, saved, requests: () => networkRequests };
}

test("only opted-in small cover icons get a persistent key", () => {
  const { context } = runtime();
  const key = context.PlantCoverIconCache.keyFor;
  assert.equal(key(icon(source, 640), origin), undefined);
  assert.equal(key(icon(source, 96, false), origin), undefined);
  assert.equal(key(source, origin), undefined);
  assert.equal(key(icon("https://untrusted.example/image.jpg"), origin), undefined);
  assert.ok(key(icon(source), origin));
});

test("signature refresh reuses the icon but a changed cover fetches a new one", async () => {
  const app = runtime();
  assert.equal(await app.image(icon(`${source}?X-Amz-Signature=one&X-Amz-Expires=3600`)), "image-bytes");
  assert.equal(await app.image(icon(`${source}?X-Amz-Signature=two&X-Amz-Expires=7200`)), "image-bytes");
  assert.equal(app.requests(), 1);
  await app.image(icon(source.replace("photo.jpg", "new-photo.jpg")));
  assert.equal(app.requests(), 2);
  assert.equal(app.saved.size, 2);
});

test("disabled cache storage never prevents the photo from loading", async () => {
  const app = runtime(true);
  assert.equal(await app.image(icon(source)), "image-bytes");
  assert.equal(app.requests(), 1);
});
