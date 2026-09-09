"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Droplets, NotebookPen, Sprout } from "lucide-react";
import { BatchWatering } from "@/components/BatchWatering";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantSelect } from "@/components/PlantSelect";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";
const DEFAULT_OBSERVATION_TAGS = ["신엽", "하엽", "상태이상", "잎끝 갈변", "응애"];
const DEFAULT_SOIL_OPTIONS = ["배흙", "수태", "세라미스", "펄라이트"];
const HIDDEN_OBSERVATION_TAGS = new Set(["분갈이", "분갈이 필요"]);

type RecordTab = "water" | "observation" | "repot";
type PlantsResponse = { plants: Plant[]; source: "notion" | "fallback" };
type OptionsResponse = {
  observationTags: string[];
  soilOptions: string[];
  potOptions: string[];
  source: "notion" | "fallback";
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

function getTodayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDisplayDate(dateValue?: string) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(`${dateValue.slice(0, 10)}T12:00:00`),
  );
}

function StatusMessage({ state, message }: { state: SaveState; message: string }) {
  if (!message) return null;
  const isError = state === "error";

  return (
    <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      {isError ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [selectedPlant, setSelectedPlant] = useState<Plant>(fallbackPlants[0]);
  const [activeTab, setActiveTab] = useState<RecordTab>("observation");
  const [query, setQuery] = useState("");
  const [recentPlants, setRecentPlants] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(RECENT_PLANTS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as string[];
    } catch {
      return [];
    }
  });
  const [observationTags, setObservationTags] = useState<string[]>(DEFAULT_OBSERVATION_TAGS);
  const [soilOptions, setSoilOptions] = useState<string[]>(DEFAULT_SOIL_OPTIONS);

  const [photos, setPhotos] = useState<File[]>([]);
  const [observedDate, setObservedDate] = useState(getTodayValue);
  const [dateSource, setDateSource] = useState<"capture" | "today">("today");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [observationSaveState, setObservationSaveState] = useState<SaveState>("idle");
  const [observationMessage, setObservationMessage] = useState("");

  const [repottedDate, setRepottedDate] = useState(getTodayValue);
  const [selectedSoils, setSelectedSoils] = useState<string[]>([]);
  const [repotNote, setRepotNote] = useState("");
  const [repotSaveState, setRepotSaveState] = useState<SaveState>("idle");
  const [repotMessage, setRepotMessage] = useState("");

  const refreshPlants = useCallback(() => {
    fetch("/api/plants")
      .then((response) => response.json() as Promise<PlantsResponse>)
      .then((payload) => {
        const nextPlants = payload.plants.length ? payload.plants : fallbackPlants;
        setPlants(nextPlants);
        setSelectedPlant((current) => nextPlants.find((plant) => plant.id === current.id) ?? nextPlants[0]);
      })
      .catch(() => setPlants(fallbackPlants));
  }, []);

  useEffect(() => {
    refreshPlants();
  }, [refreshPlants]);

  useEffect(() => {
    fetch("/api/options")
      .then((response) => response.json() as Promise<OptionsResponse>)
      .then((payload) => {
        const visibleTags = payload.observationTags.filter((tag) => !HIDDEN_OBSERVATION_TAGS.has(tag));
        setObservationTags(visibleTags.length ? visibleTags : DEFAULT_OBSERVATION_TAGS);
        setSoilOptions(payload.soilOptions.length ? payload.soilOptions : DEFAULT_SOIL_OPTIONS);
      })
      .catch(() => {
        setObservationTags(DEFAULT_OBSERVATION_TAGS);
        setSoilOptions(DEFAULT_SOIL_OPTIONS);
      });
  }, []);

  const selectedPlantLabel = formatPlantName(selectedPlant);
  const dueCount = useMemo(
    () => plants.filter((plant) => plant.isWateringDue && !["자구", "사망"].includes(plant.category.trim())).length,
    [plants],
  );
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date()),
    [],
  );
  const canSaveObservation = Boolean(
    selectedPlant.name && (photos.length || selectedTags.length || note.trim()) && observationSaveState !== "saving",
  );
  const canSaveRepot = Boolean(
    selectedPlant.name && selectedSoils.length && repottedDate && repotSaveState !== "saving",
  );

  function selectPlant(plant: Plant) {
    setSelectedPlant(plant);
    setQuery(plant.name);
    setSelectedSoils(plant.currentSoils ?? []);
    setObservationMessage("");
    setRepotMessage("");
  }

  function storeRecentPlant() {
    const label = formatPlantName(selectedPlant);
    const next = [label, ...recentPlants.filter((item) => item !== label)].slice(0, 5);
    setRecentPlants(next);
    window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next));
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  function toggleSoil(soil: string) {
    setSelectedSoils((current) => current.includes(soil) ? current.filter((item) => item !== soil) : [...current, soil]);
  }

  function updateCaptureDate(captureDate: string | null) {
    setObservedDate(captureDate ?? getTodayValue());
    setDateSource(captureDate ? "capture" : "today");
  }

  async function saveObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveObservation) return;

    setObservationSaveState("saving");
    setObservationMessage("");
    const formData = new FormData();
    photos.forEach((photo) => formData.append("photos", photo));
    formData.append("plantId", selectedPlant.id);
    formData.append("plantName", selectedPlant.name);
    formData.append("plantCategory", selectedPlant.category);
    formData.append("note", note.trim());
    formData.append("createdAt", observedDate);
    formData.append("observationTags", JSON.stringify(selectedTags));

    try {
      const response = await fetch("/api/plant-logs", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "관찰일지 저장에 실패했습니다.");

      storeRecentPlant();
      setPhotos([]);
      setSelectedTags([]);
      setNote("");
      setObservationSaveState("success");
      setObservationMessage("관찰일지를 Notion에 저장했습니다.");
    } catch (error) {
      setObservationSaveState("error");
      setObservationMessage(error instanceof Error ? error.message : "관찰일지 저장에 실패했습니다.");
    }
  }

  async function saveRepot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveRepot) return;

    setRepotSaveState("saving");
    setRepotMessage("");

    try {
      const response = await fetch("/api/repot-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: selectedPlant.id,
          plantName: selectedPlant.name,
          repottedAt: repottedDate,
          soils: selectedSoils,
          note: repotNote,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "분갈이 기록 저장에 실패했습니다.");

      storeRecentPlant();
      setRepotNote("");
      setRepotSaveState("success");
      setRepotMessage("분갈이 기록을 Notion에 저장했습니다.");
      refreshPlants();
    } catch (error) {
      setRepotSaveState("error");
      setRepotMessage(error instanceof Error ? error.message : "분갈이 기록 저장에 실패했습니다.");
    }
  }

  const tabs = [
    { id: "water" as const, label: "물주기", icon: Droplets, badge: dueCount },
    { id: "observation" as const, label: "관찰일지", icon: NotebookPen },
    { id: "repot" as const, label: "분갈이", icon: Sprout },
  ];

  return (
    <main className="min-h-dvh bg-[#f6f5f1] text-stone-950">
      <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-end justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-emerald-800">{todayLabel}</p>
            <h1 className="text-2xl font-bold">Plant Log</h1>
          </div>
          <span className="text-xs font-semibold text-stone-500">식물 관리 기록</span>
        </header>

        <nav className="sticky top-0 z-20 -mx-1 mb-5 bg-[#f6f5f1]/95 px-1 py-2 backdrop-blur" aria-label="기록 종류">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-sm">
            {tabs.map(({ id, label, icon: Icon, badge }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex min-h-12 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-bold transition ${isActive ? "bg-emerald-900 text-white" : "text-stone-600"}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  {badge ? (
                    <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-[11px] ${isActive ? "bg-white text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        {activeTab === "water" ? (
          <BatchWatering plants={plants} onWateringSaved={refreshPlants} />
        ) : null}

        {activeTab === "observation" ? (
          <form onSubmit={saveObservation} className="space-y-5">
            <PlantSelect plants={plants} value={selectedPlantLabel} query={query} recentPlants={recentPlants} onQueryChange={setQuery} onSelect={selectPlant} />
            <PlantPhotoUploader files={photos} onChange={setPhotos} onCaptureDateChange={updateCaptureDate} />

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <label htmlFor="observed-date" className="mb-2 block text-sm font-semibold text-stone-800">관찰 날짜</label>
              <input id="observed-date" type="date" value={observedDate} onChange={(event) => { setObservedDate(event.target.value); setDateSource("today"); }} className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-base outline-none focus:border-emerald-700" />
              <p className="mt-2 text-xs text-stone-500">{dateSource === "capture" ? "첫 번째 사진의 촬영일을 불러왔어요." : "기본값은 오늘 날짜예요."}</p>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-stone-800">관찰 태그</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {observationTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${isSelected ? "border-emerald-900 bg-emerald-900 text-white" : "border-stone-200 bg-stone-50 text-stone-700"}`}>{tag}</button>;
                })}
              </div>
            </section>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-stone-800">메모</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="오늘 관찰한 내용을 남겨보세요" rows={5} className="w-full resize-none rounded-lg border border-stone-200 bg-white p-4 text-base outline-none placeholder:text-stone-400 focus:border-emerald-700" />
            </label>

            <StatusMessage state={observationSaveState} message={observationMessage} />
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-[#f6f5f1] via-[#f6f5f1] to-transparent px-4 pb-2 pt-4">
              <button type="submit" disabled={!canSaveObservation} className="min-h-14 w-full rounded-lg bg-emerald-900 px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/15 transition active:scale-[0.99] disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none">
                {observationSaveState === "saving" ? "저장 중..." : "관찰일지 저장"}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === "repot" ? (
          <form onSubmit={saveRepot} className="space-y-5">
            <PlantSelect plants={plants} value={selectedPlantLabel} query={query} recentPlants={recentPlants} onQueryChange={setQuery} onSelect={selectPlant} />

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <p className="text-xs font-semibold text-stone-500">최근 분갈이</p>
                  <p className="mt-1 text-sm font-bold text-stone-900">{formatDisplayDate(selectedPlant.lastRepottedAt)}</p>
                </div>
                <Sprout size={22} className="text-emerald-800" aria-hidden="true" />
              </div>
              <label htmlFor="repotted-date" className="mb-2 block text-sm font-semibold text-stone-800">분갈이 날짜</label>
              <input id="repotted-date" type="date" value={repottedDate} onChange={(event) => setRepottedDate(event.target.value)} className="h-12 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-base outline-none focus:border-emerald-700" />
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold text-stone-800">사용한 흙</h2>
                <p className="mt-1 text-xs text-stone-500">여러 종류를 함께 선택할 수 있어요</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {soilOptions.map((soil) => {
                  const isSelected = selectedSoils.includes(soil);
                  return <button key={soil} type="button" onClick={() => toggleSoil(soil)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${isSelected ? "border-emerald-900 bg-emerald-900 text-white" : "border-stone-200 bg-stone-50 text-stone-700"}`}>{soil}</button>;
                })}
              </div>
            </section>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-stone-800">분갈이 메모</span>
              <textarea value={repotNote} onChange={(event) => setRepotNote(event.target.value)} placeholder="뿌리 상태나 분갈이 이유를 남겨보세요" rows={4} className="w-full resize-none rounded-lg border border-stone-200 bg-white p-4 text-base outline-none placeholder:text-stone-400 focus:border-emerald-700" />
            </label>

            <StatusMessage state={repotSaveState} message={repotMessage} />
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-[#f6f5f1] via-[#f6f5f1] to-transparent px-4 pb-2 pt-4">
              <button type="submit" disabled={!canSaveRepot} className="min-h-14 w-full rounded-lg bg-emerald-900 px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/15 transition active:scale-[0.99] disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none">
                {repotSaveState === "saving" ? "저장 중..." : "분갈이 기록 저장"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
