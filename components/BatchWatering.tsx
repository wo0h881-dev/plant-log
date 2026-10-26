"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, ChevronDown, Sprout, X } from "lucide-react";
import { matchesPlantSearch } from "@/lib/plant-search";
import { canShowInWateringList, isWateredToday, seoulDate, type WateredPlant } from "@/lib/watering";
import { cacheWateringHeroPhoto, clearCachedWateringHeroPhoto, readCachedWateringHeroPhoto } from "@/lib/watering-hero-cache";
import type { Plant, RecentObservedPlant, SaveState } from "@/types/plant";
import { PlantCoverThumbnail } from "@/components/PlantCoverThumbnail";

type BatchWateringProps = {
  plants: Plant[];
  recentPlants?: RecentObservedPlant[];
  isLoading?: boolean;
  isPhotoLoading?: boolean;
  onWateringSaved?: () => void;
  onTodayWateredChange?: (plants: WateredPlant[]) => void;
  onSelectPlant?: (plant: Plant) => void;
  onOpenCalendar?: (plant: Plant) => void;
  wateredAt?: string;
  onSavingChange?: (saving: boolean) => void;
  onSelectionChange?: (ids: string[]) => void;
};

type WateringResult = { plantId: string; plantName: string; ok: boolean; message?: string };
type WateringResponse = {
  successCount?: number;
  failureCount?: number;
  results?: WateringResult[];
  message?: string;
};
type TodayWateringResponse = { plants?: WateredPlant[]; message?: string };

const subscribeToCachedHeroPhoto = () => () => undefined;
const getServerCachedHeroPhoto = () => undefined;

