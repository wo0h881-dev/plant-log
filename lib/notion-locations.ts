import { createNotionHeaders, hasNotionPageId, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import { emptyLocationState, LOCATIONS, locationLabel, type LocationState } from "@/lib/plant-locations";
import { PlantRequestError } from "@/lib/notion-plant-page";

const API = "https://api.notion.com/v1";
type Property = {
  rich_text?: { plain_text?: string; text?: { content?: string } }[];
  title?: { plain_text?: string; text?: { content?: string } }[];
  relation?: { id: string }[];
  date?: { start?: string };
};
export type LocationPage = { id: string; created_time?: string; properties: Record<string, Property> };
export const propertyText = (property?: Property) => (property?.rich_text ?? property?.title)?.map((part) => part.plain_text ?? part.text?.content ?? "").join("") ?? "";
const richText = (content: string) => ({ rich_text: content ? [{ text: { content } }] : [] });

export async function locationConnection() {
  const token = process.env.NOTION_TOKEN;
  const source = process.env.NOTION_SETTINGS_DATA_SOURCE_ID;
  const database = process.env.NOTION_SETTINGS_DATABASE_ID;
  if (!token || (!source && !database)) throw new PlantRequestError("식물 세팅 변경 기록 DB 연결을 확인해주세요.", 503);
  return { token, source: source || await resolveDataSourceId(token, database!) };
}

export async function readLocationPages(connection: { token: string; source: string }) {
  const pages: LocationPage[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  do {
    if (++pageCount > 20) throw new PlantRequestError("위치 이력이 많아 조회를 완료하지 못했어요. 관리자 확인이 필요해요.", 503);
    const payload = await readNotionJson<{ results: LocationPage[]; has_more?: boolean; next_cursor?: string }>(await fetch(`${API}/data_sources/${connection.source}/query`, {
      method: "POST", headers: createNotionHeaders(connection.token), cache: "no-store",
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}), filter: { property: "유형", select: { equals: "위치" } }, sorts: [{ timestamp: "created_time", direction: "ascending" }] }),
    }));
    pages.push(...payload.results);
    if (payload.has_more && (!payload.next_cursor || payload.next_cursor === cursor)) throw new Error("위치 이력의 다음 페이지를 확인하지 못했어요.");
    cursor = payload.has_more ? payload.next_cursor : undefined;
  } while (cursor);
  return pages;
}

export function locationStateFromPages(pages: LocationPage[]): LocationState {
  const state = emptyLocationState();
  state.labels = {};
  const sorted = [...pages].sort((a, b) => (a.created_time ?? "").localeCompare(b.created_time ?? ""));
  for (const page of sorted) {
    const id = propertyText(page.properties.위치ID);
    const location = LOCATIONS.find((item) => item.id === id);
    if (!location) continue;
    const label = propertyText(page.properties.위치);
    const prefix = `${location.groupName} · `;
    if (label) state.labels[id] = label.startsWith(prefix) ? label.slice(prefix.length) : label;
  }
  const movements = sorted.filter((page) => Boolean(page.properties.식물?.relation?.[0]?.id));
  movements.sort((a, b) => (a.properties.날짜?.date?.start ?? "").localeCompare(b.properties.날짜?.date?.start ?? "") || (a.created_time ?? "").localeCompare(b.created_time ?? ""));
  for (const page of movements) {
    const plantId = page.properties.식물?.relation?.[0]?.id;
    const to = propertyText(page.properties.위치ID);
    const date = page.properties.날짜?.date?.start?.slice(0, 10);
    if (!plantId || !hasNotionPageId(plantId) || !date || !LOCATIONS.some((item) => item.id === to)) continue;
    const from = state.positions[plantId] ?? null;
    state.positions[plantId] = to;
    state.history.unshift({ id: page.id, plantId, plantName: propertyText(page.properties.이름).replace(/ 위치 이동$/, "") || "식물", from, to, date, reason: propertyText(page.properties.메모), recordedAt: page.created_time ?? `${date}T00:00:00Z` });
  }
  return state;
}

export async function createLocationPage(connection: { token: string; source: string }, input: {
  plantId?: string; plantName?: string; from?: string | null; to: string; label: string;
  date: string; note: string; operationKey: string; labels?: Record<string, string>;
}) {
  return readNotionJson<LocationPage>(await fetch(`${API}/pages`, {
    method: "POST", headers: createNotionHeaders(connection.token),
    body: JSON.stringify({ parent: { type: "data_source_id", data_source_id: connection.source }, properties: {
      이름: { title: [{ text: { content: input.plantId ? `${input.plantName} 위치 이동` : "공간 이름 변경" } }] },
      날짜: { date: { start: input.date } }, 유형: { select: { name: "위치" } },
      ...(input.plantId ? { 식물: { relation: [{ id: input.plantId }] } } : {}),
      위치: richText(input.label), 위치ID: richText(input.to), 이동ID: richText(input.operationKey),
      "이전 위치": richText(input.plantId ? locationLabel(input.from, input.labels) : ""), 메모: richText(input.note),
    } }),
  }));
}
