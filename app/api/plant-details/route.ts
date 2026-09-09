import { NextRequest, NextResponse } from "next/server";
import {
  createNotionHeaders,
  hasNotionPageId,
  readNotionJson,
  resolveDataSourceId,
} from "@/lib/notion";
import type { PlantObservationSummary } from "@/types/plant";

const NOTION_API_BASE = "https://api.notion.com/v1";

type RichText = { plain_text?: string };
type NotionProperty = {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  multi_select?: Array<{ name?: string }>;
  date?: { start?: string | null } | null;
};
type ObservationPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty>;
};
type ObservationQueryResponse = { results: ObservationPage[] };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readText(property?: NotionProperty) {
  const values = property?.type === "title" ? property.title : property?.rich_text;
  return values?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function parseObservation(page: ObservationPage): PlantObservationSummary {
  return {
    id: page.id,
    date: page.properties["관찰일"]?.date?.start ?? undefined,
    note: readText(page.properties["관찰일지"]),
    tags: page.properties["관찰태그"]?.multi_select?.map((item) => item.name?.trim() ?? "").filter(Boolean) ?? [],
    url: page.url,
  };
}

export async function GET(request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const observationDatabaseId = process.env.NOTION_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const plantId = request.nextUrl.searchParams.get("plantId")?.trim() ?? "";

  if (!hasNotionPageId(plantId)) {
    return NextResponse.json({ message: "올바른 식물을 선택하세요." }, { status: 400 });
  }

  if (!token || !observationDatabaseId) {
    return NextResponse.json({ observations: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const dataSourceId = configuredDataSourceId || (await resolveDataSourceId(token, observationDatabaseId));
    const payload = await readNotionJson<ObservationQueryResponse>(
      await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: createNotionHeaders(token),
        body: JSON.stringify({
          page_size: 5,
          filter: { property: "식물", relation: { contains: plantId } },
          sorts: [{ property: "관찰일", direction: "descending" }],
        }),
      }),
    );

    return NextResponse.json(
      { observations: payload.results.map(parseObservation) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "최근 관찰 기록을 불러오지 못했습니다.";
    return NextResponse.json({ observations: [], message }, { status: 500 });
  }
}
