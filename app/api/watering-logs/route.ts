import { NextResponse } from "next/server";
import {
  createWateringLogPage,
  createPlantLogPage,
  hasNotionPageId,
  readWateringFertilizers,
  resolveDataSourceId,
} from "@/lib/notion";
import { readWateringHistory } from "@/lib/watering-history";
import type { WateredPlant } from "@/lib/watering";

type WateringPlant = {
  id: string;
  name: string;
  category?: string;
};

type WateringResult = {
  plantId: string;
  plantName: string;
  ok: boolean;
  pageId?: string;
  message?: string;
  observationWarning?: boolean;
};

type RichText = { plain_text?: string };
type WateringLogPage = {
  properties: Record<string, {
    title?: RichText[];
    relation?: Array<{ id?: string }>;
  }>;
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
  if (new URL(request.url).searchParams.get("options") === "fertilizer") {
    const source = process.env.NOTION_WATERING_DATA_SOURCE_ID;
    if (!token || (!source && !wateringDatabaseId)) return NextResponse.json({ message: "물주기 기록 DB 연결을 확인해주세요." }, { status: 503 });
    try {
      const options = await readWateringFertilizers(token, source || await resolveDataSourceId(token, wateringDatabaseId!));
      return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "비료 목록을 불러오지 못했어요." }, { status: 502 });
    }
  }
  const requestedDate = new URL(request.url).searchParams.get("date") || getSeoulDateValue();

  if (!token || (!wateringDatabaseId && !process.env.NOTION_WATERING_DATA_SOURCE_ID)) {
    return NextResponse.json({ plants: [], wateredAt: requestedDate }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return NextResponse.json({ message: "올바른 날짜를 선택하세요." }, { status: 400 });
  }

  try {
    const pages = await readWateringHistory({ property: "날짜", date: { equals: requestedDate } });
    const uniquePlants = new Map<string, WateredPlant>();

    for (const page of pages) {
      const id = page.properties["식물"]?.relation?.[0]?.id ?? "";
      const name = readTitle(page);
      if (!name) continue;
      const fertilizer = page.properties["비료"]?.select?.name;
      const fertilizerRatio = page.properties["비료 비율"]?.rich_text?.map((part) => part.plain_text ?? "").join("");
      const existing = uniquePlants.get(id || name);
      if (!existing || (!existing.fertilizer && fertilizer)) uniquePlants.set(id || name, { id, name, ...(fertilizer ? { fertilizer, fertilizerRatio } : {}) });
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

  if (!token || (!wateringDatabaseId && !configuredWateringDataSourceId)) {
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
      fertilizer?: string;
      fertilizerRatio?: string;
    };
    const plants = payload.plants?.filter((plant) => plant.id && plant.name) ?? [];
    const wateredAt = payload.wateredAt || new Date().toISOString();
    const note = payload.note?.trim() ?? "물 줌";
    if (payload.fertilizer !== undefined && (typeof payload.fertilizer !== "string" || !payload.fertilizer.trim() || payload.fertilizer.trim().length > 100 || /[,\r\n]/.test(payload.fertilizer))) {
      return NextResponse.json({ message: "비료 이름을 쉼표 없이 1~100자로 입력해주세요." }, { status: 400 });
    }
    const fertilizer = payload.fertilizer?.trim();
    if (payload.fertilizerRatio !== undefined && (typeof payload.fertilizerRatio !== "string" || payload.fertilizerRatio.trim().length > 100 || !fertilizer)) {
      return NextResponse.json({ message: "비료를 선택하고 비율을 100자 이내로 입력해주세요." }, { status: 400 });
    }
    const fertilizerRatio = payload.fertilizerRatio?.trim();

    if (!plants.length) {
      return NextResponse.json({ message: "물 준 식물을 선택하세요." }, { status: 400 });
    }

    const wateringParentId =
      configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId!));
    const observationDatabase = process.env.NOTION_DATABASE_ID;
    const observationSource = fertilizer ? process.env.NOTION_DATA_SOURCE_ID || (observationDatabase ? await resolveDataSourceId(token, observationDatabase) : undefined) : undefined;
    if (fertilizer && (!observationSource || observationSource === wateringParentId || plants.some((plant) => !hasNotionPageId(plant.id)))) {
      return NextResponse.json({ message: "비료를 기록하려면 식물과 관찰일지 DB 연결을 확인해주세요." }, { status: 400 });
    }
    const options = fertilizer ? await readWateringFertilizers(token, wateringParentId, true, Boolean(fertilizerRatio)) : [];
    const selectedFertilizer = options.find((option) => option.trim().toLowerCase() === fertilizer?.toLowerCase()) ?? fertilizer;
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
          fertilizer: selectedFertilizer,
          fertilizerRatio,
        });

        let observationWarning = false;
        if (selectedFertilizer && observationSource) {
          try {
            await createPlantLogPage({ token, parentId: observationSource, plantId: plant.id, plantName: plant.name, plantCategory: typeof plant.category === "string" ? plant.category : "", createdAt: wateredAt, tags: [selectedFertilizer], photos: [], note: fertilizerRatio ? `비료 비율: ${fertilizerRatio}` : "비료 사용" });
          } catch { observationWarning = true; }
        }

        results.push({
          plantId: plant.id,
          plantName: plant.name,
          ok: true,
          pageId: page.id,
          ...(observationWarning ? { observationWarning } : {}),
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
