import { NextResponse } from "next/server";
import { getDataSourceOptions, resolveDataSourceId } from "@/lib/notion";

const FALLBACK_OBSERVATION_TAGS = ["신엽", "하엽", "상태이상", "잎끝 갈변", "응애", "분갈이 필요"];
const FALLBACK_SOIL_OPTIONS = ["배흙", "수태", "세라미스", "펄라이트"];
const FALLBACK_POT_OPTIONS = ["슬릿분", "토분", "플분", "투명분", "행잉분", "기타"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readOptions(token: string, dataSourceId: string | undefined, propertyName: string, fallback: string[]) {
  if (!dataSourceId) return fallback;

  const options = await getDataSourceOptions(token, dataSourceId, propertyName);
  return options.length ? options : fallback;
}

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

    const [observationTags, soilOptions, potOptions] = await Promise.all([
      readOptions(token, observationDataSourceId, "관찰태그", FALLBACK_OBSERVATION_TAGS),
      readOptions(token, plantsDataSourceId, "현재 흙", FALLBACK_SOIL_OPTIONS),
      readOptions(token, plantsDataSourceId, "현재 화분", FALLBACK_POT_OPTIONS),
    ]);

    return NextResponse.json(
      {
        observationTags,
        soilOptions,
        potOptions,
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
