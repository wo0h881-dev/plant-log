import { NextResponse } from "next/server";
import { createNotionHeaders, hasNotionPageId, readNotionJson } from "@/lib/notion";
import type { PlantPhotoSummary } from "@/types/plant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("plantId") ?? "";
  if (!hasNotionPageId(id)) return NextResponse.json({ message: "식물 ID를 확인하세요." }, { status: 400 });
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ message: "Notion 연결을 확인하세요." }, { status: 500 });
  try {
    const photos: PlantPhotoSummary[] = [];
    let cursor: string | undefined;
    do {
      const params = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
      const payload = await readNotionJson<{
        results: Array<{ id: string; type: string; image?: { type: string; file?: { url: string }; external?: { url: string } } }>;
        has_more: boolean; next_cursor?: string | null;
      }>(await fetch(`https://api.notion.com/v1/blocks/${id}/children?${params}`, { headers: createNotionHeaders(token), cache: "no-store" }));
      for (const block of payload.results) {
        const url = block.image?.file?.url ?? block.image?.external?.url;
        if (block.type === "image" && url) photos.push({ id: block.id, name: "식물 본문 사진", url });
      }
      cursor = payload.has_more ? payload.next_cursor ?? undefined : undefined;
    } while (cursor);
    return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진을 불러오지 못했습니다." }, { status: 500 });
  }
}
