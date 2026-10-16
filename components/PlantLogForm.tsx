"use client";

import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, Check, Droplets, NotebookPen, Plus, RefreshCcw, Sprout } from "lucide-react";
import { AddPlantForm } from "@/components/AddPlantForm";
import { ObservationTagPicker } from "@/components/ObservationTagPicker";
import { ObservationSaveChoice, type RecentObservation } from "@/components/ObservationSaveChoice";
import { BatchWatering } from "@/components/BatchWatering";
import { ManagementCalendar } from "@/components/ManagementCalendar";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantOverview } from "@/components/PlantOverview";
import { PlantSelect } from "@/components/PlantSelect";
import { RecentObservedPlants } from "@/components/RecentObservedPlants";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, RecentObservedPlant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";
const DEFAULT_OBSERVATION_TAGS = ["신엽", "하엽", "과습", "뿌리", "상태이상", "해충", "꽃", "기타", "좋음", "안좋음", "분갈이", "온습도"];

type RecordTab = "water" | "observation" | "profile" | "more";
type PlantsResponse = { plants: Plant[]; source: "notion" | "fallback" };
type RecentPlantsResponse = { recentPlants?: RecentObservedPlant[] };
type OptionsResponse = { observationTags?: string[]; soilOptions?: string[]; categoryOptions?: string[]; purchaseSourceOptions?: string[] };

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

function getTodayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function StatusMessage({ state, message }: { state: SaveState; message: string }) {
  if (!message) return null;
  const isError = state === "error";
  return <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${isError ? "bg-red-50 text-red-700" : "bg-[#EEF2FF] text-[#4263EB]"}`}>{isError ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<span>{message}</span></div>;
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [isPlantsLoading, setIsPlantsLoading] = useState(true);
  const [isRecentPlantsLoading, setIsRecentPlantsLoading] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [activeTab, setActiveTab] = useState<RecordTab>("water");
  const [visitedTabs, setVisitedTabs] = useState<RecordTab[]>(["water"]);
  const scrollPositions = useRef<Partial<Record<RecordTab, number>>>({});
  const observationSubmitting = useRef(false);
  const [query, setQuery] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [profilePlantId, setProfilePlantId] = useState("");
  const [profileOpenPhotos, setProfileOpenPhotos] = useState(false);
  const [profilePhotoId, setProfilePhotoId] = useState<string>();
  const [calendarFilter, setCalendarFilter] = useState({ plantId: "", query: "" });
  const [isAddingPlant, setIsAddingPlant] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [purchaseSourceOptions, setPurchaseSourceOptions] = useState<string[]>([]);
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [temperatureAbove, setTemperatureAbove] = useState(false);
  const [humidityAbove, setHumidityAbove] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [recentPlants, setRecentPlants] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const stored = window.localStorage.getItem(RECENT_PLANTS_KEY); const parsed: unknown = stored ? JSON.parse(stored) : []; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
  });
  const [recentObservedPlants, setRecentObservedPlants] = useState<RecentObservedPlant[]>([]);
  const [observationTags, setObservationTags] = useState<string[]>(DEFAULT_OBSERVATION_TAGS);
  const [soilOptions, setSoilOptions] = useState<string[]>(["배흙", "수태", "세라미스", "펄라이트"]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [observedDate, setObservedDate] = useState(getTodayValue);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [repotSoils, setRepotSoils] = useState<string[]>([]);
  const [repotReason, setRepotReason] = useState("");
  const [note, setNote] = useState("");
  const [observationSaveState, setObservationSaveState] = useState<SaveState>("idle");
  const [observationMessage, setObservationMessage] = useState("");
  const [recentObservationChoice, setRecentObservationChoice] = useState<RecentObservation | null>(null);
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[activeTab] ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  function changeTab(next: RecordTab) {
    if (next === activeTab) return;
    scrollPositions.current[activeTab] = window.scrollY;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setVisitedTabs((current) => current.includes(next) ? current : [...current, next]);
    setActiveTab(next);
  }

  const refreshPlants = useCallback(() => {
    fetch("/api/plants")
      .then((response) => response.json() as Promise<PlantsResponse>)
      .then((payload) => {
        const nextPlants = payload.plants.length ? payload.plants : fallbackPlants;
        setPlants(nextPlants);
        setSelectedPlantId((current) => nextPlants.some((plant) => plant.id === current) ? current : "");
        setProfilePlantId((current) => nextPlants.some((plant) => plant.id === current) ? current : "");
      })
      .catch(() => setPlants(fallbackPlants))
      .finally(() => setIsPlantsLoading(false));
  }, []);

  const refreshRecentPlants = useCallback(() => {
    fetch("/api/plant-details")
      .then((response) => response.json() as Promise<RecentPlantsResponse>)
      .then((payload) => setRecentObservedPlants(payload.recentPlants ?? []))
      .catch(() => setRecentObservedPlants([]))
      .finally(() => setIsRecentPlantsLoading(false));
  }, []);

  const refreshOptions = useCallback(() => {
    fetch("/api/options")
      .then((response) => response.json() as Promise<OptionsResponse>)
      .then((payload) => {
        const nextTags = payload.observationTags?.map((tagName) => tagName.trim()).filter(Boolean) ?? [];
        if (nextTags.length) setObservationTags([...new Set(nextTags)]);
        const nextSoils = payload.soilOptions?.map((soilName) => soilName.trim()).filter(Boolean) ?? [];
        if (nextSoils.length) setSoilOptions([...new Set(nextSoils)]);
        setCategoryOptions(payload.categoryOptions ?? []);
        setPurchaseSourceOptions(payload.purchaseSourceOptions ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => { refreshPlants(); }, [refreshPlants]);
  useEffect(() => { refreshRecentPlants(); }, [refreshRecentPlants]);
  useEffect(() => { refreshOptions(); }, [refreshOptions]);
  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
  const selectedPlantLabel = selectedPlant ? formatPlantName(selectedPlant) : "";
  const profilePlant = plants.find((plant) => plant.id === profilePlantId);
  const isRepotting = selectedTags.includes("분갈이");
  const isEnvironment = selectedTags.includes("온습도");
  const canSaveObservation = Boolean(
    selectedPlant &&
    (photos.length || selectedTags.length || note.trim()) &&
    (!isRepotting || repotSoils.length) &&
    (!isEnvironment || temperature.trim() || humidity.trim()) &&
    !isCompressing &&
    observationSaveState !== "saving" && !recentObservationChoice,
  );

  function selectPlant(plant: Plant) {
    if (plant.id !== selectedPlantId) {
      setRepotSoils([]);
      setRepotReason("");
    }
    setSelectedPlantId(plant.id);
    setQuery(plant.name);
    setObservationMessage("");
  }

  function selectProfilePlant(plant: Plant, openPhotos = false, photoId?: string) {
    setProfilePlantId(plant.id);
    setProfileQuery(plant.name);
    setProfileOpenPhotos(openPhotos);
    setProfilePhotoId(photoId);
  }

  function handlePlantRenamed(updated: Plant) {
    const previous = plants.find((plant) => plant.id === updated.id);
    setPlants((current) => current.map((plant) => plant.id === updated.id ? updated : plant));
    if (profilePlantId === updated.id) setProfileQuery(updated.name);
    if (selectedPlantId === updated.id) setQuery(updated.name);
    setRecentObservedPlants((current) => current.map((recent) => recent.plantId === updated.id ? { ...recent, plantName: updated.name, plantCategory: updated.category } : recent));
    if (calendarFilter.plantId === updated.id) setCalendarFilter({ plantId: updated.id, query: updated.name });
    if (previous) {
      const nextRecent = recentPlants.map((label) => label === formatPlantName(previous) ? formatPlantName(updated) : label);
      setRecentPlants(nextRecent);
      try { window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(nextRecent)); } catch { /* Recent selections are optional when storage is unavailable. */ }
    }
  }

  function openPlantFromCalendar(plant: Plant) {
    setIsAddingPlant(false);
    selectProfilePlant(plant);
    changeTab("profile");
  }

  function openCalendarForPlant(plant: Plant) {
    setCalendarFilter({ plantId: plant.id, query: plant.name });
    scrollPositions.current.more = 0;
    changeTab("more");
  }

  function storeRecentPlant() {
    if (!selectedPlant) return;
    const label = formatPlantName(selectedPlant);
    const next = [label, ...recentPlants.filter((item) => item !== label)].slice(0, 5);
    setRecentPlants(next);
    try { window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next)); } catch { /* A saved observation must not fail because recent-selection storage is unavailable. */ }
  }

  function toggleTag(tag: string) {
    if (tag === "분갈이" && selectedTags.includes(tag)) {
      setRepotSoils([]);
      setRepotReason("");
    }
    if (tag === "온습도" && selectedTags.includes(tag)) {
      setTemperature(""); setHumidity(""); setTemperatureAbove(false); setHumidityAbove(false);
    }
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current.filter((item) => !(tag === "좋음" && item === "안좋음") && !(tag === "안좋음" && item === "좋음")), tag]);
  }

  function toggleRepotSoil(soil: string) {
    setRepotSoils((current) => current.includes(soil) ? current.filter((item) => item !== soil) : [...current, soil]);
  }

  async function saveObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveObservation || !selectedPlant || observationSubmitting.current) return;
    observationSubmitting.current = true;
    setObservationSaveState("saving");
    setObservationMessage("");
    try {
      const params = new URLSearchParams({ plantId: selectedPlant.id, date: observedDate });
      const response = await fetch(`/api/plant-logs?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "최근 관찰일지 확인에 실패했습니다.");
      if (payload.recentObservation) {
        setRecentObservationChoice(payload.recentObservation as RecentObservation);
        setObservationSaveState("idle");
        return;
      }
    } catch (error) {
      setObservationSaveState("error");
      setObservationMessage(error instanceof Error ? error.message : "최근 관찰일지 확인에 실패했습니다.");
      return;
    } finally { observationSubmitting.current = false; }
    await persistObservation();
  }

  async function persistObservation(appendToPageId?: string) {
    if (!selectedPlant || observationSubmitting.current) return;
    observationSubmitting.current = true;
    setObservationSaveState("saving");
    setObservationMessage("");
    const formData = new FormData();
    if (appendToPageId) formData.append("appendToPageId", appendToPageId);
    photos.forEach((photo) => formData.append("photos", photo));
    formData.append("plantId", selectedPlant.id);
    formData.append("plantName", selectedPlant.name);
    formData.append("plantCategory", selectedPlant.category);
    formData.append("note", note.trim());
    formData.append("createdAt", observedDate);
    formData.append("observationTags", JSON.stringify(selectedTags));
    if (isEnvironment) {
      formData.append("temperature", temperature);
      formData.append("humidity", humidity);
      formData.append("temperatureAbove", String(temperatureAbove));
      formData.append("humidityAbove", String(humidityAbove));
    }
    if (isRepotting) {
      formData.append("repotSoils", JSON.stringify(repotSoils));
      formData.append("repotPreviousSoils", JSON.stringify(selectedPlant.currentSoils ?? []));
      formData.append("repotReason", repotReason.trim());
    }
    try {
      const response = await fetch("/api/plant-logs", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "관찰일지 저장에 실패했습니다.");
      storeRecentPlant();
      setPhotos([]);
      setSelectedTags([]);
      setRepotSoils([]);
      setRepotReason("");
      setNote("");
      setTemperature(""); setHumidity(""); setTemperatureAbove(false); setHumidityAbove(false);
      setSelectedPlantId("");
      setQuery("");
      setRecentObservationChoice(null);
      setObservationSaveState(payload.warning ? "error" : "success");
      setObservationMessage(
        payload.warning ?? (appendToPageId ? "기존 관찰일지에 추가했습니다." : isRepotting
          ? "관찰일지와 분갈이 기록을 Notion에 저장했습니다."
          : "관찰일지를 Notion에 저장했습니다."),
      );
      refreshRecentPlants();
      refreshPlants();
    } catch (error) {
      setObservationSaveState("error");
      setObservationMessage(error instanceof Error ? error.message : "관찰일지 저장에 실패했습니다.");
    } finally { observationSubmitting.current = false; }
  }

  const tabs = [
    { id: "water" as const, label: "물주기", icon: Droplets },
    { id: "observation" as const, label: "관찰일지", icon: NotebookPen },
    { id: "profile" as const, label: "내 식물", icon: Sprout },
    { id: "more" as const, label: "캘린더", icon: CalendarDays },
  ];

  return (
    <main className="app-shell text-[#191F28]">
      <div className="app-content">
        {visitedTabs.includes("water") ? (
          <section data-screen="water" hidden={activeTab !== "water"}>
            <header className="screen-header">
              <div><h1 className="screen-title">물주기</h1><p className="screen-description">오늘 돌볼 식물들을 확인해요.</p></div>
              <time className="app-date" dateTime={getTodayValue()}>{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</time>
            </header>
            <BatchWatering
              plants={plants}
              recentPlants={recentObservedPlants}
              isLoading={isPlantsLoading}
              isPhotoLoading={isPlantsLoading || isRecentPlantsLoading}
              onWateringSaved={refreshPlants}
              onSelectPlant={openPlantFromCalendar}
            />
          </section>
        ) : null}

        {visitedTabs.includes("observation") ? (
          <section data-screen="observation" hidden={activeTab !== "observation"}>
            <header className="screen-header">
              <div><h1 className="screen-title">관찰일지</h1><p className="screen-description">작은 변화도 오래 기억할 수 있게.</p></div>
              <button type="button" onClick={() => changeTab("water")} aria-label="물주기로 돌아가기" title="물주기로 돌아가기" className="icon-button"><ArrowLeft size={22} aria-hidden="true" /></button>
            </header>
            <form onSubmit={saveObservation} className="space-y-6">
              <fieldset disabled={observationSaveState === "saving" || Boolean(recentObservationChoice)} className="space-y-6" aria-busy={observationSaveState === "saving"}>
              <PlantPhotoUploader files={photos} onChange={setPhotos} onCaptureDateChange={(date) => setObservedDate(date ?? getTodayValue())} onBusyChange={setIsCompressing} />
              <section className="space-y-6">
                <PlantSelect plants={plants} value={selectedPlantLabel} query={query} recentPlants={recentPlants} onQueryChange={(value) => { setQuery(value); if (value !== selectedPlant?.name) setSelectedPlantId(""); }} onSelect={selectPlant} variant="row" showPhotos={false} />
                <label className="flex items-center justify-between gap-4 border-b border-[#ECEEF1] pb-5"><span className="text-sm font-semibold">관찰 날짜</span><input type="date" value={observedDate} onChange={(event) => setObservedDate(event.target.value)} className="h-10 min-w-32 rounded-lg bg-[#F5F6F8] px-3 text-xs outline-none" /></label>
                <section>
                  <div className="mb-3 flex items-center justify-between"><h2 className="section-title">관찰태그</h2><span className="text-[11px] text-[#909090]">{selectedTags.length ? `${selectedTags.length}개 선택` : ""}</span></div>
                  <ObservationTagPicker tags={observationTags} selected={selectedTags} onToggle={toggleTag} />
                </section>
                {isEnvironment ? <section className="space-y-3 border-l-2 border-[#DCE4FF] pl-4"><h2 className="text-sm font-semibold">온습도</h2>{([
                  ["온도 (°C)", temperature, setTemperature, temperatureAbove, setTemperatureAbove, -50, 80],
                  ["습도 (%)", humidity, setHumidity, humidityAbove, setHumidityAbove, 0, 100],
                ] as const).map(([label, value, setter, above, setAbove, min, max]) => <div key={label} className="flex items-end gap-3"><label className="min-w-0 flex-1"><span className="mb-2 block text-xs font-medium text-[#777B74]">{label}</span><input type="number" step="any" min={min} max={max} value={value} onChange={(event) => setter(event.target.value)} className="field" /></label><label className="flex h-12 shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={above} onChange={(event) => setAbove(event.target.checked)} className="h-5 w-5 accent-[#4263EB]" />이상</label></div>)}</section> : null}
                {isRepotting ? (
                  <section className="space-y-4 border-l-2 border-[#DCE4FF] pl-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-[15px] font-extrabold"><RefreshCcw size={17} aria-hidden="true" />분갈이 기록</h2>
                      <span className="text-[11px] font-semibold text-[#777B74]">{observedDate}</span>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold text-[#777B74]">기존 흙</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlant?.currentSoils?.length
                          ? selectedPlant.currentSoils.map((soil) => <span key={soil} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#555A53]">{soil}</span>)
                          : <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#909090]">미기록</span>}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold text-[#777B74]">분갈이 후 흙</p>
                      <div className="flex flex-wrap gap-2">
                        {soilOptions.map((soil) => {
                          const isSelected = repotSoils.includes(soil);
                          return <button key={soil} type="button" onClick={() => toggleRepotSoil(soil)} aria-pressed={isSelected} className={`rounded-full px-3 py-2 text-xs font-bold transition ${isSelected ? "bg-[#4263EB] text-white" : "bg-white text-[#555A53]"}`}>{soil}</button>;
                        })}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold text-[#777B74]">분갈이 이유</span>
                      <input value={repotReason} onChange={(event) => setRepotReason(event.target.value)} maxLength={100} placeholder="예: 뿌리무름" className="field" />
                    </label>
                  </section>
                ) : null}
                <label className="block">
                  <span className="section-title mb-3 block">메모</span>
                  <span className="relative block"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="오늘의 변화를 기록해보세요." rows={4} className="field resize-none pb-8 leading-6" /><span className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-[#909090]">{note.length}/300</span></span>
                </label>
                <StatusMessage state={observationSaveState} message={observationMessage} />
                {photos.length || selectedTags.length || note.trim() ? <div className={`save-dock ${activeTab !== "observation" ? "hidden" : ""}`}><button type="submit" disabled={!canSaveObservation} className="primary-button">{observationSaveState === "saving" ? "저장 중..." : "관찰일지 저장"}</button></div> : null}
              </section>
              </fieldset>
            </form>
          </section>
        ) : null}

        {visitedTabs.includes("profile") ? <section data-screen="profile" hidden={activeTab !== "profile"}>
        {isAddingPlant ? <AddPlantForm plants={plants} categories={[...new Set([...categoryOptions, ...plants.map((plant) => plant.category)])]} purchaseSources={purchaseSourceOptions} onClose={() => setIsAddingPlant(false)} onCreated={(plant) => { setPlants((current) => [...current.filter((item) => item.id !== plant.id), plant]); selectProfilePlant(plant); setIsAddingPlant(false); refreshPlants(); }} /> : null}
        {!isAddingPlant ? (
          <>
            <header className="screen-header"><div><h1 className="screen-title">내 식물</h1><p className="screen-description">{isPlantsLoading ? "식물을 불러오고 있어요." : `${plants.length}개의 식물과 함께하고 있어요.`}</p></div><button type="button" onClick={() => setIsAddingPlant(true)} aria-label="새 식물 등록" title="새 식물 등록" className="grid h-10 w-10 place-items-center rounded-lg bg-[#EEF2FF] text-[#4263EB]"><Plus size={21} aria-hidden="true" /></button></header>
            <div className="space-y-5">
              <PlantSelect plants={plants} value={profilePlant ? formatPlantName(profilePlant) : ""} query={profileQuery} recentPlants={[]} onQueryChange={(value) => { setProfileQuery(value); if (!value || value !== profilePlant?.name) setProfilePlantId(""); }} onSelect={selectProfilePlant} variant="search" />
              {profilePlant ? <PlantOverview key={profilePlant.id} plant={profilePlant} categories={[...new Set([...categoryOptions, ...plants.map((item) => item.category)])]} onOpenCalendar={openCalendarForPlant} onPlantRenamed={handlePlantRenamed} initialGalleryOpen={profileOpenPhotos} initialGalleryPhotoId={profilePhotoId} /> : <RecentObservedPlants plants={plants} recentPlants={recentObservedPlants} onSelect={selectProfilePlant} />}
            </div>
          </>
        ) : null}
        </section> : null}

        {visitedTabs.includes("more") ? <section data-screen="more" hidden={activeTab !== "more"}><ManagementCalendar plants={plants} onSelectPlant={openPlantFromCalendar} filter={calendarFilter} onFilterChange={setCalendarFilter} /></section> : null}
      </div>

      {recentObservationChoice && selectedPlant ? <ObservationSaveChoice recent={recentObservationChoice} plantName={selectedPlant.name} busy={observationSaveState === "saving"} error={observationSaveState === "error" ? observationMessage : ""} onChoose={(append) => { void persistObservation(append ? recentObservationChoice.id : undefined); }} onClose={() => { setRecentObservationChoice(null); setObservationSaveState("idle"); setObservationMessage(""); }} /> : null}

      <nav className="bottom-nav" aria-label="주요 화면">
        <div className="grid grid-cols-4 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return <button key={id} type="button" onClick={() => changeTab(id)} aria-label={label} title={label} className="nav-tab" aria-current={isActive ? "page" : undefined}><span className="nav-icon"><Icon size={22} strokeWidth={isActive ? 2 : 1.6} aria-hidden="true" /></span><span className="nav-label">{label}</span></button>;
          })}
        </div>
      </nav>
    </main>
  );
}
