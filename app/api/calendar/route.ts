import { NextRequest, NextResponse } from "next/server";
import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import type { PlantCalendarEvent } from "@/types/plant";

const NOTION_API_BASE = "https://api.notion.com/v1";

type RichText = { plain_text?: string };
type NotionProperty = {
  type?: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  relation?: Array<{ id?: string }>;
  date?: { start?: string | null } | null;
};
type NotionPage = { id: string; properties: Record<string, NotionProperty> };
type QueryResponse = { results: NotionPage[]; has_more?: boolean; next_cursor?: string | null };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readText(property?: NotionProperty) {
  const values = property?.type === "title" ? property.title : property?.rich_text;
  return values?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  return {
    start: `${month}-01`,
    end: `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`,
  };
}

async function queryAllPages(token: string, dataSourceId: string, dateProperty: string, start: string, end: string) {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const payload = await readNotionJson<QueryResponse>(
      await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: createNotionHeaders(token),
        body: JSON.stringify({
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
          filter: {
            and: [
              { property: dateProperty, date: { on_or_after: start } },
              { property: dateProperty, date: { before: end } },
            ],
          },
          sorts: [{ property: dateProperty, direction: "ascending" }],
        }),
      }),
    );
    pages.push(...payload.results);
    cursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined;
  } while (cursor);

  return pages;
}

async function queryConfiguredDatabase(
  token: string,
  databaseId: string,
  configuredDataSourceId: string | undefined,
  dateProperty: string,
  start: string,
  end: string,
) {
  const dataSourceId = configuredDataSourceId || (await resolveDataSourceId(token, databaseId));
  return queryAllPages(token, dataSourceId, dateProperty, start, end);
}

function parseWateringEvents(pages: NotionPage[]): PlantCalendarEvent[] {
  return pages.flatMap((page) => {
    const date = page.properties["날짜"]?.date?.start?.slice(0, 10);
    const plantName = readText(page.properties["이름"]).replace(/^💧\s*/, "");
    if (!date || !plantName) return [];
    return [{
      id: `watering-${page.id}`,
      type: "watering" as const,
      date,
      plantId: page.properties["식물"]?.relation?.[0]?.id,
      plantName,
      note: readText(page.properties["메모"]),
    }];
  });
}

function parseObservationEvents(pages: NotionPage[]): PlantCalendarEvent[] {
  return pages.flatMap((page) => {
    const date = page.properties["관찰일"]?.date?.start?.slice(0, 10);
    const plantName = readText(page.properties["식물명"]);
    if (!date || !plantName) return [];
    return [{
      id: `observation-${page.id}`,
      type: "observation" as const,
      date,
      plantId: page.properties["식물"]?.relation?.[0]?.id,
      plantName,
      note: readText(page.properties["관찰일지"]),
      tags: page.properties["관찰태그"]?.multi_select?.map((item) => item.name?.trim() ?? "").filter(Boolean),
    }];
  });
}

function parseRepottingEvents(pages: NotionPage[]): PlantCalendarEvent[] {
  return pages.flatMap((page) => {
    if (page.properties["유형"]?.select?.name !== "분갈이") return [];
    const date = page.properties["날짜"]?.date?.start?.slice(0, 10);
    const plantName = readText(page.properties["이름"]).replace(/\s*분갈이$/, "");
    if (!date || !plantName) return [];
    return [{
      id: `repotting-${page.id}`,
      type: "repotting" as const,
      date,
      plantId: page.properties["식물"]?.relation?.[0]?.id,
      plantName,
      note: readText(page.properties["메모"]),
      tags: page.properties["흙"]?.multi_select?.map((item) => item.name?.trim() ?? "").filter(Boolean),
    }];
  });
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month")?.trim() ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ message: "올바른 월을 선택하세요." }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ events: [] }, { headers: { "Cache-Control": "no-store" } });

  const observationDatabaseId = process.env.NOTION_DATABASE_ID;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const settingsDatabaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
  const { start, end } = getMonthRange(month);

  try {
    const [observationPages, wateringPages, settingsPages] = await Promise.all([
      observationDatabaseId
        ? queryConfiguredDatabase(token, observationDatabaseId, process.env.NOTION_DATA_SOURCE_ID, "관찰일", start, end)
        : Promise.resolve([]),
      wateringDatabaseId
        ? queryConfiguredDatabase(token, wateringDatabaseId, process.env.NOTION_WATERING_DATA_SOURCE_ID, "날짜", start, end)
        : Promise.resolve([]),
      settingsDatabaseId
        ? queryConfiguredDatabase(token, settingsDatabaseId, process.env.NOTION_SETTINGS_DATA_SOURCE_ID, "날짜", start, end)
        : Promise.resolve([]),
    ]);
    const events = [...parseWateringEvents(wateringPages), ...parseObservationEvents(observationPages), ...parseRepottingEvents(settingsPages)]
      .sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "관리 기록을 불러오지 못했습니다.";
    return NextResponse.json({ events: [], message }, { status: 500 });
  }
}
