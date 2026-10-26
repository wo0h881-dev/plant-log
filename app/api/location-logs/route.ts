import { NextResponse } from "next/server";
import { LOCATIONS, locationLabel, recordMovement } from "@/lib/plant-locations";
import { createLocationPage, locationConnection, locationStateFromPages, propertyText, readLocationPages } from "@/lib/notion-locations";
import { hasNotionPageId } from "@/lib/notion";
import { PlantRequestError, readEditablePlant } from "@/lib/notion-plant-page";
import { parseNotionPlantPage } from "@/lib/plants";
import { seoulDate } from "@/lib/watering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (error: unknown) => NextResponse.json({ message: error instanceof Error ? error.message : "위치 기록을 처리하지 못했어요." }, { status: error instanceof PlantRequestError ? error.status : 500 });

export async function GET() {
  try {
    const connection = await locationConnection();
    const state = locationStateFromPages(await readLocationPages(connection));
    return NextResponse.json({ state, source: "notion" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const ids: unknown = payload?.plantIds;
    const to = payload?.destination;
    const date = payload?.date;
    const note = payload?.note ?? "";
    const operation = payload?.operationId;
    const label = payload?.name;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 8 || ids.some((id) => typeof id !== "string" || !hasNotionPageId(id)) || typeof date !== "string" || typeof note !== "string" || note.length > 500 || typeof operation !== "string" || !hasNotionPageId(operation) || !LOCATIONS.some((item) => item.id === to) || (label !== undefined && (typeof label !== "string" || !label.trim() || label.length > 40))) {
      throw new PlantRequestError("식물과 위치·날짜를 확인해주세요. 한 번에 8개까지 저장할 수 있어요.");
    }
    try { recordMovement({ version: 1, positions: {}, history: [] }, [{ id: ids[0], name: "validation" }], to, date, note, operation); }
    catch (error) { throw new PlantRequestError(error instanceof Error ? error.message : "날짜를 확인해주세요."); }
    const connection = await locationConnection();
    const pages = await readLocationPages(connection);
    let state = locationStateFromPages(pages);
    const results: { plantId: string; success: boolean; message?: string; pageId?: string }[] = [];
    for (const plantId of [...new Set(ids as string[])]) {
      try {
        const key = `${operation}:${plantId}`;
        const existing = pages.find((page) => propertyText(page.properties.이동ID) === key);
        if (existing) { results.push({ plantId, success: true, pageId: existing.id }); continue; }
        const page = await readEditablePlant(connection.token, plantId);
        const plant = parseNotionPlantPage(page);
        if (!plant) throw new Error("식물명과 대분류를 확인해주세요.");
        const from = state.positions[plantId] ?? null;
        const next = recordMovement(state, [plant], to, date, note, operation);
        if (next.history.length === state.history.length) { results.push({ plantId, success: true, message: "이미 이 공간에 있어요." }); continue; }
        const labels = { ...state.labels, ...(label ? { [to]: label.trim() } : {}) };
        const saved = await createLocationPage(connection, { plantId, plantName: plant.name, from, to, date, note, label: locationLabel(to, labels), operationKey: key, labels });
        pages.push(saved); state = { ...next, labels };
        results.push({ plantId, success: true, pageId: saved.id });
      } catch (error) { results.push({ plantId, success: false, message: error instanceof Error ? error.message : "저장하지 못했어요." }); }
    }
    return NextResponse.json({ results, source: "notion" });
  } catch (error) { return fail(error); }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const locationId = payload?.locationId, name = payload?.name, operationId = payload?.operationId;
    if (!LOCATIONS.some((item) => item.id === locationId) || typeof name !== "string" || !name.trim() || name.trim().length > 40 || !hasNotionPageId(operationId)) throw new PlantRequestError("공간 이름을 1~40자로 입력해주세요.");
    const connection = await locationConnection();
    const key = `rename:${operationId}`;
    const pages = await readLocationPages(connection);
    if (!pages.some((page) => propertyText(page.properties.이동ID) === key)) {
      await createLocationPage(connection, { to: locationId, label: locationLabel(locationId, { [locationId]: name.trim() }), date: seoulDate(), note: "공간 이름 변경", operationKey: key });
    }
    return NextResponse.json({ success: true, source: "notion" });
  } catch (error) { return fail(error); }
}
