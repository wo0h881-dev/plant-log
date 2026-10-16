import { NextResponse } from "next/server";
import { readEnvironmentNote } from "@/lib/observation-environment";
import { appendObservation, findRecentObservation, readAppendableObservation } from "@/lib/notion-observation";
import { PlantRequestError } from "@/lib/notion-plant-page";
import { normalizeDay } from "@/lib/watering";
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

export async function GET(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const source = process.env.NOTION_DATA_SOURCE_ID;
  const database = process.env.NOTION_DATABASE_ID;
  const params = new URL(request.url).searchParams;
  const plantId = params.get("plantId") ?? "";
  const date = params.get("date") ?? "";
  if (!hasNotionPageId(plantId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || normalizeDay(date) !== date) return NextResponse.json({ message: "식물과 관찰 날짜를 확인하세요." }, { status: 400 });
  if (!token || (!source && !database)) return NextResponse.json({ message: "관찰일지 DB 연결을 확인하세요." }, { status: 500 });
  try {
    const recentObservation = await findRecentObservation(token, source || await resolveDataSourceId(token, database!), plantId, date);
    return NextResponse.json({ recentObservation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "최근 관찰일지 확인에 실패했습니다." }, { status: 500 }); }
}

export async function POST(request: Request) {
  let savedObservation: { id: string; url?: string } | null = null;
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
    const appendToPageId = String(formData.get("appendToPageId") ?? "").trim();
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
    const repotSoilsValue = String(formData.get("repotSoils") ?? "").trim();
    const repotPreviousSoilsValue = String(formData.get("repotPreviousSoils") ?? "").trim();
    const repotReason = String(formData.get("repotReason") ?? "").trim();
    const settingLightWatt = settingLightWattValue ? Number(settingLightWattValue) : undefined;
    let settingSoils: unknown = [];
    let repotSoils: unknown = [];
    let repotPreviousSoils: unknown = [];
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

    try {
      repotSoils = repotSoilsValue ? JSON.parse(repotSoilsValue) : [];
      repotPreviousSoils = repotPreviousSoilsValue ? JSON.parse(repotPreviousSoilsValue) : [];
    } catch {
      return NextResponse.json({ message: "분갈이 흙 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdAt) || normalizeDay(createdAt) !== createdAt) {
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

    if (
      !Array.isArray(repotSoils) ||
      repotSoils.some((soil) => typeof soil !== "string") ||
      !Array.isArray(repotPreviousSoils) ||
      repotPreviousSoils.some((soil) => typeof soil !== "string")
    ) {
      return NextResponse.json({ message: "분갈이 흙 선택값이 올바르지 않습니다." }, { status: 400 });
    }

    const selectedSoils = settingSoils.map((soil) => soil.trim()).filter(Boolean);
    const selectedObservationTags = observationTags.map((tag) => tag.trim()).filter(Boolean);
    const selectedRepotSoils = repotSoils.map((soil) => soil.trim()).filter(Boolean);
    const selectedPreviousSoils = repotPreviousSoils.map((soil) => soil.trim()).filter(Boolean);
    const hasRepottingContent = selectedObservationTags.includes("분갈이");
    if (hasRepottingContent && !selectedRepotSoils.length) {
      return NextResponse.json({ message: "분갈이 후 사용한 흙을 하나 이상 선택하세요." }, { status: 400 });
    }

    if (repotReason.length > 100) {
      return NextResponse.json({ message: "분갈이 이유는 100자 이내로 입력하세요." }, { status: 400 });
    }

    const previousSoilLabel = selectedPreviousSoils.length ? selectedPreviousSoils.join(" + ") : "기존 흙 미기록";
    const nextSoilLabel = selectedRepotSoils.join(" + ");
    const repotSummary = hasRepottingContent
      ? `분갈이: ${previousSoilLabel} → ${nextSoilLabel}${repotReason ? `\n이유: ${repotReason}` : ""}`
      : "";
    let environmentNote: string;
    try {
      environmentNote = readEnvironmentNote(formData, selectedObservationTags.includes("온습도"));
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : "온습도 값을 확인하세요." }, { status: 400 });
    }
    const observationNote = [note, repotSummary, environmentNote].filter(Boolean).join("\n\n");
    const hasObservationContent =
      photos.length > 0 || Boolean(observationNote) || Boolean(wateredAt) || selectedObservationTags.length > 0;
    const hasLightSettings = Boolean(settingLightName) || typeof settingLightWatt === "number";
    const hasSoilSettings = selectedSoils.length > 0;
    const hasPotSettings = Boolean(settingPotName);
    const hasSettingsContent = hasLightSettings || hasSoilSettings || hasPotSettings || hasRepottingContent;

    if (!hasObservationContent && !hasSettingsContent) {
      return NextResponse.json({ message: "사진, 메모, 물 줌 기록, 세팅 변경 중 하나는 입력하세요." }, { status: 400 });
    }

    if (hasObservationContent && !databaseId && !configuredDataSourceId) {
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
    if (photos.length > 20 || photos.reduce((size, photo) => size + photo.size, 0) > 4_000_000) return NextResponse.json({ message: "사진은 총 20장 이내, 압축 후 합계 4MB 이하로 선택하세요." }, { status: 400 });

    const parentId =
      hasObservationContent && (databaseId || configuredDataSourceId)
        ? configuredDataSourceId || (await resolveDataSourceId(token, databaseId!))
        : undefined;
    if (appendToPageId) {
      if (!parentId) throw new PlantRequestError("추가할 관찰일지 DB 연결을 확인하세요.");
      await readAppendableObservation(token, parentId, appendToPageId, plantId, createdAt);
    }
    const uploadedPhotos = [];

    for (const photo of photos) {
      uploadedPhotos.push(await uploadFileToNotion(token, photo));
    }

    const page = parentId && appendToPageId
      ? await appendObservation({ token, source: parentId, pageId: appendToPageId, plantId, date: createdAt, note: observationNote, tags: selectedObservationTags, photos: uploadedPhotos })
      : parentId
      ? await createPlantLogPage({
          token,
          parentId,
          plantId,
          plantName,
          plantCategory,
          note: observationNote,
          createdAt,
          wateredAt: wateredAt || undefined,
          tags: selectedObservationTags,
          photos: uploadedPhotos,
        })
      : null;
    savedObservation = page;

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
        soils: hasRepottingContent ? selectedRepotSoils : selectedSoils.length ? selectedSoils : undefined,
        potName: settingPotName || undefined,
        repottedAt: hasRepottingContent ? createdAt : undefined,
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

      if (hasRepottingContent) {
        settingPages.push(
          await createSettingChangePage({
            token,
            parentId: settingsParentId,
            plantId,
            plantName,
            changedAt: createdAt,
            type: "분갈이",
            soils: selectedRepotSoils,
            note: `${previousSoilLabel} → ${nextSoilLabel}${repotReason ? `\n이유: ${repotReason}` : ""}`,
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
      appended: Boolean(appendToPageId),
      warning: page && "warning" in page ? page.warning : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
    if (savedObservation) return NextResponse.json({ pageId: savedObservation.id, pageUrl: savedObservation.url, warning: `관찰일지는 저장했지만 부가 기록 처리에 실패했어요: ${message} 중복 저장하지 말고 Notion 기록을 확인해주세요.` });
    return NextResponse.json({ message }, { status: error instanceof PlantRequestError ? error.status : 500 });
  }
}
