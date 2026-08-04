const NOTION_VERSION = "2026-03-11";
const NOTION_API_BASE = "https://api.notion.com/v1";

type NotionFileUpload = {
  id: string;
  upload_url?: string;
  status: "pending" | "uploaded" | "expired" | "failed";
};

type NotionDatabase = {
  id: string;
  data_sources?: Array<{ id: string }>;
};

type UploadedPlantPhoto = {
  id: string;
  name: string;
};

type CreatePlantLogPageParams = {
  token: string;
  parentId: string;
  plantName: string;
  plantCategory: string;
  note: string;
  createdAt: string;
  wateredAt?: string;
  photos: UploadedPlantPhoto[];
};

function notionHeaders(token: string, contentType = "application/json") {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": contentType,
  };
}

export async function readNotionJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : "Notion API 요청에 실패했습니다.";
    throw new Error(message);
  }

  return payload as T;
}

export function createNotionHeaders(token: string, contentType = "application/json") {
  return notionHeaders(token, contentType);
}

export async function uploadFileToNotion(token: string, file: File) {
  const created = await readNotionJson<NotionFileUpload>(
    await fetch(`${NOTION_API_BASE}/file_uploads`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        mode: "single_part",
        filename: file.name,
        content_type: file.type || "image/jpeg",
      }),
    }),
  );

  const formData = new FormData();
  formData.append("file", file, file.name);

  const uploaded = await readNotionJson<NotionFileUpload>(
    await fetch(created.upload_url ?? `${NOTION_API_BASE}/file_uploads/${created.id}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
      body: formData,
    }),
  );

  if (uploaded.status !== "uploaded") {
    throw new Error("Notion 파일 업로드가 완료되지 않았습니다.");
  }

  return { id: uploaded.id, name: file.name };
}

export async function resolveDataSourceId(token: string, databaseId: string) {
  const database = await readNotionJson<NotionDatabase>(
    await fetch(`${NOTION_API_BASE}/databases/${databaseId}`, {
      method: "GET",
      headers: notionHeaders(token),
    }),
  );

  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) {
    throw new Error("Notion 데이터 소스를 찾을 수 없습니다.");
  }

  return dataSourceId;
}

export async function createPlantLogPage({
  token,
  parentId,
  plantName,
  plantCategory,
  note,
  createdAt,
  wateredAt,
  photos,
}: CreatePlantLogPageParams) {
  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: parentId },
        properties: {
          식물명: {
            title: [{ text: { content: plantName } }],
          },
          분류: {
            select: { name: plantCategory },
          },
          사진: {
            files: photos.map((photo) => ({
              type: "file_upload",
              file_upload: { id: photo.id },
              name: photo.name,
            })),
          },
          관찰일지: {
            rich_text: note ? [{ text: { content: note } }] : [],
          },
          관찰일: {
            date: { start: createdAt },
          },
          ...(wateredAt
            ? {
                물줌: {
                  checkbox: true,
                },
                물준날: {
                  date: { start: wateredAt },
                },
              }
            : {}),
        },
        children: photos.map((photo) => ({
          type: "image",
          image: {
            caption: [{ type: "text", text: { content: photo.name } }],
            type: "file_upload",
            file_upload: { id: photo.id },
          },
        })),
      }),
    }),
  );
}
