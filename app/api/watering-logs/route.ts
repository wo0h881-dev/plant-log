import { NextResponse } from "next/server";
import { createPlantLogPage, createWateringLogPage, resolveDataSourceId } from "@/lib/notion";

type WateringPlant = {
  id: string;
  name: string;
  category: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const observationDatabaseId = process.env.NOTION_DATABASE_ID;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const configuredObservationDataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const configuredWateringDataSourceId = process.env.NOTION_WATERING_DATA_SOURCE_ID;

  if (!token || !observationDatabaseId || !wateringDatabaseId) {
    return NextResponse.json(
      {
        message:
          "NOTION_TOKEN, NOTION_DATABASE_ID, NOTION_WATERING_DATABASE_ID를 설정하세요.",
      },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as {
      plants?: WateringPlant[];
      wateredAt?: string;
      note?: string;
    };
    const plants =
      payload.plants?.filter((plant) => plant.id && plant.name && plant.category) ?? [];
    const wateredAt = payload.wateredAt || new Date().toISOString();
    const note = payload.note?.trim() ?? "물 줌";

    if (!plants.length) {
      return NextResponse.json({ message: "물 준 식물을 선택하세요." }, { status: 400 });
    }

    const wateringParentId =
      configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId));
    const observationParentId =
      configuredObservationDataSourceId ||
      (await resolveDataSourceId(token, observationDatabaseId));

    const wateringPages = [];
    const observationPages = [];

    for (const plant of plants) {
      wateringPages.push(
        await createWateringLogPage({
          token,
          parentId: wateringParentId,
          plantId: plant.id,
          plantName: plant.name,
          wateredAt,
          note,
        }),
      );

      observationPages.push(
        await createPlantLogPage({
          token,
          parentId: observationParentId,
          plantId: plant.id,
          plantName: plant.name,
          plantCategory: plant.category,
          note,
          createdAt: wateredAt,
          wateredAt,
          photos: [],
        }),
      );
    }

    return NextResponse.json({
      count: plants.length,
      wateringPageIds: wateringPages.map((page) => page.id),
      observationPageIds: observationPages.map((page) => page.id),
      wateredAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
