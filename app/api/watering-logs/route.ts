import { NextResponse } from "next/server";
import { createWateringLogPage, resolveDataSourceId } from "@/lib/notion";

type WateringPlant = {
  id: string;
  name: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredWateringDataSourceId = process.env.NOTION_WATERING_DATA_SOURCE_ID;

  if (!token || !wateringDatabaseId) {
    return NextResponse.json(
      { message: "NOTION_TOKEN과 NOTION_WATERING_DATABASE_ID를 설정하세요." },
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
    const note = payload.note?.trim() ?? "";

    if (!plants.length) {
      return NextResponse.json({ message: "물 준 식물을 선택하세요." }, { status: 400 });
    }

    const parentId =
      configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId));
    const pages = [];

    for (const plant of plants) {
      pages.push(
        await createWateringLogPage({
          token,
          parentId,
          plantId: plant.id,
          wateredAt,
          note,
        }),
      );
    }

    return NextResponse.json({
      count: pages.length,
      pageIds: pages.map((page) => page.id),
      wateredAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
