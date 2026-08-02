import type { Plant } from "@/types/plant";

export const initialPlants: Plant[] = [
  { id: "alocasia-frydek-green-velvet", category: "알로카시아", name: "프라이덱 그린벨벳" },
  { id: "alocasia-variegated-frydek-green-velvet", category: "알로카시아", name: "무늬 프라이덱 그린벨벳" },
  { id: "alocasia-variegated-odora", category: "알로카시아", name: "무늬 오도라" },
  { id: "alocasia-amazonica", category: "알로카시아", name: "아마조니카" },
  { id: "alocasia-bambino-pink", category: "알로카시아", name: "밤비노 핑크" },
  { id: "alocasia-pseudo-sanderiana-pink", category: "알로카시아", name: "푸세이도 산데리아 핑크" },
  { id: "alocasia-nobilis-pink", category: "알로카시아", name: "노빌리스 핑크" },
  { id: "alocasia-ninja-splash-tricolor", category: "알로카시아", name: "닌자 스플래쉬 트리컬러" },
  { id: "alocasia-simpo-yellow", category: "알로카시아", name: "심포 옐로우" },
];

export async function getPlants(): Promise<Plant[]> {
  // Later this can read from a Notion database without changing the UI component.
  return initialPlants;
}
