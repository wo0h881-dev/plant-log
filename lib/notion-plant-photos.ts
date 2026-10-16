import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import type { PlantPhotoSummary } from "@/types/plant";

type FileValue = { name?: string; file?: { url: string }; external?: { url: string } };

export async function listPlantPhotos(token: string, plantId: string, includeObservations = false) {
  const photos: PlantPhotoSummary[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
    const payload = await readNotionJson<{
      results: Array<{ id: string; type: string; created_time?: string; image?: FileValue }>;
      has_more: boolean; next_cursor?: string | null;
    }>(await fetch(`https://api.notion.com/v1/blocks/${plantId}/children?${params}`, { headers: createNotionHeaders(token), cache: "no-store" }));
    for (const block of payload.results) {
      const url = block.image?.file?.url ?? block.image?.external?.url;
      if (block.type === "image" && url) photos.push({ id: block.id, name: "식물 본문 사진", url, date: block.created_time });
    }
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);
  const database = process.env.NOTION_DATABASE_ID;
  const source = process.env.NOTION_DATA_SOURCE_ID || (includeObservations && database ? await resolveDataSourceId(token, database) : undefined);
  if (includeObservations && source) {
    do {
      const payload = await readNotionJson<{
        results: Array<{ id: string; properties: Record<string, { files?: FileValue[]; date?: { start: string } }> }>;
        has_more: boolean; next_cursor?: string | null;
      }>(await fetch(`https://api.notion.com/v1/data_sources/${source}/query`, {
        method: "POST", headers: createNotionHeaders(token), cache: "no-store",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor, filter: { property: "식물", relation: { contains: plantId } }, sorts: [{ property: "관찰일", direction: "descending" }] }),
      }));
      for (const page of payload.results) {
        for (const [index, file] of (page.properties["사진"]?.files ?? []).entries()) {
          const url = file.file?.url ?? file.external?.url;
          if (url) photos.push({ id: `${page.id}-${index}`, name: file.name ?? "관찰 사진", url, date: page.properties["관찰일"]?.date?.start });
        }
      }
      cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
    } while (cursor);
  }
  return photos.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
