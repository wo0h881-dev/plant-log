import { NextResponse } from "next/server";
import { createWateringLogPage, resolveDataSourceId } from "@/lib/notion";

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

export const runtime = "nodejs";

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
