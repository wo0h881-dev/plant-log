import { NextRequest, NextResponse } from "next/server";
import {
  createNotionHeaders,
  hasNotionPageId,
  readNotionJson,
  resolveDataSourceId,
} from "@/lib/notion";
import type {
  PlantObservationSummary,
  PlantPhotoSummary,
  RecentObservedPlant,
} from "@/types/plant";

const NOTION_API_BASE = "https://api.notion.com/v1";

type RichText = { plain_text?: string };
type NotionFile = {
  name?: string;
  type: string;
  file?: { url?: string };
  external?: { url?: string };
};
type NotionProperty = {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  relation?: Array<{ id?: string }>;
  date?: { start?: string | null } | null;
  files?: NotionFile[];
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

function readPhotoUrl(file: NotionFile) {
  return file.type === "external" ? file.external?.url : file.file?.url;
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

function parsePhotos(pages: ObservationPage[]) {
  const photos: PlantPhotoSummary[] = [];
  for (const page of pages) {
    const observedAt = page.properties["관찰일"]?.date?.start ?? undefined;
    for (const [index, file] of (page.properties["사진"]?.files ?? []).entries()) {
      const url = readPhotoUrl(file);
      if (!url) continue;
      photos.push({ id: `${page.id}-${index}`, name: file.name ?? "식물 사진", url, date: observedAt });
      if (photos.length === 4) return photos;
    }
  }
  return photos;
}

function parseRecentPlants(pages: ObservationPage[]) {
  const recentPlants: RecentObservedPlant[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const plantName = readText(page.properties["식물명"]);
    const plantCategory = page.properties["분류"]?.select?.name?.trim() ?? "";
    const plantId = page.properties["식물"]?.relation?.[0]?.id;
    const key = plantId || `${plantCategory}:${plantName}`;
    if (!plantName || seen.has(key)) continue;

    const firstPhoto = page.properties["사진"]?.files?.find((file) => readPhotoUrl(file));
    recentPlants.push({
      plantId,
      plantName,
      plantCategory,
      observedAt: page.properties["관찰일"]?.date?.start ?? undefined,
      photoUrl: firstPhoto ? readPhotoUrl(firstPhoto) : undefined,
    });
    seen.add(key);
    if (recentPlants.length === 8) break;
  }

  return recentPlants;
}

async function queryObservationPages(token: string, dataSourceId: string, body: Record<string, unknown>) {
  return readNotionJson<ObservationQueryResponse>(
    await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers: createNotionHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function GET(request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const observationDatabaseId = process.env.NOTION_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const plantId = request.nextUrl.searchParams.get("plantId")?.trim() ?? "";
  const plantName = request.nextUrl.searchParams.get("plantName")?.trim() ?? "";

  if (!token || !observationDatabaseId) {
    return NextResponse.json(
      plantId ? { observations: [], photos: [] } : { recentPlants: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (plantId && !hasNotionPageId(plantId)) {
    return NextResponse.json({ message: "올바른 식물을 선택하세요." }, { status: 400 });
  }

  try {
    const dataSourceId = configuredDataSourceId || (await resolveDataSourceId(token, observationDatabaseId));

    if (!plantId) {
      const payload = await queryObservationPages(token, dataSourceId, {
        page_size: 30,
        sorts: [{ property: "관찰일", direction: "descending" }],
      });
      return NextResponse.json(
        { recentPlants: parseRecentPlants(payload.results) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const relationFilter = { property: "식물", relation: { contains: plantId } };
    const filter = plantName
      ? { or: [relationFilter, { property: "식물명", title: { equals: plantName } }] }
      : relationFilter;
    const payload = await queryObservationPages(token, dataSourceId, {
      page_size: 20,
      filter,
      sorts: [{ property: "관찰일", direction: "descending" }],
    });

    return NextResponse.json(
      {
        observations: payload.results.slice(0, 5).map(parseObservation),
        photos: parsePhotos(payload.results),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "최근 관찰 기록을 불러오지 못했습니다.";
    return NextResponse.json(
      plantId ? { observations: [], photos: [], message } : { recentPlants: [], message },
      { status: 500 },
    );
  }
}
