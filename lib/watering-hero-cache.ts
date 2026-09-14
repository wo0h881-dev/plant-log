const HERO_CACHE_NAME = "plant-log-watering-hero-v1";
const HERO_PHOTO_URL_KEY = "plant-log:watering-hero-photo";

export function readCachedWateringHeroPhoto() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(HERO_PHOTO_URL_KEY) || undefined;
}

export async function cacheWateringHeroPhoto(url: string) {
  window.localStorage.setItem(HERO_PHOTO_URL_KEY, url);
  if (!("caches" in window)) return;

  const response = await fetch(url, { mode: "no-cors", cache: "force-cache" });
  const cache = await window.caches.open(HERO_CACHE_NAME);
  const previousRequests = await cache.keys();
  await Promise.all(previousRequests.filter((request) => request.url !== url).map((request) => cache.delete(request)));
  await cache.put(url, response);
}

export async function clearCachedWateringHeroPhoto() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HERO_PHOTO_URL_KEY);
  if ("caches" in window) await window.caches.delete(HERO_CACHE_NAME);
}

