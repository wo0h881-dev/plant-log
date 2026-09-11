import type { Plant } from "@/types/plant";

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function compact(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function getKoreanInitials(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) return character;
    return INITIALS[Math.floor((code - HANGUL_START) / 588)];
  }).join("");
}

export function matchesPlantSearch(plant: Plant, query: string) {
  const normalizedQuery = compact(query);
  if (!normalizedQuery) return true;

  const searchable = compact(`${plant.category} ${plant.name}`);
  return searchable.includes(normalizedQuery) || compact(getKoreanInitials(searchable)).includes(normalizedQuery);
}
