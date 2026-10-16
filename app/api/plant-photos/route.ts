import { NextResponse } from "next/server";
import { hasNotionPageId } from "@/lib/notion";
import { readEditablePlant, PlantRequestError } from "@/lib/notion-plant-page";
import { listPlantPhotos } from "@/lib/notion-plant-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("plantId") ?? "";
  if (!hasNotionPageId(id)) return NextResponse.json({ message: "식물 ID를 확인하세요." }, { status: 400 });
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ message: "Notion 연결을 확인하세요." }, { status: 500 });
  try {
    await readEditablePlant(token, id);
    const photos = await listPlantPhotos(token, id, new URL(request.url).searchParams.get("all") === "true");
    return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진을 불러오지 못했습니다." }, { status: error instanceof PlantRequestError ? error.status : 500 });
  }
}
