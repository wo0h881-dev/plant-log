import { NextResponse } from "next/server";
import { createNotionHeaders, createPlantPage, readNotionJson, resolveDataSourceId, uploadFileToNotion } from "@/lib/notion";
import { fallbackPlants, parseNotionPlantPage } from "@/lib/plants";
import { normalizeDay, seoulDate } from "@/lib/watering";

const NOTION_API_BASE = "https://api.notion.com/v1";

type NotionQueryResponse = {
  results: Array<Parameters<typeof parseNotionPlantPage>[0]>;
  has_more: boolean;
  next_cursor: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const plantsDatabaseId = process.env.NOTION_PLANTS_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_PLANTS_DATA_SOURCE_ID;

  if (!token || (!plantsDatabaseId && !configuredDataSourceId)) {
    return NextResponse.json(
      { plants: fallbackPlants, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const dataSourceId = configuredDataSourceId || (await resolveDataSourceId(token, plantsDatabaseId!));
    const pages: NotionQueryResponse["results"] = [];
    let startCursor: string | null = null;

    do {
      const payload: NotionQueryResponse = await readNotionJson<NotionQueryResponse>(
        await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}/query`, {
          method: "POST",
          headers: createNotionHeaders(token),
          body: JSON.stringify({
            page_size: 100,
            ...(startCursor ? { start_cursor: startCursor } : {}),
          }),
        }),
      );

      pages.push(...payload.results);
      startCursor = payload.has_more ? payload.next_cursor : null;
    } while (startCursor);

    const plants = pages
      .map((page) => parseNotionPlantPage(page))
      .filter((plant) => plant !== null)
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "ko"));

    return NextResponse.json(
      {
        plants: plants.length ? plants : fallbackPlants,
        source: plants.length ? "notion" : "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { plants: fallbackPlants, source: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const database = process.env.NOTION_PLANTS_DATABASE_ID;
  const source = process.env.NOTION_PLANTS_DATA_SOURCE_ID;
  if (!token || (!database && !source)) return NextResponse.json({ message: "식물 분류 DB 연결을 확인하세요." }, { status: 500 });
  try {
    const form = await request.formData();
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const name = text("name");
    const category = text("category");
    const purchaseSource = text("purchaseSource");
    const adoptedAt = text("adoptedAt");
    const price = text("price");
    const cycle = text("wateringCycleDays");
    const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (![name, category, purchaseSource, adoptedAt, price, cycle].some(Boolean) && !photos.length) {
      return NextResponse.json({ message: "정보나 사진을 하나 이상 입력하세요." }, { status: 400 });
    }
    if ([name, category, purchaseSource].some((value) => value.length > 100)) return NextResponse.json({ message: "이름과 선택 항목은 100자 이내로 입력하세요." }, { status: 400 });
    if (adoptedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(adoptedAt) || normalizeDay(adoptedAt) !== adoptedAt)) return NextResponse.json({ message: "입양날짜를 확인하세요." }, { status: 400 });
    if ((price && (!Number.isFinite(Number(price)) || Number(price) < 0)) || (cycle && (!Number.isFinite(Number(cycle)) || Number(cycle) < 1))) {
      return NextResponse.json({ message: "가격은 0 이상, 관수 주기는 1 이상의 숫자로 입력하세요." }, { status: 400 });
    }
    if (photos.some((photo) => !photo.type.startsWith("image/")) || photos.length > 20 || photos.reduce((size, photo) => size + photo.size, 0) > 4_000_000) {
      return NextResponse.json({ message: "사진은 이미지 20장 이내, 압축 후 합계 4MB 이하로 선택하세요." }, { status: 400 });
    }
    const parentId = source || await resolveDataSourceId(token, database!);
    const uploaded = [];
    for (const photo of photos) uploaded.push(await uploadFileToNotion(token, photo));
    const page = await createPlantPage({
      token, parentId, name: name || `이름 없는 식물 ${seoulDate()} ${crypto.randomUUID().slice(0, 4)}`,
      category: category || "기타", purchaseSource: purchaseSource || undefined,
      adoptedAt: adoptedAt || undefined, price: price ? Number(price) : undefined,
      wateringCycleDays: cycle ? Number(cycle) : undefined, photos: uploaded,
    });
    return NextResponse.json({ plant: parseNotionPlantPage(page) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "식물 등록에 실패했습니다." }, { status: 500 });
  }
}
