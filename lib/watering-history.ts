import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import { readFertilizerRecord } from "@/lib/fertilizer";
import { normalizeDay, wateringPlantKey } from "@/lib/watering";

type WateringPage = {
  id?: string;
  url?: string;
  properties: Record<string, {
    title?: Array<{ plain_text?: string }>;
    relation?: Array<{ id: string }>;
    date?: { start: string } | null;
    select?: { name?: string } | null;
    multi_select?: Array<{ name?: string }>;
    rich_text?: Array<{ plain_text?: string }>;
  }>;
};

async function wateringSource() {
  const token = process.env.NOTION_TOKEN;
  const database = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredSource = process.env.NOTION_WATERING_DATA_SOURCE_ID;
  if (!token || (!database && !configuredSource)) throw new Error("물주기 기록 DB 연결을 확인하세요.");
  return { headers: createNotionHeaders(token), url: `https://api.notion.com/v1/data_sources/${configuredSource || await resolveDataSourceId(token, database!)}` };
}

async function queryWateringHistory(source: Awaited<ReturnType<typeof wateringSource>>, filters: Record<string, unknown>[], properties: string[] = []) {
  const query = new URL(`${source.url}/query`);
  for (const property of properties) query.searchParams.append("filter_properties", property);
  const pages: WateringPage[] = [];
  let cursor: string | undefined;
  do {
    const payload = await readNotionJson<{ results: WateringPage[]; has_more?: boolean; next_cursor?: string | null }>(
      await fetch(query.toString(), {
        method: "POST", headers: source.headers, cache: "no-store",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor,
          filter: { and: [{ property: "물줌", checkbox: { equals: true } }, ...filters] },
          sorts: [{ property: "날짜", direction: "descending" }],
        }),
      }),
    );
    pages.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages;
}

export async function readWateringHistory(filter: Record<string, unknown>) {
  return queryWateringHistory(await wateringSource(), [filter]);
}

export async function readLastFertilizedDates(today: string) {
  const source = await wateringSource();
  const schema = await readNotionJson<{ properties?: Record<string, { type: string }> }>(
    await fetch(source.url, { headers: source.headers, cache: "no-store" }),
  );
  const fertilizerFields = [
    ["비료", "select"], ["사용 비료", "multi_select"], ["비료 내용", "rich_text"],
  ].filter(([property, type]) => schema.properties?.[property]?.type === type);
  if (!fertilizerFields.length) return {};
  const hasFertilizer = fertilizerFields.map(([property, type]) => ({ property, [type]: { is_not_empty: true } }));
  const pages = await queryWateringHistory(source, [
    hasFertilizer.length === 1 ? hasFertilizer[0] : { or: hasFertilizer },
    { property: "식물", relation: { is_not_empty: true } },
  ], ["식물", "날짜", ...fertilizerFields.map(([property]) => property)]);
  const dates = new Map<string, string>();
  for (const { properties } of pages) {
    const day = normalizeDay(properties["날짜"]?.date?.start ?? "");
    if (!day || day > today || !readFertilizerRecord(properties)) continue;
    for (const { id } of properties["식물"]?.relation ?? []) {
      const key = wateringPlantKey(id);
      if (day > (dates.get(key) ?? "")) dates.set(key, day);
    }
  }
  return Object.fromEntries(dates);
}
