"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Droplets, Sprout, X } from "lucide-react";
import { matchesPlantSearch } from "@/lib/plant-search";
import type { Plant, RecentObservedPlant, SaveState } from "@/types/plant";

type BatchWateringProps = {
  plants: Plant[];
  recentPlants?: RecentObservedPlant[];
  onWateringSaved?: () => void;
};

type WateringResult = { plantId: string; plantName: string; ok: boolean; message?: string };
type WateredPlant = { id: string; name: string };
type WateringResponse = {
  successCount?: number;
  failureCount?: number;
  results?: WateringResult[];
  message?: string;
};
type TodayWateringResponse = { plants?: WateredPlant[]; message?: string };

function getTodayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function canShowInWateringList(plant: Plant) {
  return !["자구", "사망"].includes(plant.category.trim());
}

export function BatchWatering({ plants, recentPlants = [], onWateringSaved }: BatchWateringProps) {
  const today = getTodayValue();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedDueIds, setDismissedDueIds] = useState<string[]>([]);
  const [isDueOpen, setIsDueOpen] = useState(false);
  const [isOtherOpen, setIsOtherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [wateredDate, setWateredDate] = useState(today);
  const [todayWateredPlants, setTodayWateredPlants] = useState<WateredPlant[]>([]);
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  const [todayWateringError, setTodayWateringError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<WateringResult[]>([]);

  const refreshTodayWatered = useCallback(() => {
    fetch(`/api/watering-logs?date=${today}`)
      .then(async (response) => {
        const payload = (await response.json()) as TodayWateringResponse;
        if (!response.ok) throw new Error(payload.message ?? "오늘 물주기 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        setTodayWateredPlants(payload.plants ?? []);
        setTodayWateringError(false);
      })
      .catch(() => {
        setTodayWateredPlants([]);
        setTodayWateringError(true);
      })
      .finally(() => setIsTodayLoading(false));
  }, [today]);

  useEffect(() => {
    refreshTodayWatered();
  }, [refreshTodayWatered]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dismissedDueIdSet = useMemo(() => new Set(dismissedDueIds), [dismissedDueIds]);
  const wateringPlants = useMemo(() => plants.filter(canShowInWateringList), [plants]);
  const duePlants = useMemo(
    () => wateringPlants
      .filter((plant) => plant.isWateringDue && !dismissedDueIdSet.has(plant.id))
      .sort((a, b) => (b.daysSinceWatered ?? 0) - (a.daysSinceWatered ?? 0)),
    [dismissedDueIdSet, wateringPlants],
  );
  const otherPlants = useMemo(
    () => wateringPlants.filter((plant) => matchesPlantSearch(plant, query)),
    [query, wateringPlants],
  );
  const dueSelectedCount = duePlants.filter((plant) => selectedIdSet.has(plant.id)).length;
  const areAllDueSelected = duePlants.length > 0 && dueSelectedCount === duePlants.length;
  const successfulResults = results.filter((result) => result.ok);
  const failedResults = results.filter((result) => !result.ok);
  const recentPhotoByPlant = useMemo(() => {
    const photos = new Map<string, string>();
    for (const recent of recentPlants) {
      if (!recent.photoUrl) continue;
      if (recent.plantId) photos.set(recent.plantId, recent.photoUrl);
      photos.set(`${recent.plantCategory}:${recent.plantName}`, recent.photoUrl);
      photos.set(recent.plantName, recent.photoUrl);
    }
    return photos;
  }, [recentPlants]);
  const getPlantPhoto = useCallback((plant: Pick<Plant, "id" | "category" | "name">) => (
    recentPhotoByPlant.get(plant.id)
      ?? recentPhotoByPlant.get(`${plant.category}:${plant.name}`)
      ?? recentPhotoByPlant.get(plant.name)
      ?? plants.find((item) => item.id === plant.id || item.name === plant.name)?.coverPhotoUrl
  ), [plants, recentPhotoByPlant]);
  const dueHeroPhoto = duePlants.map(getPlantPhoto).find(Boolean);

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

      if (wateredDate === today && succeededIds.length) {
        const succeededPlants = selectedPlants.filter((plant) => succeededIds.includes(plant.id));
        setTodayWateredPlants((current) => {
          const unique = new Map(current.map((plant) => [plant.id || plant.name, plant]));
          succeededPlants.forEach((plant) => unique.set(plant.id, { id: plant.id, name: plant.name }));
          return [...unique.values()];
        });
        refreshTodayWatered();
      }
      if (successCount) onWateringSaved?.();
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.");
    }
  }

  function renderPlantRow(plant: Plant, due = false) {
    const isSelected = selectedIdSet.has(plant.id);
    const photoUrl = getPlantPhoto(plant);
    const daysText = typeof plant.daysSinceWatered === "number"
      ? `${plant.daysSinceWatered}일 전 물줌`
      : "물준 기록 없음";

    return (
      <label
        key={plant.id}
        className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition ${
          isSelected
            ? "border-[#315b36] bg-[#edf5e8]"
            : due ? "border-[#f0c9aa] bg-[#fff7ef]" : "border-stone-200 bg-white"
        }`}
      >
        <span className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl ${due ? "bg-[#f9dfca] text-[#9a4f25]" : "bg-[#e8f0df] text-[#315b36]"}`}>
          {photoUrl ? <Image src={photoUrl} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <Sprout size={18} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-stone-900">{plant.name}</span>
          <span className="block truncate text-xs text-stone-500">
            {due && typeof plant.wateringCycleDays === "number"
              ? `주기 ${plant.wateringCycleDays}일 · ${daysText}`
              : plant.category}
          </span>
        </span>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => togglePlant(plant.id)}
          className="h-6 w-6 shrink-0 accent-[#315b36]"
        />
      </label>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-[#315b36] text-white shadow-lg shadow-[#244529]/15">
        <button
          type="button"
          onClick={() => setIsDueOpen((current) => !current)}
          className="relative flex min-h-52 w-full items-end justify-between overflow-hidden p-5 text-left"
          aria-expanded={isDueOpen}
        >
          {dueHeroPhoto ? <Image src={dueHeroPhoto} alt="" fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" unoptimized /> : null}
          {dueHeroPhoto ? <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5" /> : null}
          <Droplets size={132} strokeWidth={1.2} className="absolute -right-5 -top-5 text-[#a8c66c]/35" aria-hidden="true" />
          <span className="relative">
            <span className="block text-sm font-semibold text-white/70">물줄 때 된 식물</span>
            <span className="mt-1.5 block text-4xl font-black leading-none">{duePlants.length}<span className="ml-1 text-base font-bold">개</span></span>
            <span className="mt-3 block text-xs font-medium text-white/70">눌러서 목록 확인하기</span>
          </span>
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#315b36]">
            <ChevronDown size={21} className={`transition ${isDueOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </button>

        {isDueOpen ? (
          <div className="border-t border-white/15 bg-[#f9faf5] p-3 text-stone-900">
            {duePlants.length ? (
              <>
                <button type="button" onClick={toggleAllDuePlants} className="mb-3 min-h-10 w-full rounded-xl border border-[#cbd9be] bg-white px-3 text-sm font-bold text-[#315b36]">
                  {areAllDueSelected ? "전체해제" : "전체선택"}
                </button>
                <div className="max-h-80 space-y-2 overflow-y-auto">{duePlants.map((plant) => renderPlantRow(plant, true))}</div>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-4 text-sm text-stone-600">
                <Check size={18} className="text-[#315b36]" aria-hidden="true" />
                오늘 확인할 물주기 알림이 없습니다.
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-black text-stone-950">오늘 물 준 식물</h2>
            <p className="mt-0.5 text-xs text-stone-500">오늘의 물주기 기록을 모아봤어요.</p>
          </div>
          <span className="text-sm font-black text-[#315b36]">{todayWateredPlants.length}개</span>
        </div>
        {isTodayLoading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-[#f5f6f2]" />
        ) : todayWateringError ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-4 text-center text-sm text-red-700">오늘 기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</div>
        ) : todayWateredPlants.length ? (
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {todayWateredPlants.map((plant) => (
              <div key={plant.id || plant.name} className="flex w-36 shrink-0 items-center gap-2.5 rounded-2xl bg-[#f5f6f2] p-2.5">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#315b36] text-white">
                  {getPlantPhoto({ id: plant.id, name: plant.name, category: "" }) ? <Image src={getPlantPhoto({ id: plant.id, name: plant.name, category: "" })!} alt="" fill sizes="40px" className="object-cover" unoptimized /> : <Check size={18} aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-stone-900">{plant.name}</span>
                  <span className="mt-0.5 block text-[11px] text-stone-500">오늘 완료</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-[#f5f6f2] px-4 py-4 text-center text-sm text-stone-500">아직 오늘 물 준 식물이 없어요.</div>
        )}
      </section>

      <label className="flex items-center justify-between gap-4 rounded-2xl bg-[#f5f6f2] px-4 py-3">
        <span>
          <span className="block text-sm font-bold text-stone-900">물 준 날짜</span>
          <span className="mt-0.5 block text-xs text-stone-500">다른 날의 기록도 남길 수 있어요.</span>
        </span>
        <input
          type="date"
          value={wateredDate}
          onChange={(event) => setWateredDate(event.target.value)}
          className="h-9 min-w-32 rounded-xl border border-stone-200 bg-white px-2 text-sm font-bold outline-none focus:border-[#315b36]"
        />
      </label>

      <section className="rounded-2xl bg-[#f5f6f2]">
        <button
          type="button"
          onClick={() => setIsOtherOpen((current) => !current)}
          className="flex min-h-14 w-full items-center justify-between px-4 text-left"
          aria-expanded={isOtherOpen}
        >
          <span>
            <span className="block text-sm font-black text-stone-900">다른 식물 물주기</span>
            <span className="mt-0.5 block text-xs text-stone-500">전체 식물에서 직접 선택하기</span>
          </span>
          <ChevronDown size={20} className={`text-stone-500 transition ${isOtherOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {isOtherOpen ? (
          <div className="border-t border-stone-100 p-3">
            <div className="relative mb-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름 또는 초성으로 검색"
                className="h-11 w-full rounded-2xl border-0 bg-white px-4 pr-10 text-sm outline-none focus:ring-1 focus:ring-[#315b36]"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-stone-500">
                  <X size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {otherPlants.length ? otherPlants.map((plant) => renderPlantRow(plant)) : (
                <p className="py-5 text-center text-sm text-stone-500">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {message ? (
        <div className={`rounded-lg px-4 py-3 text-sm ${saveState === "error" ? "bg-red-50 text-red-700" : "bg-[#e8f0df] text-[#315b36]"}`}>
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
        <div className="sticky bottom-20 z-20 -mx-1 bg-white/90 px-1 py-2 backdrop-blur">
          <button
            type="button"
            onClick={saveWateringLogs}
            disabled={saveState === "saving"}
            className="min-h-12 w-full rounded-2xl bg-[#315b36] px-5 text-sm font-black text-white shadow-lg shadow-[#244529]/15 transition active:scale-[0.99] disabled:bg-stone-300"
          >
            {saveState === "saving" ? "저장 중..." : failedResults.length ? `실패한 ${selectedIds.length}개 다시 저장` : `${selectedIds.length}개 물주기 저장`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
