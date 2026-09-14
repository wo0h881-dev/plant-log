"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, ChevronDown, Sprout, X } from "lucide-react";
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
  const [isOtherOpen, setIsOtherOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [wateredDate, setWateredDate] = useState(today);
  const [todayWateredPlants, setTodayWateredPlants] = useState<WateredPlant[]>([]);
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  const [todayWateringError, setTodayWateringError] = useState(false);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);
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
  const failedPhotoUrlSet = useMemo(() => new Set(failedPhotoUrls), [failedPhotoUrls]);
  const getPlantPhoto = useCallback((plant: Pick<Plant, "id" | "category" | "name">) => {
    const matchingPlant = plants.find((item) => item.id === plant.id || item.name === plant.name);
    const candidates = [
      recentPhotoByPlant.get(plant.id),
      recentPhotoByPlant.get(`${plant.category}:${plant.name}`),
      recentPhotoByPlant.get(plant.name),
      matchingPlant?.coverPhotoUrl,
    ];
    return candidates.find((url) => url && !failedPhotoUrlSet.has(url));
  }, [failedPhotoUrlSet, plants, recentPhotoByPlant]);
  const dueHeroPhoto = duePlants.map(getPlantPhoto).find(Boolean);

  function markPhotoFailed(url: string) {
    setFailedPhotoUrls((current) => current.includes(url) ? current : [...current, url]);
  }

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
      if (wateredDate === today) {
        setDismissedDueIds((current) => [...new Set([...current, ...succeededIds])]);
      }
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
      <button
        key={plant.id}
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        onClick={() => togglePlant(plant.id)}
        className={`flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[22px] bg-white px-3 py-2.5 text-left transition ${
          isSelected
            ? "ring-2 ring-[#284F2A]"
            : due ? "ring-1 ring-[#E5DFC4]" : ""
        }`}
      >
        <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#E7EDE3] text-[#284F2A]">
          {photoUrl ? <Image src={photoUrl} alt="" fill sizes="48px" className="object-cover" unoptimized onError={() => markPhotoFailed(photoUrl)} /> : <Sprout size={18} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-stone-900">{plant.name}</span>
          <span className="mt-1 block truncate text-[11px] text-[#909090]">
            {due && typeof plant.wateringCycleDays === "number"
              ? `주기 ${plant.wateringCycleDays}일 · ${daysText}`
              : daysText}
          </span>
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${isSelected ? "border-[#5C9A3C] bg-[#5C9A3C] text-white" : "border-[#B7BAB4] bg-white text-transparent"}`}>
          <Check size={16} strokeWidth={3} aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-[#284F2A] text-white">
        <button type="button" onClick={() => setIsDueOpen((current) => !current)} className="relative flex min-h-[255px] w-full items-end justify-between overflow-hidden p-5 text-left" aria-expanded={isDueOpen}>
          {dueHeroPhoto ? <Image src={dueHeroPhoto} alt="" fill priority sizes="(max-width: 390px) 100vw, 390px" className="object-cover object-center" unoptimized onError={() => markPhotoFailed(dueHeroPhoto)} /> : <span className="absolute inset-0 grid place-items-center bg-[#DCE7D5] text-[#284F2A]"><Sprout size={74} strokeWidth={1} aria-hidden="true" /></span>}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <span className="relative pb-0.5">
            <span className="block text-lg font-extrabold">물줄 때 된 식물</span>
            <span className="mt-1 block text-[46px] font-black leading-none">{duePlants.length}<span className="ml-1 text-lg">개</span></span>
          </span>
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-[#151515] text-white">
            {isDueOpen ? <ChevronDown size={21} className="rotate-180" aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
          </span>
        </button>
        {isDueOpen ? (
          <div className="bg-[#F2F4EF] p-3 text-[#151515]">
            {duePlants.length ? <><button type="button" onClick={toggleAllDuePlants} className="mb-2.5 min-h-10 w-full rounded-2xl bg-white text-sm font-extrabold text-[#284F2A]">{areAllDueSelected ? "전체해제" : "전체선택"}</button><div className="max-h-80 space-y-2 overflow-y-auto">{duePlants.map((plant) => renderPlantRow(plant, true))}</div></> : <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm text-[#777B74]"><Check size={18} className="text-[#284F2A]" aria-hidden="true" />오늘 확인할 물주기 알림이 없습니다.</div>}
          </div>
        ) : null}
      </section>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-[#151515]"><CalendarDays size={17} className="text-[#284F2A]" aria-hidden="true" />물 준 날짜</span>
        <input type="date" value={wateredDate} onChange={(event) => setWateredDate(event.target.value)} className="h-8 min-w-32 rounded-xl border-0 bg-[#F0F1EE] px-2 text-xs font-bold outline-none focus:ring-1 focus:ring-[#284F2A]/30" />
      </label>

      <section>
        <button type="button" onClick={() => setIsOtherOpen((current) => !current)} className="mb-3 flex w-full items-center justify-between text-left" aria-expanded={isOtherOpen}>
          <span className="text-lg font-black text-[#151515]">다른 식물 물주기</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#909090]">{wateringPlants.length}개 <ChevronDown size={17} className={`transition ${isOtherOpen ? "rotate-180" : ""}`} aria-hidden="true" /></span>
        </button>
        {isOtherOpen ? (
          <div>
            <div className="relative mb-3">
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 초성으로 검색" className="h-10 w-full rounded-full border-0 bg-[#EDEEEA] px-4 pr-10 text-sm outline-none placeholder:text-[#909090] focus:ring-1 focus:ring-[#284F2A]/30" />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-[#777B74]"><X size={16} aria-hidden="true" /></button> : null}
            </div>
            <div className="max-h-[25rem] space-y-2 overflow-y-auto">{otherPlants.length ? otherPlants.map((plant) => renderPlantRow(plant)) : <p className="py-5 text-center text-sm text-[#909090]">검색 결과가 없습니다.</p>}</div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[15px] font-extrabold text-[#151515]">오늘 물 준 식물</h2><span className="text-xs font-bold text-[#284F2A]">{todayWateredPlants.length}개</span></div>
        {isTodayLoading ? <div className="h-14 animate-pulse rounded-2xl bg-white" /> : todayWateringError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-xs text-red-700">오늘 기록을 불러오지 못했어요.</div> : todayWateredPlants.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">{todayWateredPlants.map((plant) => { const photoUrl = getPlantPhoto({ id: plant.id, name: plant.name, category: "" }); return <div key={plant.id || plant.name} className="flex w-32 shrink-0 items-center gap-2 rounded-2xl bg-white p-2"><span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#E7EDE3] text-[#284F2A]">{photoUrl ? <Image src={photoUrl} alt="" fill sizes="36px" className="object-cover" unoptimized onError={() => markPhotoFailed(photoUrl)} /> : <Check size={16} aria-hidden="true" />}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{plant.name}</span><span className="text-[10px] text-[#909090]">오늘 완료</span></span></div>; })}</div>
        ) : <div className="rounded-2xl bg-white px-4 py-3 text-center text-xs text-[#909090]">아직 오늘 물 준 식물이 없어요.</div>}
      </section>

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${saveState === "error" ? "bg-red-50 text-red-700" : "bg-[#E7EFE3] text-[#284F2A]"}`}><div className="flex items-start gap-2">{saveState === "error" ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<div><p className="font-semibold">{message}</p>{successfulResults.length ? <p className="mt-1">성공: {successfulResults.map((result) => result.plantName).join(", ")}</p> : null}{failedResults.length ? <p className="mt-1">실패: {failedResults.map((result) => result.plantName).join(", ")}</p> : null}</div></div></div> : null}

      {selectedIds.length ? <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-[390px] px-5 py-2"><button type="button" onClick={saveWateringLogs} disabled={saveState === "saving"} className="pointer-events-auto min-h-12 w-full rounded-2xl bg-[#284F2A] px-5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-[#C9CBC6]">{saveState === "saving" ? "저장 중..." : failedResults.length ? `실패한 ${selectedIds.length}개 다시 저장` : `${selectedIds.length}개 물주기 저장`}</button></div> : null}
    </div>
  );
}
