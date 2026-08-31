import { NextResponse } from "next/server";
import {
  createPlantLogPage,
  createSettingChangePage,
  createWateringLogPage,
  hasNotionPageId,
  resolveDataSourceId,
  updatePlantSettingsPage,
  uploadFileToNotion,
} from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  const plantsDatabaseId = process.env.NOTION_PLANTS_DATABASE_ID;
  const wateringDatabaseId = process.env.NOTION_WATERING_DATABASE_ID;
  const settingsDatabaseId = process.env.NOTION_SETTINGS_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const configuredWateringDataSourceId = process.env.NOTION_WATERING_DATA_SOURCE_ID;
  const configuredSettingsDataSourceId = process.env.NOTION_SETTINGS_DATA_SOURCE_ID;

  if (!token) {
    return NextResponse.json({ message: "NOTION_TOKEN을 설정하세요." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const photos = formData.getAll("photos").filter((photo): photo is File => photo instanceof File);
    const plantId = String(formData.get("plantId") ?? "").trim();
    const plantName = String(formData.get("plantName") ?? "").trim();
    const plantCategory = String(formData.get("plantCategory") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const createdAt = String(formData.get("createdAt") ?? new Date().toISOString());
    const wateredAt = String(formData.get("wateredAt") ?? "").trim();
    const observationTagsValue = String(formData.get("observationTags") ?? "").trim();
    const settingLightName = String(formData.get("settingLightName") ?? "").trim();
    const settingLightWattValue = String(formData.get("settingLightWatt") ?? "").trim();
    const settingSoilsValue = String(formData.get("settingSoils") ?? "").trim();
    const settingPotName = String(formData.get("settingPotName") ?? "").trim();
    const settingLightWatt = settingLightWattValue ? Number(settingLightWattValue) : undefined;
    let settingSoils: unknown = [];
    let observationTags: unknown = [];

    try {
      settingSoils = settingSoilsValue ? JSON.parse(settingSoilsValue) : [];
    } catch {
      return NextResponse.json({ message: "흙 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    try {
      observationTags = observationTagsValue ? JSON.parse(observationTagsValue) : [];
    } catch {
      return NextResponse.json({ message: "관찰태그 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdAt) || Number.isNaN(Date.parse(`${createdAt}T00:00:00Z`))) {
      return NextResponse.json({ message: "올바른 관찰 날짜를 선택하세요." }, { status: 400 });
    }

    if (wateredAt && wateredAt !== createdAt) {
      return NextResponse.json({ message: "물 준 날짜가 관찰 날짜와 일치하지 않습니다." }, { status: 400 });
    }

    if (!plantName) {
      return NextResponse.json({ message: "식물명을 선택하세요." }, { status: 400 });
    }

    if (!plantCategory) {
      return NextResponse.json({ message: "분류를 선택하세요." }, { status: 400 });
    }

    if (settingLightWattValue && (typeof settingLightWatt !== "number" || Number.isNaN(settingLightWatt))) {
      return NextResponse.json({ message: "와트는 숫자로 입력하세요." }, { status: 400 });
    }

    if (!Array.isArray(settingSoils) || settingSoils.some((soil) => typeof soil !== "string")) {
      return NextResponse.json({ message: "흙 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    if (!Array.isArray(observationTags) || observationTags.some((tag) => typeof tag !== "string")) {
      return NextResponse.json({ message: "관찰태그 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    const selectedSoils = settingSoils.map((soil) => soil.trim()).filter(Boolean);
    const selectedObservationTags = observationTags.map((tag) => tag.trim()).filter(Boolean);
    const hasObservationContent =
      photos.length > 0 || Boolean(note) || Boolean(wateredAt) || selectedObservationTags.length > 0;
    const hasLightSettings = Boolean(settingLightName) || typeof settingLightWatt === "number";
    const hasSoilSettings = selectedSoils.length > 0;
    const hasPotSettings = Boolean(settingPotName);
    const hasSettingsContent = hasLightSettings || hasSoilSettings || hasPotSettings;

    if (!hasObservationContent && !hasSettingsContent) {
      return NextResponse.json({ message: "사진, 메모, 물 줌 기록, 세팅 변경 중 하나는 입력하세요." }, { status: 400 });
    }

    if (hasObservationContent && !databaseId) {
      return NextResponse.json({ message: "NOTION_DATABASE_ID를 설정하세요." }, { status: 500 });
    }

    if (hasSettingsContent && (!plantsDatabaseId || !settingsDatabaseId)) {
      return NextResponse.json(
        { message: "NOTION_PLANTS_DATABASE_ID와 NOTION_SETTINGS_DATABASE_ID를 설정하세요." },
        { status: 500 },
      );
    }

    if (hasSettingsContent && !hasNotionPageId(plantId)) {
      return NextResponse.json({ message: "Notion 식물 DB에서 불러온 식물을 선택하세요." }, { status: 400 });
    }

    if (photos.some((photo) => !photo.type.startsWith("image/"))) {
      return NextResponse.json({ message: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const parentId =
      hasObservationContent && databaseId
        ? configuredDataSourceId || (await resolveDataSourceId(token, databaseId))
        : undefined;
    const uploadedPhotos = [];

    for (const photo of photos) {
      uploadedPhotos.push(await uploadFileToNotion(token, photo));
    }

    const page = parentId
      ? await createPlantLogPage({
          token,
          parentId,
          plantId,
          plantName,
          plantCategory,
          note,
          createdAt,
          wateredAt: wateredAt || undefined,
          tags: selectedObservationTags,
          photos: uploadedPhotos,
        })
      : null;

    let wateringPage = null;
    if (wateredAt && wateringDatabaseId) {
      const wateringParentId =
        configuredWateringDataSourceId || (await resolveDataSourceId(token, wateringDatabaseId));

      wateringPage = await createWateringLogPage({
        token,
        parentId: wateringParentId,
        plantId,
        plantName,
        wateredAt,
        note,
      });
    }

    let plantSettingsPage = null;
    const settingPages = [];

    if (hasSettingsContent && settingsDatabaseId) {
      const settingsParentId =
        configuredSettingsDataSourceId || (await resolveDataSourceId(token, settingsDatabaseId));

      plantSettingsPage = await updatePlantSettingsPage({
        token,
        plantId,
        changedAt: createdAt,
        lightName: settingLightName || undefined,
        lightWatt: settingLightWatt,
        soils: selectedSoils.length ? selectedSoils : undefined,
        potName: settingPotName || undefined,
      });

      if (hasLightSettings) {
        settingPages.push(
          await createSettingChangePage({
            token,
            parentId: settingsParentId,
            plantId,
            plantName,
            changedAt: createdAt,
            type: "빛",
            lightName: settingLightName || undefined,
            lightWatt: settingLightWatt,
          }),
        );
      }

      if (hasSoilSettings) {
        settingPages.push(
          await createSettingChangePage({
            token,
            parentId: settingsParentId,
            plantId,
            plantName,
            changedAt: createdAt,
            type: "흙",
            soils: selectedSoils,
          }),
        );
      }

      if (hasPotSettings) {
        settingPages.push(
          await createSettingChangePage({
            token,
            parentId: settingsParentId,
            plantId,
            plantName,
            changedAt: createdAt,
            type: "화분",
            potName: settingPotName,
          }),
        );
      }
    }

    return NextResponse.json({
      pageId: page?.id,
      pageUrl: page?.url,
      wateringPageId: wateringPage?.id,
      wateringPageUrl: wateringPage?.url,
      plantSettingsPageId: plantSettingsPage?.id,
      settingPageIds: settingPages.map((settingPage) => settingPage.id),
      photoCount: uploadedPhotos.length,
      plantId,
      plantName,
      plantCategory,
      wateredAt,
      note,
      createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
