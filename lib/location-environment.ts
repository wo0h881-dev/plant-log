export type LocationEnvironment = { temperature?: number; humidity?: number };
export type EnvironmentRecord = LocationEnvironment & {
  id: string; locationId: string; date: string; recordedAt: string; note?: string;
};
export type CommonCareRecord = { id: string; date: string; recordedAt: string; title: string; note: string; excludedPlantIds?: string[] };

const COMMON_MARKER = "\n[plant-log:common-care:v1]";
export function commonCareMemo(note: string, excludedPlantIds: string[]) {
  return excludedPlantIds.length ? `${note}${COMMON_MARKER}${JSON.stringify({ excludedPlantIds })}` : note;
}
export function readCommonCareMemo(note: string): { note: string; excludedPlantIds?: string[] } {
  const index = note.lastIndexOf(COMMON_MARKER);
  if (index < 0) return { note };
  try {
    const value: unknown = JSON.parse(note.slice(index + COMMON_MARKER.length));
    if (value && typeof value === "object" && "excludedPlantIds" in value && Array.isArray(value.excludedPlantIds) && value.excludedPlantIds.every((id) => typeof id === "string" && /^[0-9a-f]{32}$/i.test(id.replaceAll("-", "")))) return { note: note.slice(0, index), excludedPlantIds: [...new Set(value.excludedPlantIds.map((id: string) => id.replaceAll("-", "").toLowerCase()))] };
  } catch { /* Keep legacy memo text intact. */ }
  return { note };
}

export function isEnvironment(value: unknown): value is LocationEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as LocationEnvironment;
  return (item.temperature !== undefined || item.humidity !== undefined) &&
    (item.temperature === undefined || (typeof item.temperature === "number" && Number.isFinite(item.temperature) && item.temperature >= -50 && item.temperature <= 80)) &&
    (item.humidity === undefined || (typeof item.humidity === "number" && Number.isFinite(item.humidity) && item.humidity >= 0 && item.humidity <= 100));
}

export function environmentAt(records: EnvironmentRecord[], locationId: string, date: string): LocationEnvironment | undefined {
  const result: LocationEnvironment = {};
  for (const item of records.filter((record) => record.locationId === locationId && record.date <= date)
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.recordedAt.localeCompare(b.recordedAt))) {
    if (item.temperature !== undefined) result.temperature = item.temperature;
    if (item.humidity !== undefined) result.humidity = item.humidity;
  }
  return isEnvironment(result) ? result : undefined;
}

export function formatLocationEnvironment(environment?: LocationEnvironment) {
  return environment ? [environment.temperature !== undefined ? `${environment.temperature}℃` : "온도 미기록", environment.humidity !== undefined ? `${environment.humidity}%` : "습도 미기록"].join(" / ") : "온습도 미기록";
}

// Store versioned snapshots in the existing memo property without changing the DB schema.
const MARKER = "\n[plant-log:location-environment:v1]";
export function environmentMemo(note: string, environment: LocationEnvironment) {
  return `${note}${note ? "\n" : ""}온습도: ${formatLocationEnvironment(environment)}${MARKER}${JSON.stringify({ temperature: environment.temperature, humidity: environment.humidity, note })}`;
}
export function readEnvironmentMemo(note: string): { note: string; environment?: LocationEnvironment } {
  const index = note.lastIndexOf(MARKER);
  if (index < 0) return { note };
  try {
    const value: unknown = JSON.parse(note.slice(index + MARKER.length));
    if (isEnvironment(value)) return { note: "note" in value && typeof value.note === "string" ? value.note : note.slice(0, index), environment: { temperature: value.temperature, humidity: value.humidity } };
  } catch { /* Preserve unrecognized legacy memo content. */ }
  return { note };
}
