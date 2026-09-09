"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Droplets, Search, X } from "lucide-react";
import type { Plant, SaveState } from "@/types/plant";

type BatchWateringProps = {
  plants: Plant[];
  onWateringSaved?: () => void;
};

type WateringResult = { plantId: string; plantName: string; ok: boolean; message?: string };
type WateringResponse = {
  successCount?: number;
  failureCount?: number;
  results?: WateringResult[];
  message?: string;
};

function getTodayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function canShowInWateringList(plant: Plant) {
  return !["자구", "사망"].includes(plant.category.trim());
}

function formatPlantName(plant: Plant) {
  return `${plant.category} ${plant.name}`.toLowerCase();
}

export function BatchWatering({ plants, onWateringSaved }: BatchWateringProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedDueIds, setDismissedDueIds] = useState<string[]>([]);
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [wateredDate, setWateredDate] = useState(getTodayValue);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<WateringResult[]>([]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dismissedDueIdSet = useMemo(() => new Set(dismissedDueIds), [dismissedDueIds]);
  const wateringPlants = useMemo(() => plants.filter(canShowInWateringList), [plants]);
  const duePlants = useMemo(
    () => wateringPlants
      .filter((plant) => plant.isWateringDue && !dismissedDueIdSet.has(plant.id))
      .sort((a, b) => (b.daysSinceWatered ?? 0) - (a.daysSinceWatered ?? 0)),
    [dismissedDueIdSet, wateringPlants],
  );
  const otherPlants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const dueIds = new Set(duePlants.map((plant) => plant.id));
    return wateringPlants.filter(
      (plant) => !dueIds.has(plant.id) && formatPlantName(plant).includes(normalizedQuery),
    );
  }, [duePlants, query, wateringPlants]);
  const dueSelectedCount = duePlants.filter((plant) => selectedIdSet.has(plant.id)).length;
  const areAllDueSelected = duePlants.length > 0 && dueSelectedCount === duePlants.length;
  const successfulResults = results.filter((result) => result.ok);
  const failedResults = results.filter((result) => !result.ok);

  function togglePlant(plantId: string) {
    setSelectedIds((current) =>
      current.includes(plantId) ? current.filter((id) => id !== plantId) : [...current, plantId],
    );
  }

  function toggleAllDuePlants() {
    const dueIds = duePlants.map((plant) => plant.id);
    setSelectedIds((current) =>
      areAllDueSelected
        ? current.filter((id) => !dueIds.includes(id))
        : [...new Set([...current, ...dueIds])],
    );
  }

  async function saveWateringLogs() {
    const selectedPlants = wateringPlants.filter((plant) => selectedIdSet.has(plant.id));
    if (!selectedPlants.length) return;

    setSaveState("saving");
    setMessage("");
    setResults([]);

    try {
      const response = await fetch("/api/watering-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wateredAt: wateredDate,
          plants: selectedPlants.map(({ id, name }) => ({ id, name })),
        }),
      });
      const payload = (await response.json()) as WateringResponse;
      if (!response.ok) throw new Error(payload.message ?? "물주기 기록 저장에 실패했습니다.");

      const nextResults = payload.results ?? [];
      const failedIds = nextResults.filter((result) => !result.ok).map((result) => result.plantId);
      const succeededIds = nextResults.filter((result) => result.ok).map((result) => result.plantId);
      const successCount = payload.successCount ?? succeededIds.length;
      const failureCount = payload.failureCount ?? failedIds.length;

      setResults(nextResults);
      setSelectedIds(failedIds);
      setDismissedDueIds((current) => [...new Set([...current, ...succeededIds])]);
      setSaveState(failureCount ? "error" : "success");
      setMessage(
        failureCount
          ? `${successCount}개 저장, ${failureCount}개 실패했습니다.`
          : `${successCount}개 식물의 물주기를 저장했습니다.`,
      );
      if (successCount) onWateringSaved?.();
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.");
    }
  }

  function renderPlantRow(plant: Plant, due = false) {
    const isSelected = selectedIdSet.has(plant.id);
    const daysText = typeof plant.daysSinceWatered === "number"
      ? `${plant.daysSinceWatered}일 전 물줌`
      : "물준 기록 없음";

    return (
      <label
        key={plant.id}
        className={`flex min-h-14 items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
          isSelected
            ? "border-emerald-800 bg-emerald-50"
            : due ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white"
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-stone-900">{plant.name}</span>
          <span className="block text-xs text-stone-500">
            {due && typeof plant.wateringCycleDays === "number"
              ? `주기 ${plant.wateringCycleDays}일 · ${daysText}`
              : plant.category}
          </span>
        </span>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => togglePlant(plant.id)}
          className="h-5 w-5 shrink-0 accent-emerald-800"
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-stone-700">물 준 날짜</span>
        <input
          type="date"
          value={wateredDate}
          onChange={(event) => setWateredDate(event.target.value)}
          className="h-12 w-full rounded-lg border border-stone-200 bg-white px-3 text-base outline-none transition focus:border-emerald-700"
        />
      </label>

      <section className="rounded-lg border border-amber-200 bg-[#fffaf0] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
              <Droplets size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">물줄 때 된 식물</h2>
              <p className="mt-0.5 text-xs text-stone-600">
                {duePlants.length ? `${duePlants.length}개의 기록이 필요해요` : "지금은 모두 괜찮아요"}
              </p>
            </div>
          </div>
          {duePlants.length ? (
            <button
              type="button"
              onClick={toggleAllDuePlants}
              className="min-h-9 shrink-0 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900"
            >
              {areAllDueSelected ? "전체해제" : "전체선택"}
            </button>
          ) : null}
        </div>

        {duePlants.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">{duePlants.map((plant) => renderPlantRow(plant, true))}</div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm text-stone-600">
            <Check size={17} className="text-emerald-700" aria-hidden="true" />
            오늘 확인할 물주기 알림이 없습니다.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => setIsOtherOpen((current) => !current)}
          className="flex min-h-14 w-full items-center justify-between px-4 text-left"
          aria-expanded={isOtherOpen}
        >
          <span>
            <span className="block text-sm font-bold text-stone-900">다른 식물 물주기</span>
            <span className="block text-xs text-stone-500">알림이 없어도 직접 선택할 수 있어요</span>
          </span>
          <ChevronDown size={20} className={`text-stone-500 transition ${isOtherOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOtherOpen ? (
          <div className="border-t border-stone-200 p-3">
            <div className="relative mb-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="식물 이름 검색"
                className="h-11 w-full rounded-lg border border-stone-200 bg-stone-50 pl-10 pr-10 text-base outline-none focus:border-emerald-700"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-stone-500">
                  <X size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {otherPlants.length ? otherPlants.map((plant) => renderPlantRow(plant)) : (
                <p className="py-5 text-center text-sm text-stone-500">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {message ? (
        <div className={`rounded-lg px-4 py-3 text-sm ${saveState === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          <div className="flex items-start gap-2">
            {saveState === "error" ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <div>
              <p className="font-semibold">{message}</p>
              {successfulResults.length ? <p className="mt-1">성공: {successfulResults.map((result) => result.plantName).join(", ")}</p> : null}
              {failedResults.length ? <p className="mt-1">실패: {failedResults.map((result) => result.plantName).join(", ")}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedIds.length ? (
        <button
          type="button"
          onClick={saveWateringLogs}
          disabled={saveState === "saving"}
          className="min-h-14 w-full rounded-lg bg-emerald-900 px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/15 transition active:scale-[0.99] disabled:bg-stone-300"
        >
          {saveState === "saving" ? "저장 중..." : failedResults.length ? `실패한 ${selectedIds.length}개 다시 저장` : `${selectedIds.length}개 물주기 저장`}
        </button>
      ) : null}
    </div>
  );
}
