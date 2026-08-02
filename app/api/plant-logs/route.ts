import { NextResponse } from "next/server";
import { createPlantLogPage, resolveDataSourceId, uploadFileToNotion } from "@/lib/notion";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  const configuredDataSourceId = process.env.NOTION_DATA_SOURCE_ID;

  if (!token || !databaseId) {
    return NextResponse.json(
      { message: "NOTION_TOKEN과 NOTION_DATABASE_ID를 설정하세요." },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const photos = formData.getAll("photos").filter((photo): photo is File => photo instanceof File);
    const plantName = String(formData.get("plantName") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const createdAt = String(formData.get("createdAt") ?? new Date().toISOString());

    if (!plantName) {
      return NextResponse.json({ message: "식물명을 선택하세요." }, { status: 400 });
    }

    if (!photos.length) {
      return NextResponse.json({ message: "사진 파일을 선택하세요." }, { status: 400 });
    }

    if (photos.some((photo) => !photo.type.startsWith("image/"))) {
      return NextResponse.json({ message: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const parentId = configuredDataSourceId || (await resolveDataSourceId(token, databaseId));
    const uploadedPhotos = [];

    for (const photo of photos) {
      uploadedPhotos.push(await uploadFileToNotion(token, photo));
    }

    const page = await createPlantLogPage({
      token,
      parentId,
      plantName,
      note,
      createdAt,
      photos: uploadedPhotos,
    });

    return NextResponse.json({
      pageId: page.id,
      pageUrl: page.url,
      photoCount: uploadedPhotos.length,
      plantName,
      note,
      createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
