import { NextResponse } from "next/server";
import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import { fallbackPlants, parseNotionPlantPage } from "@/lib/plants";

const NOTION_API_BASE = "https://api.notion.com/v1";

type NotionQueryResponse = {
  results: Array<Parameters<typeof parseNotionPlantPage>[0]>;
  has_more: boolean;
  next_cursor: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const plantsDatabaseId = process.env.NOTION_PLANTS_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_PLANTS_DATA_SOURCE_ID;

  if (!token || !plantsDatabaseId) {
    return NextResponse.json(
      { plants: fallbackPlants, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const dataSourceId = configuredDataSourceId || (await resolveDataSourceId(token, plantsDatabaseId));
    const pages: NotionQueryResponse["results"] = [];
    let startCursor: string | null = null;

    do {
      const payload: NotionQueryResponse = await readNotionJson<NotionQueryResponse>(
        await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
          method: "POST",
          headers: createNotionHeaders(token),
          body: JSON.stringify({
            page_size: 100,
            ...(startCursor ? { start_cursor: startCursor } : {}),
          }),
        }),
      );

      pages.push(...payload.results);
      startCursor = payload.has_more ? payload.next_cursor : null;
    } while (startCursor);

    const plants = pages
      .map((page) => parseNotionPlantPage(page))
      .filter((plant) => plant !== null)
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "ko"));

    return NextResponse.json(
      {
        plants: plants.length ? plants : fallbackPlants,
        source: plants.length ? "notion" : "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { plants: fallbackPlants, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
