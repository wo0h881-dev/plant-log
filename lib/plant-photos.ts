import type { PlantPhotoSummary } from "@/types/plant";
import { NOTION_COVER_HOST } from "@/lib/plant-cover";

function photoKey(src: string) {
  try {
    const url = new URL(src, "https://plant-log.local");
    if (url.hostname === NOTION_COVER_HOST) {
      for (const key of [...url.searchParams.keys()]) {
        if (key.toLowerCase().startsWith("x-amz-") || ["awsaccesskeyid", "signature", "expires"].includes(key.toLowerCase())) url.searchParams.delete(key);
      }
    }
    url.hash = "";
    url.searchParams.sort();
    return url.href;
  } catch { return src; }
}

export function uniquePlantPhotos(photos: PlantPhotoSummary[]) {
  return [...new Map(photos.map((photo) => [photoKey(photo.url), photo])).values()];
}

export function plantCarouselPhotos(plantId: string, plantName: string, cover: string | undefined, recent: PlantPhotoSummary[]) {
  const coverPhoto = cover ? [{ id: `${plantId}-cover`, name: plantName, url: cover }] : [];
  return uniquePlantPhotos([...coverPhoto, ...recent.filter((photo) => !cover || photoKey(photo.url) !== photoKey(cover))]);
}
