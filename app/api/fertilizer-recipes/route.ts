import { NextResponse } from "next/server";
import { createNotionHeaders, readNotionJson } from "@/lib/notion";
import { locationConnection } from "@/lib/notion-locations";
import { emptyFertilizerRecipes, parseFertilizerRecipes, type FertilizerRecipes } from "@/lib/fertilizer-recipes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const API = "https://api.notion.com/v1";
const title = "Plant Log 비료 물통 설정";
type RecipePage = { id: string; last_edited_time: string; properties: Record<string, { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }> };

async function readRecipes() {
  const connection = await locationConnection();
  const result = await readNotionJson<{ results: RecipePage[] }>(await fetch(`${API}/data_sources/${connection.source}/query`, {
    method: "POST", headers: createNotionHeaders(connection.token), cache: "no-store", signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ page_size: 1, filter: { and: [{ property: "이름", title: { equals: title } }, { property: "유형", select: { equals: "비료 설정" } }] }, sorts: [{ timestamp: "last_edited_time", direction: "descending" }] }),
  }));
  const page = result.results[0];
  let state: FertilizerRecipes = emptyFertilizerRecipes();
  if (page) {
    const text = page.properties["메모"]?.rich_text?.map((part) => part.plain_text ?? part.text?.content ?? "").join("");
    const parsed = text ? parseFertilizerRecipes(JSON.parse(text)) : null;
    if (!parsed) throw new Error("Invalid saved recipes");
    state = parsed;
  }
  return { connection, page, state };
}

export async function GET() {
  try {
    const { page, state } = await readRecipes();
    return NextResponse.json({ state, revision: page?.last_edited_time ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "저장된 물통을 불러오지 못했어요. 입력 중인 내용은 유지됩니다. 잠시 후 다시 열어주세요." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const state = parseFertilizerRecipes(payload?.state);
    if (!state || !(payload.revision === null || typeof payload.revision === "string")) return NextResponse.json({ message: "물통의 비료와 비율을 확인해주세요." }, { status: 400 });
    const { connection, page } = await readRecipes();
    if ((page?.last_edited_time ?? null) !== payload.revision) return NextResponse.json({ message: "다른 기기에서 물통이 변경됐어요. 입력 내용은 임시 보관했으니 새로고침 후 다시 확인해주세요." }, { status: 409 });
    const content = JSON.stringify(state);
    const memo = { rich_text: Array.from({ length: Math.ceil(content.length / 1800) }, (_, index) => ({ text: { content: content.slice(index * 1800, (index + 1) * 1800) } })) };
    const saved = await readNotionJson<RecipePage>(await fetch(page ? `${API}/pages/${page.id}` : `${API}/pages`, {
      method: page ? "PATCH" : "POST", headers: createNotionHeaders(connection.token), signal: AbortSignal.timeout(12000),
      body: JSON.stringify(page ? { properties: { 메모: memo } } : { parent: { type: "data_source_id", data_source_id: connection.source }, properties: { 이름: { title: [{ text: { content: title } }] }, 유형: { select: { name: "비료 설정" } }, 메모: memo } }),
    }));
    return NextResponse.json({ state, revision: saved.last_edited_time });
  } catch {
    return NextResponse.json({ message: "물통을 저장하지 못했어요. 작성 내용은 임시 보관했으니 다시 시도해주세요." }, { status: 503 });
  }
}
