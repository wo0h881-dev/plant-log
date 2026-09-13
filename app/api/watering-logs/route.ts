import { NextResponse } from "next/server";
import {
  createNotionHeaders,
  createWateringLogPage,
  readNotionJson,
  resolveDataSourceId,
} from "@/lib/notion";

const NOTION_API_BASE = "https://api.notion.com/v1";

type WateringPlant = {
  id: string;
  name: string;
};

type WateringResult = {
  plantId: string;
  plantName: string;
  ok: boolean;
  pageId?: string;
  message?: string;
};

type RichText = { plain_text?: string };
type WateringLogPage = {
  properties: Record<string, {
    title?: RichText[];
    relation?: Array<{ id?: string }>;
  }>;
};

type WateringQueryResponse = {
  results: WateringLogPage[];
};

export const runtime = "nodejs";

function getSeoulDateValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readTitle(page: WateringLogPage) {
  return (page.properties["이름"]?.title ?? [])
    .map((text) => text.plain_text ?? "")
    .join("")
    .replace(/^💧\s*/, "")
    .trim();
}

export async function GET(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredWateringDataSourceId = process.env.NOTION_WATERING_DATA_SOURCE_ID;
  const requestedDate = new URL(request.url).searchParams.get("date") || getSeoulDateValue();

  if (!token || !wateringDatabaseId) {
    return NextResponse.json({ plants: [], wateredAt: requestedDate }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return NextResponse.json({ message: "올바른 날짜를 선택하세요." }, { status: 400 });
  }

  try {
    const dataSourceId = configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId));
    const payload = await readNotionJson<WateringQueryResponse>(
      await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: createNotionHeaders(token),
        body: JSON.stringify({
          page_size: 100,
          filter: { property: "날짜", date: { equals: requestedDate } },
        }),
      }),
    );
    const uniquePlants = new Map<string, WateringPlant>();

    for (const page of payload.results) {
      const id = page.properties["식물"]?.relation?.[0]?.id ?? "";
      const name = readTitle(page);
      if (!name) continue;
      uniquePlants.set(id || name, { id, name });
    }

    return NextResponse.json(
      { plants: [...uniquePlants.values()], wateredAt: requestedDate },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "오늘 물주기 기록을 불러오지 못했습니다.";
    return NextResponse.json({ plants: [], wateredAt: requestedDate, message }, { status: 500 });
  }
}

async function createWateringLogWithRetry(
  params: Parameters<typeof createWateringLogPage>[0],
  retries = 2,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await createWateringLogPage(params);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredWateringDataSourceId = process.env.NOTION_WATERING_DATA_SOURCE_ID;

  if (!token || !wateringDatabaseId) {
    return NextResponse.json(
      { message: "NOTION_TOKEN, NOTION_WATERING_DATABASE_ID를 설정하세요." },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as {
      plants?: WateringPlant[];
      wateredAt?: string;
      note?: string;
    };
    const plants = payload.plants?.filter((plant) => plant.id && plant.name) ?? [];
    const wateredAt = payload.wateredAt || new Date().toISOString();
    const note = payload.note?.trim() ?? "물 줌";

    if (!plants.length) {
      return NextResponse.json({ message: "물 준 식물을 선택하세요." }, { status: 400 });
    }

    const wateringParentId =
      configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId));
    const results: WateringResult[] = [];

    for (const plant of plants) {
      try {
        const page = await createWateringLogWithRetry({
          token,
          parentId: wateringParentId,
          plantId: plant.id,
          plantName: plant.name,
          wateredAt,
          note,
        });

        results.push({
          plantId: plant.id,
          plantName: plant.name,
          ok: true,
          pageId: page.id,
        });
      } catch (error) {
        results.push({
          plantId: plant.id,
          plantName: plant.name,
          ok: false,
          message: error instanceof Error ? error.message : "저장에 실패했습니다.",
        });
      }
    }

    return NextResponse.json({
      count: results.length,
      successCount: results.filter((result) => result.ok).length,
      failureCount: results.filter((result) => !result.ok).length,
      results,
      wateredAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
