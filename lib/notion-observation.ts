import { createNotionHeaders, hasNotionPageId, readNotionJson } from "@/lib/notion";
import { PlantRequestError } from "@/lib/notion-plant-page";
import { normalizeDay } from "@/lib/watering";

const BASE = "https://api.notion.com/v1";
const WINDOW_MS = 5 * 60_000;
type RichText = { type?: string; text?: { content: string; link?: { url: string } | null }; plain_text?: string; annotations?: Record<string, unknown>; mention?: unknown; equation?: unknown };
type StoredFile = { name: string; type: "file" | "external" | "file_upload"; file?: { url: string }; external?: { url: string }; file_upload?: { id: string } };
type Property = { id?: string; rich_text?: RichText[]; files?: StoredFile[]; multi_select?: { name: string }[]; relation?: { id: string }[]; date?: { start: string } | null };
export type ObservationPage = { id: string; url?: string; created_time: string; archived?: boolean; in_trash?: boolean; parent?: { data_source_id?: string }; properties: Record<string, Property> };

const sameId = (a?: string, b?: string) => Boolean(a && b && a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase());

export function isRecentObservation(page: ObservationPage, source: string, plantId: string, date: string, now = Date.now()) {
  const age = now - Date.parse(page.created_time);
  return !page.archived && !page.in_trash && sameId(page.parent?.data_source_id, source) && Number.isFinite(age) && age >= 0 && age <= WINDOW_MS &&
    page.properties.식물?.relation?.some((plant) => sameId(plant.id, plantId)) && normalizeDay(page.properties.관찰일?.date?.start ?? "") === date;
}

export async function findRecentObservation(token: string, source: string, plantId: string, date: string) {
  const now = Date.now();
  const payload = await readNotionJson<{ results: ObservationPage[] }>(await fetch(`${BASE}/data_sources/${source}/query`, {
    method: "POST", headers: createNotionHeaders(token), cache: "no-store",
    body: JSON.stringify({ page_size: 1, sorts: [{ timestamp: "created_time", direction: "descending" }], filter: { and: [
      { property: "식물", relation: { contains: plantId } },
      { property: "관찰일", date: { equals: date } },
      { timestamp: "created_time", created_time: { on_or_after: new Date(now - WINDOW_MS).toISOString() } },
      { timestamp: "created_time", created_time: { on_or_before: new Date(now).toISOString() } },
    ] } }),
  }));
  const page = payload.results.find((item) => isRecentObservation(item, source, plantId, date, now));
  return page ? { id: page.id, createdAt: page.created_time, note: (page.properties.관찰일지?.rich_text ?? []).map((part) => part.plain_text ?? part.text?.content ?? "").join(""), photoCount: page.properties.사진?.files?.length ?? 0 } : null;
}

export async function readAppendableObservation(token: string, source: string, pageId: string, plantId: string, date: string) {
  if (!hasNotionPageId(pageId) || !hasNotionPageId(plantId)) throw new PlantRequestError("추가할 관찰일지와 식물을 확인하세요.");
  const page = await readNotionJson<ObservationPage>(await fetch(`${BASE}/pages/${pageId}`, { headers: createNotionHeaders(token), cache: "no-store" }));
  if (!isRecentObservation(page, source, plantId, date)) throw new PlantRequestError("같은 식물·관찰 날짜로 5분 이내 작성한 일지에만 추가할 수 있어요. 새 일지로 저장해주세요.", 409);
  return page;
}

async function fullNote(token: string, page: ObservationPage) {
  const property = page.properties.관찰일지;
  const parts = property?.rich_text ?? [];
  if (parts.length < 25) return parts;
  if (!property.id) throw new PlantRequestError("기존 메모 전체를 확인할 수 없어 추가하지 않았어요.", 409);
  const all: RichText[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
    const result: { results: { rich_text: RichText }[]; has_more: boolean; next_cursor: string | null } = await readNotionJson(await fetch(`${BASE}/pages/${page.id}/properties/${property.id}?${query}`, { headers: createNotionHeaders(token), cache: "no-store" }));
    all.push(...result.results.map((item) => item.rich_text));
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return all;
}

export async function appendObservation({ token, source, pageId, plantId, date, note, tags, photos }: {
  token: string; source: string; pageId: string; plantId: string; date: string; note: string; tags: string[]; photos: { id: string; name: string }[];
}) {
  // Read again after uploads so a stale form does not replace newer notes or attachments.
  const page = await readAppendableObservation(token, source, pageId, plantId, date);
  const previousNote = await fullNote(token, page);
  const richText: RichText[] = previousNote.map((part) => ({
    ...(part.type ? { type: part.type } : {}),
    ...(part.text ? { text: part.text } : {}),
    ...(part.annotations ? { annotations: part.annotations } : {}),
    ...(part.mention ? { mention: part.mention } : {}),
    ...(part.equation ? { equation: part.equation } : {}),
  }));
  const addedNote = `${previousNote.length && note ? "\n\n" : ""}${note}`;
  for (let offset = 0; offset < addedNote.length; offset += 2000) richText.push({ type: "text", text: { content: addedNote.slice(offset, offset + 2000) } });
  const mergedTags = [...new Set([...(page.properties.관찰태그?.multi_select ?? []).map((tag) => tag.name).filter((tag) => !(tag === "좋음" && tags.includes("안좋음")) && !(tag === "안좋음" && tags.includes("좋음"))), ...tags])];
  const oldFiles = (page.properties.사진?.files ?? []).map((file) => ({ name: file.name, type: file.type, ...(file.file ? { file: { url: file.file.url } } : {}), ...(file.external ? { external: file.external } : {}), ...(file.file_upload ? { file_upload: file.file_upload } : {}) }));
  if (richText.length > 100 || oldFiles.length + photos.length > 100 || mergedTags.length > 100) throw new PlantRequestError("기존 일지의 용량이 커서 추가할 수 없어요. 새 일지로 저장해주세요.", 409);
  const properties = {
    ...(note ? { 관찰일지: { rich_text: richText } } : {}),
    ...(tags.length ? { 관찰태그: { multi_select: mergedTags.map((name) => ({ name })) } } : {}),
    ...(photos.length ? { 사진: { files: [...oldFiles, ...photos.map((photo) => ({ name: photo.name, type: "file_upload", file_upload: { id: photo.id } }))] } } : {}),
  };
  const updated = await readNotionJson<{ id: string; url?: string }>(await fetch(`${BASE}/pages/${pageId}`, { method: "PATCH", headers: createNotionHeaders(token), body: JSON.stringify({ properties }) }));
  let warning: string | undefined;
  if (photos.length) {
    try {
      await readNotionJson(await fetch(`${BASE}/blocks/${pageId}/children`, { method: "PATCH", headers: createNotionHeaders(token), body: JSON.stringify({ children: photos.map((photo) => ({ object: "block", type: "image", image: { type: "file_upload", file_upload: { id: photo.id }, caption: [{ type: "text", text: { content: photo.name } }] } })) }) }));
    } catch {
      warning = "일지와 사진 속성은 저장했지만 본문 사진 추가에 실패했어요. 중복 저장하지 말고 Notion 사진 속성을 확인해주세요.";
    }
  }
  return { ...updated, warning };
}
