"use client";

import { useMemo, useState } from "react";
import type { Plant, SaveState } from "@/types/plant";

type BatchWateringProps = {
  plants: Plant[];
  onWateringSaved?: () => void;
};

type WateringResult = {
  plantId: string;
  plantName: string;
  ok: boolean;
  message?: string;
};

type WateringResponse = {
  successCount?: number;
  failureCount?: number;
  results?: WateringResult[];
  message?: string;
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

function getTodayValue() {
  const today = new Date();
  const offsetDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function toDateTime(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

export function BatchWatering({ plants, onWateringSaved }: BatchWateringProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedDueIds, setDismissedDueIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [wateredDate, setWateredDate] = useState(getTodayValue);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<WateringResult[]>([]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dismissedDueIdSet = useMemo(() => new Set(dismissedDueIds), [dismissedDueIds]);
  const successfulResults = results.filter((result) => result.ok);
  const failedResults = results.filter((result) => !result.ok);
  const duePlants = plants.filter(
    (plant) => plant.isWateringDue && !dismissedDueIdSet.has(plant.id),
  ).sort((a, b) => (b.daysSinceWatered ?? 0) - (a.daysSinceWatered ?? 0));
  const filteredPlants = plants.filter((plant) =>
    formatPlantName(plant).toLowerCase().includes(query.trim().toLowerCase()),
  );

  function togglePlant(plantId: string) {
    setSelectedIds((current) =>
      current.includes(plantId) ? current.filter((id) => id !== plantId) : [...current, plantId],
    );
  }

  async function saveWateringLogs() {
    const selectedPlants = plants.filter((plant) => selectedIdSet.has(plant.id));

    if (!selectedPlants.length) {
      setSaveState("error");
      setMessage("물 준 식물을 선택하세요.");
      return;
    }

    if (!wateredDate) {
      setSaveState("error");
      setMessage("물 준 날짜를 선택하세요.");
      return;
    }

    setSaveState("saving");
    setMessage("");
    setResults([]);

    try {
      const response = await fetch("/api/watering-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wateredAt: toDateTime(wateredDate),
          plants: selectedPlants.map((plant) => ({
            id: plant.id,
            name: plant.name,
            category: plant.category,
          })),
        }),
      });
      const payload = (await response.json()) as WateringResponse;

      if (!response.ok) {
        throw new Error(payload.message ?? "물주기 기록 저장에 실패했습니다.");
      }

      const nextResults = payload.results ?? [];
      const failedIds = nextResults.filter((result) => !result.ok).map((result) => result.plantId);
      const successCount = payload.successCount ?? nextResults.filter((result) => result.ok).length;
      const failureCount = payload.failureCount ?? failedIds.length;

      setResults(nextResults);
      setSelectedIds(failedIds);
      setDismissedDueIds((current) => [
        ...new Set([
          ...current,
          ...nextResults.filter((result) => result.ok).map((result) => result.plantId),
        ]),
      ]);
      setSaveState(failureCount ? "error" : "success");
      setMessage(
        failureCount
          ? `${successCount}개 저장, ${failureCount}개 실패했습니다.`
          : `${successCount}개 식물의 물주기를 저장했습니다.`,
      );

      if (successCount) {
        onWateringSaved?.();
      }
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.");
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <span>
          <span className="block text-base font-bold text-stone-900">여러 식물 물주기</span>
          <span className="block text-sm text-stone-500">
            {isOpen ? "물 준 날짜와 식물을 체크하세요" : "눌러서 체크리스트 열기"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
            {duePlants.length ? `알림 ${duePlants.length}` : `${selectedIds.length}개`}
          </span>
          <span className="text-xl font-bold text-emerald-900">{isOpen ? "−" : "+"}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4">
          {duePlants.length ? (
            <div className="mb-4 rounded-[1.25rem] bg-amber-50 p-3 text-sm text-amber-950">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">물줄 때 된 식물</p>
                <span className="text-xs font-semibold">{duePlants.length}개</span>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {duePlants.map((plant) => {
                  const isSelected = selectedIdSet.has(plant.id);
                  const daysText =
                    typeof plant.daysSinceWatered === "number"
                      ? `물 안 준 지 ${plant.daysSinceWatered}일`
                      : "물준 기록 없음";

                  return (
                    <label
                      key={`due-${plant.id}`}
                      className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl px-3 transition ${
                        isSelected ? "bg-amber-200/80" : "bg-white"
                      }`}
                    >
                      <span>
                        <span className="block font-semibold text-stone-900">{plant.name}</span>
                        <span className="block text-xs text-stone-600">
                          관수 주기 {plant.wateringCycleDays}일 · {daysText}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePlant(plant.id)}
                        className="h-5 w-5 accent-emerald-900"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-[1.25rem] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              지금 물주기 알림이 있는 식물이 없습니다.
            </div>
          )}

          <label className="mb-3 block">
            <span className="mb-2 block text-sm font-semibold text-stone-700">물 준 날짜</span>
            <input
              type="date"
              value={wateredDate}
              onChange={(event) => setWateredDate(event.target.value)}
              className="h-11 w-full rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
            />
          </label>

          <div className="relative mb-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="물 준 식물 검색"
              className="h-11 w-full rounded-2xl bg-stone-50 px-4 pr-12 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="검색어 지우기"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-stone-200 text-sm font-bold text-stone-600 transition active:scale-95"
              >
                x
              </button>
            ) : null}
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredPlants.map((plant) => {
              const isSelected = selectedIdSet.has(plant.id);

              return (
                <label
                  key={plant.id}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-sm transition ${
                    isSelected ? "bg-emerald-900 text-white" : "bg-stone-50 text-stone-700"
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{plant.name}</span>
                    <span className={isSelected ? "text-white/75" : "text-stone-500"}>
                      {plant.category}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePlant(plant.id)}
                    className="h-5 w-5 accent-emerald-900"
                  />
                </label>
              );
            })}
          </div>

          {message ? (
            <div
              className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                saveState === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              <p>{message}</p>
              {results.length ? (
                <div className="mt-3 space-y-3">
                  {successfulResults.length ? (
                    <div>
                      <p className="text-xs font-bold">성공 {successfulResults.length}개</p>
                      <ul className="mt-1 space-y-1">
                        {successfulResults.map((result) => (
                          <li key={`success-${result.plantId}`}>✓ {result.plantName}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {failedResults.length ? (
                    <div>
                      <p className="text-xs font-bold">실패 {failedResults.length}개</p>
                      <ul className="mt-1 space-y-1">
                        {failedResults.map((result) => (
                          <li key={`failed-${result.plantId}`}>! {result.plantName}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={saveWateringLogs}
            disabled={!selectedIds.length || saveState === "saving"}
            className="mt-3 min-h-12 w-full rounded-[1.1rem] bg-emerald-800 px-5 text-base font-bold text-white shadow-md shadow-emerald-950/15 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
          >
            {saveState === "saving"
              ? "물주기 저장 중..."
              : failedResults.length
                ? "실패한 식물만 다시 저장"
                : "선택한 식물 물주기 저장"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
