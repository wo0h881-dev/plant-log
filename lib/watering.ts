import type { Plant } from "@/types/plant";

export type WateredPlant = { id: string; name: string };
export type WateringStats = {
  lastWateredAt?: string;
  daysSinceWatered?: number;
  recentAverageDays?: number;
  averageDays?: number;
  wateringDays: number;
  recentIntervals: number;
  wateringDates?: string[];
};

export function seoulDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function normalizeDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? seoulDate(date) : undefined;
}

export function canShowInWateringList(plant: Plant) {
  if (plant.category.trim() === "사망") return false;
  return plant.category.trim() !== "자구" || !plant.currentSoils?.some((soil) => soil.includes("수태"));
}

export function isWateredToday(plant: Plant, watered: WateredPlant[], today = seoulDate()) {
  const id = plant.id.replaceAll("-", "").toLowerCase();
  return normalizeDay(plant.lastWateredAt ?? "") === today || watered.some((item) =>
    item.id ? item.id.replaceAll("-", "").toLowerCase() === id : item.name === plant.name,
  );
}

export function calculateWateringStats(values: string[], today = seoulDate()): WateringStats {
  const dates = [...new Set(values.map(normalizeDay).filter((day): day is string => Boolean(day && day <= today)))].sort();
  const gaps = dates.slice(1).map((day, index) => (Date.parse(day) - Date.parse(dates[index])) / 86_400_000);
  const recent = gaps.slice(-5);
  const mean = (numbers: number[]) => numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length * 10) / 10 : undefined;
  const last = dates.at(-1);
  return {
    lastWateredAt: last,
    daysSinceWatered: last ? Math.round((Date.parse(today) - Date.parse(last)) / 86_400_000) : undefined,
    recentAverageDays: mean(recent), averageDays: mean(gaps),
    wateringDays: dates.length, recentIntervals: recent.length,
  };
}
