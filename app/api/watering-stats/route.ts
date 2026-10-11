import { NextResponse } from "next/server";
import { hasNotionPageId } from "@/lib/notion";
import { readWateringHistory } from "@/lib/watering-history";
import { calculateWateringStats } from "@/lib/watering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const plantId = new URL(request.url).searchParams.get("plantId") ?? "";
  if (!hasNotionPageId(plantId)) return NextResponse.json({ message: "식물 ID를 확인하세요." }, { status: 400 });
  try {
    const pages = await readWateringHistory({ property: "식물", relation: { contains: plantId } });
    const dates = pages.flatMap((page) => page.properties["날짜"]?.date?.start ?? []);
    return NextResponse.json(calculateWateringStats(dates), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "물주기 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}
