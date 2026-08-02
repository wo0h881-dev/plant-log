const NOTION_VERSION = "2026-03-11";
const NOTION_API_BASE = "https://api.notion.com/v1";

type NotionFileUpload = {
  id: string;
  upload_url?: string;
  status: "pending" | "uploaded" | "expired" | "failed";
};

type CreatePlantLogPageParams = {
  token: string;
  databaseId: string;
  plantName: string;
  note: string;
  createdAt: string;
  fileUploadId: string;
  fileName: string;
};

function notionHeaders(token: string, contentType = "application/json") {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": contentType,
  };
}

async function readNotionJson<T>(response: Response): Promise<T> {
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

  return uploaded.id;
}

export async function createPlantLogPage({
  token,
  databaseId,
  plantName,
  note,
  createdAt,
  fileUploadId,
  fileName,
}: CreatePlantLogPageParams) {
  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Name: {
            title: [{ text: { content: plantName } }],
          },
          Files: {
            files: [
              {
                type: "file_upload",
                file_upload: { id: fileUploadId },
                name: fileName,
              },
            ],
          },
          Text: {
            rich_text: note ? [{ text: { content: note } }] : [],
          },
          Date: {
            date: { start: createdAt },
          },
        },
      }),
    }),
  );
}
