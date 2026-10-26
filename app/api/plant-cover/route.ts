import { NextResponse } from "next/server";
import { createNotionHeaders, hasNotionPageId, readNotionJson, uploadFileToNotion } from "@/lib/notion";
import { parseNotionPlantPage } from "@/lib/plants";
import { NOTION_COVER_HOST } from "@/lib/plant-cover";
import { readEditablePlant, PlantRequestError, type EditablePlantPage } from "@/lib/notion-plant-page";
import { listPlantPhotos } from "@/lib/notion-plant-photos";

export const runtime = "nodejs";

async function downloadPhoto(urlValue: string) {
  const url = new URL(urlValue);
  if (url.protocol !== "https:" || url.hostname !== NOTION_COVER_HOST || url.port) throw new PlantRequestError("이 사진은 새 사진으로 직접 올려주세요.");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), cache: "no-store" });
  // Workers does not support redirect:error. Never follow image redirects outside the allowed host.
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new PlantRequestError("사진 주소가 변경되어 불러올 수 없어요. 사진 목록을 다시 열거나 새 사진을 올려주세요.");
  }
  const type = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!response.ok || !type.startsWith("image/") || !response.body) throw new PlantRequestError("원본 사진을 불러오지 못했습니다. 다시 시도하거나 새 사진을 올려주세요.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4_000_000) { await reader.cancel(); throw new PlantRequestError("4MB보다 큰 사진은 새 사진으로 선택해 압축 후 올려주세요."); }
    chunks.push(value);
  }
  return new File(chunks.map((chunk) => new Uint8Array(chunk)), `plant-cover.${type.split("/")[1] || "jpg"}`, { type });
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ message: "Notion 연결을 확인하세요." }, { status: 500 });
  try {
    const form = await request.formData();
    const plantId = String(form.get("plantId") ?? "").trim();
    const photoId = String(form.get("photoId") ?? "").trim();
    const photo = form.get("photo");
    const newPhoto = photo instanceof File && photo.size > 0 ? photo : undefined;
    if (!hasNotionPageId(plantId) || Boolean(newPhoto) === Boolean(photoId)) throw new PlantRequestError("식물과 커버로 사용할 사진 하나를 선택하세요.");
    if (newPhoto && (!newPhoto.type.startsWith("image/") || newPhoto.size > 4_000_000)) throw new PlantRequestError("사진은 압축 후 4MB 이하의 이미지로 선택하세요.");
    await readEditablePlant(token, plantId);
    let file = newPhoto;
    if (!file) {
      const selected = (await listPlantPhotos(token, plantId, true)).find((item) => item.id === photoId);
      if (!selected) throw new PlantRequestError("이 식물에 등록된 사진을 선택하세요.");
      file = await downloadPhoto(selected.url);
    }
    const uploaded = await uploadFileToNotion(token, file);
    const updated = await readNotionJson<EditablePlantPage>(await fetch(`https://api.notion.com/v1/pages/${plantId}`, {
      method: "PATCH", headers: createNotionHeaders(token), body: JSON.stringify({ cover: { type: "file_upload", file_upload: { id: uploaded.id } } }),
    }));
    let warning: string | undefined;
    if (newPhoto) {
      try {
        await readNotionJson(await fetch(`https://api.notion.com/v1/blocks/${plantId}/children`, {
          method: "PATCH", headers: createNotionHeaders(token),
          body: JSON.stringify({ children: [{ object: "block", type: "image", image: { type: "file_upload", file_upload: { id: uploaded.id } } }] }),
        }));
      } catch { warning = "커버는 변경했지만 본문 사진 추가에 실패했습니다. Notion에서 확인해주세요."; }
    }
    return NextResponse.json({ plant: parseNotionPlantPage(updated), warning }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const knownError = error instanceof PlantRequestError && error.status < 500;
    return NextResponse.json(
      { message: knownError ? error.message : "커버사진을 변경하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: knownError ? error.status : 502 },
    );
  }
}
