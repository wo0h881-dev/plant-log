import { NextResponse } from "next/server";
import { getDataSourceOptionGroups, resolveDataSourceId } from "@/lib/notion";

const FALLBACK_OBSERVATION_TAGS = ["신엽", "하엽", "과습", "뿌리", "상태이상", "해충", "꽃", "기타", "좋음", "안좋음", "분갈이", "온습도"];
const HIDDEN_OBSERVATION_TAGS = new Set(["분갈이 필요"]);
const FALLBACK_SOIL_OPTIONS = ["배흙", "수태", "세라미스", "펄라이트"];
const FALLBACK_POT_OPTIONS = ["슬릿분", "토분", "플분", "투명분", "행잉분", "기타"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const observationDatabaseId = process.env.NOTION_DATABASE_ID;
  const plantsDatabaseId = process.env.NOTION_PLANTS_DATABASE_ID;
  const configuredObservationDataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  const configuredPlantsDataSourceId = process.env.NOTION_PLANTS_DATA_SOURCE_ID;

  if (!token) {
    return NextResponse.json(
      {
        observationTags: FALLBACK_OBSERVATION_TAGS,
        soilOptions: FALLBACK_SOIL_OPTIONS,
        potOptions: FALLBACK_POT_OPTIONS,
        source: "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const observationDataSourceId =
      configuredObservationDataSourceId ||
      (observationDatabaseId ? await resolveDataSourceId(token, observationDatabaseId) : undefined);
    const plantsDataSourceId =
      configuredPlantsDataSourceId ||
      (plantsDatabaseId ? await resolveDataSourceId(token, plantsDatabaseId) : undefined);

    const [observationOptions, plantOptions] = await Promise.all([
      observationDataSourceId ? getDataSourceOptionGroups(token, observationDataSourceId) : {} as Record<string, string[]>,
      plantsDataSourceId ? getDataSourceOptionGroups(token, plantsDataSourceId) : {} as Record<string, string[]>,
    ]);
    const observationTags = observationOptions["관찰태그"] ?? [];
    const soilOptions = plantOptions["현재 흙"]?.length ? plantOptions["현재 흙"] : FALLBACK_SOIL_OPTIONS;
    const potOptions = plantOptions["현재 화분"]?.length ? plantOptions["현재 화분"] : FALLBACK_POT_OPTIONS;

    return NextResponse.json(
      {
        observationTags: [
          ...new Set([...observationTags.filter((tag) => !HIDDEN_OBSERVATION_TAGS.has(tag)), ...FALLBACK_OBSERVATION_TAGS]),
        ],
        soilOptions,
        potOptions,
        categoryOptions: plantOptions["대분류"] ?? [],
        purchaseSourceOptions: plantOptions["구매처"] ?? [],
        source: "notion",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        observationTags: FALLBACK_OBSERVATION_TAGS,
        soilOptions: FALLBACK_SOIL_OPTIONS,
        potOptions: FALLBACK_POT_OPTIONS,
        source: "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
