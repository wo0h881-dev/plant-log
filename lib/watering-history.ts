import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";

type WateringPage = {
  properties: Record<string, {
    title?: Array<{ plain_text?: string }>;
    relation?: Array<{ id: string }>;
    date?: { start: string } | null;
  }>;
};

export async function readWateringHistory(filter: Record<string, unknown>) {
  const token = process.env.NOTION_TOKEN;
  const database = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredSource = process.env.NOTION_WATERING_DATA_SOURCE_ID;
  if (!token || (!database && !configuredSource)) throw new Error("물주기 기록 DB 연결을 확인하세요.");
  const source = configuredSource || await resolveDataSourceId(token, database!);
  const pages: WateringPage[] = [];
  let cursor: string | undefined;
  do {
    const payload = await readNotionJson<{ results: WateringPage[]; has_more?: boolean; next_cursor?: string | null }>(
      await fetch(`https://api.notion.com/v1/data_sources/${source}/query`, {
        method: "POST", headers: createNotionHeaders(token), cache: "no-store",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor,
          filter: { and: [{ property: "물줌", checkbox: { equals: true } }, filter] },
          sorts: [{ property: "날짜", direction: "descending" }],
        }),
      }),
    );
    pages.push(...payload.results);
    cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages;
}
