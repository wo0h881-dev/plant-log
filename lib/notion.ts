const NOTION_VERSION = "2026-03-11";
const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_PAGE_ID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

type NotionFileUpload = {
  id: string;
  upload_url?: string;
  status: "pending" | "uploaded" | "expired" | "failed";
};

type NotionDatabase = {
  id: string;
  data_sources?: Array<{ id: string }>;
};

type NotionOption = {
  name?: string;
};

type NotionDataSourceProperty = {
  type: string;
  select?: { options?: NotionOption[] };
  multi_select?: { options?: NotionOption[] };
};

type NotionDataSource = {
  id: string;
  properties?: Record<string, NotionDataSourceProperty>;
};

type UploadedPlantPhoto = {
  id: string;
  name: string;
};

type CreatePlantLogPageParams = {
  token: string;
  parentId: string;
  plantId?: string;
  plantName: string;
  plantCategory: string;
  note: string;
  createdAt: string;
  wateredAt?: string;
  tags: string[];
  photos: UploadedPlantPhoto[];
};

type CreateWateringLogPageParams = {
  token: string;
  parentId: string;
  plantId?: string;
  plantName: string;
  wateredAt: string;
  note: string;
};

type UpdatePlantSettingsPageParams = {
  token: string;
  plantId: string;
  changedAt: string;
  lightName?: string;
  lightWatt?: number;
  soils?: string[];
  potName?: string;
};

type CreateSettingChangePageParams = {
  token: string;
  parentId: string;
  plantId: string;
  plantName: string;
  changedAt: string;
  type: "빛" | "흙" | "화분";
  lightName?: string;
  lightWatt?: number;
  soils?: string[];
  potName?: string;
  note?: string;
};

function notionHeaders(token: string, contentType = "application/json") {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": contentType,
  };
}

export function hasNotionPageId(id?: string) {
  return id ? NOTION_PAGE_ID_PATTERN.test(id) : false;
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

export async function getDataSourceOptions(token: string, dataSourceId: string, propertyName: string) {
  const dataSource = await readNotionJson<NotionDataSource>(
    await fetch(`${NOTION_API_BASE}/data_sources/${dataSourceId}`, {
      method: "GET",
      headers: notionHeaders(token),
    }),
  );

  const property = dataSource.properties?.[propertyName];
  const options =
    property?.type === "multi_select"
      ? property.multi_select?.options
      : property?.type === "select"
        ? property.select?.options
        : [];

  return options?.map((option) => option.name?.trim() ?? "").filter(Boolean) ?? [];
}

export async function getDatabasePropertyOptions(token: string, databaseId: string, propertyName: string) {
  const dataSourceId = await resolveDataSourceId(token, databaseId);
  return getDataSourceOptions(token, dataSourceId, propertyName);
}

export async function createPlantLogPage({
  token,
  parentId,
  plantId,
  plantName,
  plantCategory,
  note,
  createdAt,
  wateredAt,
  tags,
  photos,
}: CreatePlantLogPageParams) {
  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: parentId },
        properties: {
          ...(hasNotionPageId(plantId)
            ? {
                식물: {
                  relation: [{ id: plantId }],
                },
              }
            : {}),
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
          관찰태그: {
            multi_select: tags.map((name) => ({ name })),
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

export async function createWateringLogPage({
  token,
  parentId,
  plantId,
  plantName,
  wateredAt,
  note,
}: CreateWateringLogPageParams) {
  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: parentId },
        properties: {
          이름: {
            title: [{ text: { content: `💧${plantName}` } }],
          },
          날짜: {
            date: { start: wateredAt },
          },
          ...(hasNotionPageId(plantId)
            ? {
                식물: {
                  relation: [{ id: plantId }],
                },
              }
            : {}),
          물줌: {
            checkbox: true,
          },
          메모: {
            rich_text: note ? [{ text: { content: note } }] : [],
          },
        },
      }),
    }),
  );
}

export async function updatePlantSettingsPage({
  token,
  plantId,
  changedAt,
  lightName,
  lightWatt,
  soils,
  potName,
}: UpdatePlantSettingsPageParams) {
  const properties: Record<string, unknown> = {
    "마지막 세팅 변경일": {
      date: { start: changedAt },
    },
  };

  if (lightName) {
    properties["현재 식물등"] = {
      rich_text: [{ text: { content: lightName } }],
    };
  }

  if (typeof lightWatt === "number") {
    properties["현재 와트"] = {
      number: lightWatt,
    };
  }

  if (soils?.length) {
    properties["현재 흙"] = {
      multi_select: soils.map((name) => ({ name })),
    };
  }

  if (potName) {
    properties["현재 화분"] = {
      select: { name: potName },
    };
  }

  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages/${plantId}`, {
      method: "PATCH",
      headers: notionHeaders(token),
      body: JSON.stringify({ properties }),
    }),
  );
}

export async function createSettingChangePage({
  token,
  parentId,
  plantId,
  plantName,
  changedAt,
  type,
  lightName,
  lightWatt,
  soils,
  potName,
  note,
}: CreateSettingChangePageParams) {
  return readNotionJson<{ id: string; url?: string }>(
    await fetch(`${NOTION_API_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: parentId },
        properties: {
          이름: {
            title: [{ text: { content: `${plantName} ${type} 변경` } }],
          },
          날짜: {
            date: { start: changedAt },
          },
          식물: {
            relation: [{ id: plantId }],
          },
          유형: {
            select: { name: type },
          },
          ...(lightName
            ? {
                식물등: {
                  rich_text: [{ text: { content: lightName } }],
                },
              }
            : {}),
          ...(typeof lightWatt === "number"
            ? {
                와트: {
                  number: lightWatt,
                },
              }
            : {}),
          ...(soils?.length
            ? {
                흙: {
                  multi_select: soils.map((name) => ({ name })),
                },
              }
            : {}),
          ...(potName
            ? {
                화분: {
                  select: { name: potName },
                },
              }
            : {}),
          메모: {
            rich_text: note ? [{ text: { content: note } }] : [],
          },
        },
      }),
    }),
  );
}
