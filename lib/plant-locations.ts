export const LOCATION_STORAGE_KEY = "plant-log:location-trial:v1";

export const LOCATION_GROUPS = [
  { id: "left-three", name: "3단장", description: "왼쪽 · 실습", levels: ["실습 1단", "실습 2단", "실습 3단"] },
  { id: "left-five", name: "5단장", description: "왼쪽 · 미니온실", levels: ["미니온실 1번", "미니온실 2번", "미니온실 3번", "4단", "5단"] },
  { id: "lerberg", name: "레르베리", description: "가운데 · 흰색장", levels: ["실습 1단", "실습 2단", "실습 3단", "실습 4단"] },
  { id: "right-black", name: "검은색장", description: "오른쪽", levels: ["온실", "실습"] },
] as const;

export const LOCATIONS = LOCATION_GROUPS.flatMap((group) => group.levels.map((name, index) => ({
  id: `${group.id}:${index + 1}`, groupId: group.id, groupName: group.name, name,
  label: `${group.name} · ${name}`, level: index + 1,
})));

export type MovementRecord = {
  id: string; plantId: string; plantName: string; from: string | null; to: string;
  date: string; reason: string; recordedAt: string;
};
export type LocationState = {
  version: 1; positions: Record<string, string>; history: MovementRecord[]; labels?: Record<string, string>;
};
export const emptyLocationState = (): LocationState => ({ version: 1, positions: {}, history: [] });
const knownLocation = (id: unknown): id is string => typeof id === "string" && LOCATIONS.some((location) => location.id === id);

export function parseLocationState(raw: string | null): LocationState {
  if (!raw) return emptyLocationState();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("positions" in value) || !("history" in value)) throw new Error("위치 기록 형식을 확인해주세요.");
  const { positions, history } = value;
  if (!positions || typeof positions !== "object" || Array.isArray(positions) || !Array.isArray(history)) throw new Error("위치 기록을 읽을 수 없어요.");
  const validPositions = Object.entries(positions).filter(([, location]) => knownLocation(location));
  const validHistory = history.filter((record): record is MovementRecord => Boolean(record && typeof record === "object" &&
    typeof record.id === "string" && typeof record.plantId === "string" && typeof record.plantName === "string" &&
    (record.from === null || knownLocation(record.from)) && knownLocation(record.to) &&
    typeof record.date === "string" && typeof record.reason === "string" && typeof record.recordedAt === "string"));
  const labels = "labels" in value && value.labels && typeof value.labels === "object" && !Array.isArray(value.labels)
    ? Object.fromEntries(Object.entries(value.labels).filter(([id, name]) => knownLocation(id) && typeof name === "string" && name.trim().length > 0 && name.trim().length <= 40).map(([id, name]) => [id, (name as string).trim()]))
    : undefined;
  return { version: 1, positions: Object.fromEntries(validPositions), history: validHistory, ...(labels ? { labels } : {}) };
}

export function recordMovement(state: LocationState, plants: { id: string; name: string }[], destination: string, date: string, reason: string, operationId: string, now = new Date()): LocationState {
  if (!knownLocation(destination)) throw new Error("옮길 공간을 선택해주세요.");
  const dateValue = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date) throw new Error("이동 날짜를 확인해주세요.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  if (date > today) throw new Error("미래 날짜에는 이동을 기록할 수 없어요.");
  const unique = [...new Map(plants.map((plant) => [plant.id, plant])).values()];
  if (!unique.length || unique.some((plant) => !plant.id || !plant.name) || !operationId) throw new Error("이동할 식물을 선택해주세요.");
  const positions = { ...state.positions };
  const added: MovementRecord[] = [];
  for (const plant of unique) {
    const id = `${operationId}:${plant.id}`;
    if (state.history.some((item) => item.id === id) || positions[plant.id] === destination) continue;
    const last = state.history.find((item) => item.plantId === plant.id);
    if (last && last.date > date) throw new Error(`${plant.name}: 가장 최근 이동일 이후 날짜로 기록해주세요.`);
    added.push({ id, plantId: plant.id, plantName: plant.name, from: positions[plant.id] ?? null, to: destination, date, reason: reason.trim(), recordedAt: now.toISOString() });
    positions[plant.id] = destination;
  }
  return { ...state, version: 1, positions, history: [...added, ...state.history] };
}

export function locationLabel(id: string | null | undefined, labels?: Record<string, string>) {
  const location = LOCATIONS.find((item) => item.id === id);
  return location ? `${location.groupName} · ${labels?.[location.id] || location.name}` : "위치 미지정";
}