export function BatchWatering({
  plants,
  recentPlants = [],
  isLoading = false,
  isPhotoLoading = false,
  onWateringSaved,
  onTodayWateredChange,
  onSelectPlant,
  onOpenCalendar,
  wateredAt,
  onSavingChange,
  onSelectionChange,
}: BatchWateringProps) {
  const today = seoulDate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedDueIds, setDismissedDueIds] = useState<string[]>([]);
  const [isDueOpen, setIsDueOpen] = useState(false);
  const [isPupsOpen, setIsPupsOpen] = useState(false);
  const [isOtherOpen, setIsOtherOpen] = useState(true);
  const [query, setQuery] = useState("");
  const wateredDate = wateredAt ?? today;
  const [todayWateredPlants, setTodayWateredPlants] = useState<WateredPlant[]>([]);
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  const [todayWateringError, setTodayWateringError] = useState(false);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<string[]>([]);
  const [loadedHeroPhoto, setLoadedHeroPhoto] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<WateringResult[]>([]);
  const submitting = useRef(false);
  const isListLoading = isLoading || isTodayLoading;
  useEffect(() => { onSavingChange?.(saveState === "saving"); }, [saveState, onSavingChange]);

  const refreshTodayWatered = useCallback(() => {
    fetch(`/api/watering-logs?date=${today}`)
      .then(async (response) => {
        const payload = (await response.json()) as TodayWateringResponse;
        if (!response.ok) throw new Error(payload.message ?? "오늘 물주기 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        setTodayWateredPlants((current) => [...new Map([...current, ...(payload.plants ?? [])].map((plant) => [plant.id || plant.name, plant])).values()]);
        setTodayWateringError(false);
      })
      .catch(() => {
        setTodayWateringError(true);
      })
      .finally(() => setIsTodayLoading(false));
  }, [today]);

  useEffect(() => {
    refreshTodayWatered();
  }, [refreshTodayWatered]);

  useEffect(() => { if (!isTodayLoading) onTodayWateredChange?.(todayWateredPlants); }, [todayWateredPlants, onTodayWateredChange, isTodayLoading]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dismissedDueIdSet = useMemo(() => new Set(dismissedDueIds), [dismissedDueIds]);
  const wateringPlants = useMemo(() => plants.filter((plant) => canShowInWateringList(plant) && !dismissedDueIdSet.has(plant.id) && !isWateredToday(plant, todayWateredPlants, today)), [plants, dismissedDueIdSet, todayWateredPlants, today]);
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
  useEffect(() => { onSelectionChange?.(wateringPlants.filter((plant) => selectedIds.includes(plant.id)).map((plant) => plant.id)); }, [selectedIds, wateringPlants, onSelectionChange]);
  const dueSelectedCount = duePlants.filter((plant) => selectedIdSet.has(plant.id)).length;
  const selectedWateringCount = wateringPlants.filter((plant) => selectedIdSet.has(plant.id)).length;
  const dueMaturePlants = duePlants.filter((plant) => plant.category.trim() !== "자구");
  const duePups = duePlants.filter((plant) => plant.category.trim() === "자구");
  const selectedPupCount = duePups.filter((plant) => selectedIdSet.has(plant.id)).length;
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
  const dueHeroPhoto = isPhotoLoading || isTodayLoading ? undefined : duePlants.map(getPlantPhoto).find(Boolean);
  const cachedHeroPhoto = useSyncExternalStore(
    subscribeToCachedHeroPhoto,
    readCachedWateringHeroPhoto,
    getServerCachedHeroPhoto,
  );
  const displayedHeroPhoto = loadedHeroPhoto
    ?? (cachedHeroPhoto && !failedPhotoUrlSet.has(cachedHeroPhoto) ? cachedHeroPhoto : undefined);

  const markPhotoFailed = useCallback((url: string) => {
    setFailedPhotoUrls((current) => current.includes(url) ? current : [...current, url]);
  }, []);

  useEffect(() => {
    if (!dueHeroPhoto || dueHeroPhoto === displayedHeroPhoto) return;

    let cancelled = false;
    const preload = new window.Image();
    preload.onload = () => {
      if (cancelled) return;
      setLoadedHeroPhoto(dueHeroPhoto);
      void cacheWateringHeroPhoto(dueHeroPhoto).catch(() => undefined);
    };
    preload.onerror = () => {
      if (!cancelled) markPhotoFailed(dueHeroPhoto);
    };
    preload.src = dueHeroPhoto;

    return () => {
      cancelled = true;
    };
  }, [displayedHeroPhoto, dueHeroPhoto, markPhotoFailed]);

  function handleDisplayedHeroPhotoError() {
    if (!displayedHeroPhoto) return;
    markPhotoFailed(displayedHeroPhoto);
    setLoadedHeroPhoto(undefined);
    void clearCachedWateringHeroPhoto().catch(() => undefined);
  }

  function togglePlant(plantId: string) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
    if (!selectedPlants.length || submitting.current) return;
    submitting.current = true;

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
    } finally { submitting.current = false; }
  }

  function renderPlantRow(plant: Plant, due = false) {
    const isSelected = selectedIdSet.has(plant.id);
    const daysText = typeof plant.daysSinceWatered === "number"
      ? `${plant.daysSinceWatered}일 전 물줌`
      : "물준 기록 없음";

    return (
      <div key={plant.id} className="water-row transition-colors" data-selected={isSelected}>
        <button type="button" onClick={() => onOpenCalendar?.(plant)} aria-label={`${plant.name} 캘린더 보기`} title={`${plant.name} 캘린더 보기`} className="shrink-0 rounded-lg">
          <PlantCoverThumbnail key={plant.coverPhotoUrl ?? "no-cover"} src={plant.coverPhotoUrl} />
        </button>
        <button
        key={plant.id}
        type="button"
        role="checkbox"
        aria-checked={isSelected}
        onClick={() => togglePlant(plant.id)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#191F28]">{plant.name}</span>
          <span className="mt-1 block truncate text-[11px] text-[#909090]">
            {due && typeof plant.wateringCycleDays === "number"
              ? `주기 ${plant.wateringCycleDays}일 · ${daysText}`
              : daysText}
          </span>
        </span>
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${isSelected ? "border-[#4263EB] bg-[#4263EB] text-white" : "border-[#D6DAE0] bg-white text-transparent"}`}>
          <Check size={16} strokeWidth={3} aria-hidden="true" />
        </span>
      </button>
      </div>
    );
  }

  return (
    <fieldset disabled={saveState === "saving"} aria-busy={saveState === "saving"} className="space-y-6 min-w-0">
      <section className="watering-due-panel">
        <button type="button" onClick={() => setIsDueOpen((current) => !current)} disabled={isListLoading} className={`relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-lg bg-[#F5F6F8] p-5 text-left transition-[height] duration-200 ${isDueOpen ? "h-[116px]" : "h-[172px]"}`} aria-expanded={isDueOpen}>
          <span className="relative z-10 min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-[#626B76]">물줄 때 된 식물</span>
            {isListLoading ? <span className="mt-3 block text-sm leading-5 text-[#8B929B]" aria-live="polite">물줄 식물을<br />확인하고 있어요</span> : duePlants.length ? <span className={`mt-2 block font-bold leading-none text-[#4263EB] ${isDueOpen ? "text-[30px]" : "text-[40px]"}`}>{dueMaturePlants.length}<span className="ml-1.5 text-base font-medium text-[#626B76]">개</span></span> : <span className="mt-3 block text-sm leading-5 text-[#626B76]" aria-live="polite">오늘은 물줄 식물이<br />없어요</span>}
            <span className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#626B76]">{isDueOpen ? "목록 접기" : "목록 확인"}<ChevronDown size={14} className={isDueOpen ? "rotate-180" : ""} aria-hidden="true" /></span>
          </span>
          <span className={`relative w-[42%] shrink-0 overflow-hidden rounded-lg bg-[#EEF2FF] transition-[height] duration-200 ${isDueOpen ? "h-[76px]" : "h-[132px]"}`}>
            {displayedHeroPhoto ? <Image src={displayedHeroPhoto} alt="" fill priority sizes="160px" className="object-cover object-center" unoptimized onError={handleDisplayedHeroPhotoError} /> : isPhotoLoading || isTodayLoading || dueHeroPhoto ? <span className="photo-skeleton" aria-hidden="true"><span className="photo-skeleton-shine" /></span> : <span className="absolute inset-0 grid place-items-center text-[#8C9DC5]"><Sprout size={42} strokeWidth={1.2} aria-hidden="true" /></span>}
          </span>
        </button>
        {isDueOpen ? (
          <div className="due-panel-list text-[#191F28]">
            {duePlants.length ? <>
              <div className="flex items-center justify-between border-b border-[#ECEEF1] pb-2"><span className="text-xs text-[#8B929B]">{dueSelectedCount ? `${dueSelectedCount}개 선택` : "물 준 식물 선택"}</span><button type="button" onClick={toggleAllDuePlants} className="min-h-10 px-2 text-xs font-semibold text-[#4263EB]">{areAllDueSelected ? "전체해제" : "전체선택"}</button></div>
              <div className="max-h-80 overflow-y-auto">
                {dueMaturePlants.map((plant) => renderPlantRow(plant, true))}
                {duePups.length ? <section className="border-t border-[#DDE3D7] pt-2">
                  <button type="button" onClick={() => setIsPupsOpen((current) => !current)} aria-expanded={isPupsOpen} aria-controls="due-pups" className="flex min-h-12 w-full items-center justify-between gap-2 px-2 text-left">
                    <span className="flex items-center gap-2 text-sm font-extrabold"><Sprout size={17} aria-hidden="true" />자구 <span className="text-xs font-semibold text-[#777B74]">{duePups.length}개{selectedPupCount ? ` · 선택 ${selectedPupCount}` : ""}</span></span>
                    <ChevronDown size={18} className={isPupsOpen ? "rotate-180" : ""} aria-hidden="true" />
                  </button>
                  {isPupsOpen ? <div id="due-pups">{duePups.map((plant) => renderPlantRow(plant, true))}</div> : null}
                </section> : null}
              </div>
            </> : <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm text-[#777B74]"><Check size={18} className="text-[#4263EB]" aria-hidden="true" />오늘 확인할 물주기 알림이 없습니다.</div>}
          </div>
        ) : null}
      </section>

      <section>
        <button type="button" onClick={() => setIsOtherOpen((current) => !current)} className="mb-3 flex w-full items-center justify-between text-left" aria-expanded={isOtherOpen}>
          <span className="section-title">다른 식물 물주기</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#909090]">{isListLoading ? "확인 중" : `${wateringPlants.filter((plant) => plant.category.trim() !== "자구").length}개`} <ChevronDown size={17} className={`transition ${isOtherOpen ? "rotate-180" : ""}`} aria-hidden="true" /></span>
        </button>
        {isOtherOpen ? (
          <div>
            <div className="relative mb-3">
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 초성으로 검색" aria-label="물주기 식물 검색" className="field pr-10" />
              {query ? <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-[#777B74]"><X size={16} aria-hidden="true" /></button> : null}
            </div>
            <div className="max-h-[25rem] overflow-y-auto">{isListLoading ? <p className="py-5 text-center text-sm text-[#909090]">오늘 물준 기록을 확인하고 있어요.</p> : otherPlants.length ? otherPlants.map((plant) => renderPlantRow(plant)) : <p className="py-5 text-center text-sm text-[#909090]">검색 결과가 없습니다.</p>}</div>
          </div>
        ) : null}
      </section>

      <section className="section-divider">
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">오늘 물 준 식물</h2><span className="text-xs font-medium text-[#8B929B]">{todayWateredPlants.length}개</span></div>
        {isTodayLoading ? <div className="h-14 animate-pulse rounded-2xl bg-white" /> : todayWateringError ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-xs text-red-700">오늘 기록을 불러오지 못했어요.</div> : todayWateredPlants.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">{todayWateredPlants.map((watered) => {
            const plant = watered.id ? plants.find((item) => item.id.replaceAll("-", "").toLowerCase() === watered.id?.replaceAll("-", "").toLowerCase()) : plants.find((item) => item.name === watered.name);
            return <button key={watered.id || watered.name} type="button" disabled={!plant || !onSelectPlant} onClick={() => { if (plant) onSelectPlant?.(plant); }} aria-label={`${watered.name} 식물 상세 보기`} className="today-watered-plant"><PlantCoverThumbnail key={plant?.coverPhotoUrl ?? "no-cover"} src={plant?.coverPhotoUrl} /><span>{watered.name}</span></button>;
          })}</div>
        ) : <div className="rounded-2xl bg-white px-4 py-3 text-center text-xs text-[#909090]">아직 오늘 물 준 식물이 없어요.</div>}
      </section>

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${saveState === "error" ? "bg-red-50 text-red-700" : "bg-[#EEF2FF] text-[#4263EB]"}`}><div className="flex items-start gap-2">{saveState === "error" ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<div><p className="font-semibold">{message}</p>{successfulResults.length ? <p className="mt-1">성공: {successfulResults.map((result) => result.plantName).join(", ")}</p> : null}{failedResults.length ? <p className="mt-1">실패: {failedResults.map((result) => result.plantName).join(", ")}</p> : null}</div></div></div> : null}

      {selectedWateringCount ? <div className="save-dock"><button type="button" onClick={saveWateringLogs} disabled={saveState === "saving"} className="primary-button">{saveState === "saving" ? "저장 중..." : failedResults.length ? `실패한 ${selectedWateringCount}개 다시 저장` : `${selectedWateringCount}개 물주기 저장`}</button></div> : null}
    </fieldset>
  );
}
