import { NextResponse } from "next/server";
import { LOCATIONS, locationLabel, recordMovement } from "@/lib/plant-locations";
import { createLocationPage, locationConnection, locationStateFromPages, propertyText, readLocationPages, readLocationState } from "@/lib/notion-locations";
import { hasNotionPageId } from "@/lib/notion";
import { PlantRequestError, readEditablePlant } from "@/lib/notion-plant-page";
import { parseNotionPlantPage } from "@/lib/plants";
import { seoulDate } from "@/lib/watering";
import { isEnvironment } from "@/lib/location-environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = (error: unknown) => {
  const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  return NextResponse.json({ message: timeout ? "노션 응답이 늦어지고 있어요. 기록은 유지되니 잠시 후 다시 확인해주세요." : error instanceof Error ? error.message : "위치 기록을 처리하지 못했어요." }, { status: timeout ? 503 : error instanceof PlantRequestError ? error.status : 500 });
};

export async function GET() {
  try {
    const connection = await locationConnection();
    const state = await readLocationState(connection);
    return NextResponse.json({ state, source: "notion" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    if (payload?.kind === "environment" || payload?.kind === "common") {
      const { kind, date, operationId, locationId, environment, title, note = "", excludedPlantIds = [] } = payload;
      if (!hasNotionPageId(operationId) || typeof note !== "string" || note.length > 500 || typeof date !== "string") throw new PlantRequestError("날짜와 기록 내용을 확인해주세요.");
      try { recordMovement({ version: 1, positions: {}, history: [] }, [{ id: "validation", name: "validation" }], LOCATIONS[0].id, date, "", operationId); }
      catch { throw new PlantRequestError("오늘 또는 과거의 올바른 날짜를 선택해주세요."); }
      if (kind === "environment" && (!LOCATIONS.some((item) => item.id === locationId) || !isEnvironment(environment))) throw new PlantRequestError("온도(-50~80℃) 또는 습도(0~100%)를 입력해주세요.");
      if (kind === "common" && (typeof title !== "string" || !title.trim() || title.trim().length > 100)) throw new PlantRequestError("공통 기록 제목을 1~100자로 입력해주세요.");
      if (kind === "common" && (!Array.isArray(excludedPlantIds) || excludedPlantIds.length > 500 || excludedPlantIds.some((id) => typeof id !== "string" || !hasNotionPageId(id)))) throw new PlantRequestError("공지에서 제외할 식물을 확인해주세요.");
      const connection = await locationConnection();
      const pages = await readLocationPages(connection);
      const key = `${kind}:${operationId}`;
      if (!pages.some((page) => propertyText(page.properties.이동ID) === key)) {
        const state = locationStateFromPages(pages);
        const saved = await createLocationPage(connection, { kind, to: kind === "environment" ? locationId : "", label: kind === "environment" ? locationLabel(locationId, state.labels) : "전체 공통", date, note, operationKey: key, ...(kind === "environment" ? { environment } : { title: title.trim(), excludedPlantIds: [...new Set((excludedPlantIds as string[]).map((id) => id.replaceAll("-", "").toLowerCase()))] }) });
        pages.push(saved);
      }
      return NextResponse.json({ success: true, source: "notion", state: locationStateFromPages(pages) });
    }
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
        const saved = await createLocationPage(connection, { plantId, plantName: plant.name, from, to, date, note, label: locationLabel(to, labels), operationKey: key, labels, environment: next.history[0]?.environment });
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
