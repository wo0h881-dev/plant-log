import { createNotionHeaders, readNotionJson, resolveDataSourceId } from "@/lib/notion";
import type { parseNotionPlantPage } from "@/lib/plants";

export type EditablePlantPage = Parameters<typeof parseNotionPlantPage>[0] & {
  parent?: { data_source_id?: string; database_id?: string };
  archived?: boolean; in_trash?: boolean;
};

export class PlantRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readEditablePlant(token: string, plantId: string) {
  const database = process.env.NOTION_PLANTS_DATABASE_ID;
  const configuredSource = process.env.NOTION_PLANTS_DATA_SOURCE_ID;
  if (!database && !configuredSource) throw new PlantRequestError("식물 분류 DB 연결을 확인하세요.", 500);
  const source = configuredSource || await resolveDataSourceId(token, database!);
  const page = await readNotionJson<EditablePlantPage>(await fetch(`https://api.notion.com/v1/pages/${plantId}`, { headers: createNotionHeaders(token), cache: "no-store" }));
  const sameId = (a?: string, b?: string) => Boolean(a && b && a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase());
  const allowed = page.parent?.data_source_id ? sameId(page.parent.data_source_id, source) : sameId(page.parent?.database_id, database);
  if (!allowed || page.archived || page.in_trash) throw new PlantRequestError("식물 분류 DB의 식물을 선택하세요.", 404);
  return page;
}
