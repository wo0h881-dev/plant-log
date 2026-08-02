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

  return {
    id: page.id,
    category,
    name,
  };
}
