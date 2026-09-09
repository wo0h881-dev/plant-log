import { NextResponse } from "next/server";
import {
  createSettingChangePage,
  hasNotionPageId,
  resolveDataSourceId,
  updatePlantSettingsPage,
} from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const plantsDatabaseId = process.env.NOTION_PLANTS_DATABASE_ID;
  const settingsDatabaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
  const configuredSettingsDataSourceId = process.env.NOTION_SETTINGS_DATA_SOURCE_ID;

  if (!token || !plantsDatabaseId || !settingsDatabaseId) {
    return NextResponse.json(
      { message: "Notion 식물 DB와 세팅 변경 DB 환경변수를 확인하세요." },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as {
      plantId?: string;
      plantName?: string;
      repottedAt?: string;
      soils?: string[];
      note?: string;
    };
    const plantId = payload.plantId?.trim() ?? "";
    const plantName = payload.plantName?.trim() ?? "";
    const repottedAt = payload.repottedAt?.trim() ?? "";
    const soils = payload.soils?.map((soil) => soil.trim()).filter(Boolean) ?? [];
    const note = payload.note?.trim() ?? "";

    if (!hasNotionPageId(plantId) || !plantName) {
      return NextResponse.json({ message: "Notion 식물 DB에서 식물을 선택하세요." }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(repottedAt) || Number.isNaN(Date.parse(`${repottedAt}T00:00:00Z`))) {
      return NextResponse.json({ message: "올바른 분갈이 날짜를 선택하세요." }, { status: 400 });
    }

    if (!soils.length) {
      return NextResponse.json({ message: "사용한 흙을 하나 이상 선택하세요." }, { status: 400 });
    }

    const settingsParentId =
      configuredSettingsDataSourceId || (await resolveDataSourceId(token, settingsDatabaseId));

    const plantPage = await updatePlantSettingsPage({
      token,
      plantId,
      changedAt: repottedAt,
      repottedAt,
      soils,
    });
    const historyPage = await createSettingChangePage({
      token,
      parentId: settingsParentId,
      plantId,
      plantName,
      changedAt: repottedAt,
      type: "분갈이",
      soils,
      note,
    });

    return NextResponse.json({
      plantPageId: plantPage.id,
      historyPageId: historyPage.id,
      repottedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "분갈이 기록 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
