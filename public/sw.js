importScripts("/cover-icon-cache.js");

const CACHE_NAME = "plant-log-v20";
const HERO_CACHE_NAME = "plant-log-watering-hero-v1";
const COVER_ICON_CACHE_NAME = "plant-log-cover-icons-v1";
const APP_SHELL = ["/", "/icon.svg", "/cover-icon-cache.js"];
let iconWrites = Promise.resolve();

async function cachedCoverIcon(event, key) {
  const cacheRequest = new Request(key, { headers: { Accept: event.request.headers.get("Accept") || "" } });
  let cache;
  try {
    cache = await caches.open(COVER_ICON_CACHE_NAME);
    const cached = await cache.match(cacheRequest);
    if (cached) return cached;
  } catch { /* Cache storage may be unavailable in private browsing. */ }
  const response = await fetch(event.request);
  if (cache && response.ok && response.headers.get("content-type")?.startsWith("image/")) {
    const copy = response.clone();
    iconWrites = iconWrites.catch(() => undefined).then(async () => {
      const stored = copy.clone();
      const body = await copy.arrayBuffer();
      if (body.byteLength > 128_000) return;
      await cache.put(cacheRequest, stored);
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 256)).map((request) => cache.delete(request)));
    });
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== HERO_CACHE_NAME && key !== COVER_ICON_CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const iconKey = globalThis.PlantCoverIconCache.keyFor(event.request.url, self.location.origin);
  if (event.request.destination === "image" && iconKey) {
    const response = cachedCoverIcon(event, iconKey);
    event.respondWith(response);
    event.waitUntil(response.then(() => iconWrites).catch(() => undefined));
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    if (event.request.destination === "image") {
      event.respondWith(
        caches.open(HERO_CACHE_NAME).then(async (cache) => (await cache.match(event.request)) || fetch(event.request)),
      );
    }
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
