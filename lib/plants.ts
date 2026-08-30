import type { Plant } from "@/types/plant";

export const fallbackPlants: Plant[] = [
  { id: "alocasia-variegated-frydek-green-velvet", category: "알로카시아", name: "무늬 프라이덱 그린벨벳" },
  { id: "alocasia-frydek-green-velvet", category: "알로카시아", name: "프라이덱 그린벨벳" },
  { id: "alocasia-variegated-odora", category: "알로카시아", name: "무늬 오도라" },
  { id: "alocasia-amazonica", category: "알로카시아", name: "아마조니카" },
  { id: "alocasia-bambino-pink", category: "알로카시아", name: "밤비노 핑크" },
  { id: "alocasia-pseudo-sanderiana-pink", category: "알로카시아", name: "푸세이도 산데리아 핑크" },
  { id: "alocasia-nobilis-pink", category: "알로카시아", name: "노빌리스 핑크" },
  { id: "alocasia-ninja-splash-tricolor", category: "알로카시아", name: "닌자 스플래쉬 트리컬러" },
  { id: "alocasia-simpo-yellow", category: "알로카시아", name: "심포 옐로우" },
];

type RichText = {
  plain_text?: string;
};

type NotionProperty = {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name?: string } | null;
  number?: number | null;
  date?: { start?: string | null } | null;
  formula?: {
    type?: string;
    string?: string | null;
    number?: number | null;
    boolean?: boolean | null;
    date?: { start?: string | null } | null;
  };
  rollup?: {
    type?: string;
    array?: NotionProperty[];
    date?: { start?: string | null } | null;
    number?: number | null;
  };
};

type NotionPlantPage = {
  id: string;
  properties: Record<string, NotionProperty>;
};

function readTextProperty(property: NotionProperty | undefined) {
  if (!property) return "";

  if (property.type === "title") {
    return property.title?.map((text) => text.plain_text ?? "").join("").trim() ?? "";
  }

  if (property.type === "rich_text") {
    return property.rich_text?.map((text) => text.plain_text ?? "").join("").trim() ?? "";
  }

  if (property.type === "select") {
    return property.select?.name?.trim() ?? "";
  }

  return "";
}

function readNumberProperty(property: NotionProperty | undefined): number | undefined {
  if (!property) return undefined;

  if (property.type === "number") {
    return typeof property.number === "number" ? property.number : undefined;
  }

  if (property.type === "formula" && property.formula?.type === "number") {
    return typeof property.formula.number === "number" ? property.formula.number : undefined;
  }

  if (property.type === "rollup" && property.rollup?.type === "number") {
    return typeof property.rollup.number === "number" ? property.rollup.number : undefined;
  }

  return undefined;
}

function readDateProperty(property: NotionProperty | undefined): string | undefined {
  if (!property) return undefined;

  if (property.type === "date") {
    return property.date?.start ?? undefined;
  }

  if (property.type === "formula" && property.formula?.type === "date") {
    return property.formula.date?.start ?? undefined;
  }

  if (property.type === "rollup") {
    if (property.rollup?.type === "date") {
      return property.rollup.date?.start ?? undefined;
    }

    const dates =
      property.rollup?.array
        ?.map((item) => readDateProperty(item))
        .filter((date): date is string => Boolean(date)) ?? [];

    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }

  return undefined;
}

function readFormulaTextProperty(property: NotionProperty | undefined) {
  if (property?.type !== "formula") return "";
  if (property.formula?.type === "string") return property.formula.string?.trim() ?? "";
  if (property.formula?.type === "boolean") return property.formula.boolean ? "true" : "";
  if (property.formula?.type === "number") return String(property.formula.number ?? "");
  return "";
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return Date.UTC(year, month - 1, day);
}

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : undefined;
}

function calculateDaysSince(dateValue: string | undefined) {
  const lastWateredTime = dateValue ? dateKeyToUtcTime(dateValue.slice(0, 10)) : undefined;
  const todayTime = dateKeyToUtcTime(getSeoulDateKey() ?? "");

  if (
    typeof lastWateredTime !== "number" ||
    typeof todayTime !== "number" ||
    !Number.isFinite(lastWateredTime) ||
    !Number.isFinite(todayTime)
  ) {
    return undefined;
  }

  return Math.max(0, Math.floor((todayTime - lastWateredTime) / 86_400_000));
}

export function parseNotionPlantPage(page: NotionPlantPage): Plant | null {
  const category =
    readTextProperty(page.properties["대분류"]) ||
    readTextProperty(page.properties["분류"]) ||
    readTextProperty(page.properties["카테고리"]);
  const name =
    readTextProperty(page.properties["상세 식물"]) ||
    readTextProperty(page.properties["상세식물"]) ||
    readTextProperty(page.properties["식물명"]) ||
    readTextProperty(page.properties.Name);

  if (!category || !name) return null;

  const wateringCycleDays = readNumberProperty(page.properties["관수 주기"]);
  const lastWateredAt =
    readDateProperty(page.properties["마지막 물준 날"]) ||
    readDateProperty(page.properties["최근 물준날"]);
  const wateringAlert = readFormulaTextProperty(page.properties["알림"]);
  const daysSinceWatered = calculateDaysSince(lastWateredAt);
  const isWateringDue =
    typeof wateringCycleDays === "number" &&
    (typeof daysSinceWatered === "number" ? daysSinceWatered >= wateringCycleDays : true);

  return {
    id: page.id,
    category,
    name,
    wateringCycleDays,
    lastWateredAt,
    daysSinceWatered,
    isWateringDue,
    wateringAlert,
  };
}
