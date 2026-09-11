"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Droplets, Flower2, NotebookPen, Sprout } from "lucide-react";
import { BatchWatering } from "@/components/BatchWatering";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantOverview } from "@/components/PlantOverview";
import { PlantSelect } from "@/components/PlantSelect";
import { RecentObservedPlants } from "@/components/RecentObservedPlants";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, RecentObservedPlant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";
const DEFAULT_OBSERVATION_TAGS = ["신엽", "하엽", "상태이상", "잎끝 갈변", "응애", "과습"];
const HIDDEN_OBSERVATION_TAGS = new Set(["분갈이", "분갈이 필요"]);

type RecordTab = "water" | "observation" | "profile";
type PlantsResponse = { plants: Plant[]; source: "notion" | "fallback" };
type OptionsResponse = {
  observationTags: string[];
  soilOptions: string[];
  potOptions: string[];
  source: "notion" | "fallback";
};
type RecentPlantsResponse = { recentPlants?: RecentObservedPlant[] };

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

  return (
    <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      {isError ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>{message}</span>
    </div>
  );
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [activeTab, setActiveTab] = useState<RecordTab>("observation");
  const [query, setQuery] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [profilePlantId, setProfilePlantId] = useState("");
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
  const [recentObservedPlants, setRecentObservedPlants] = useState<RecentObservedPlant[]>([]);

  const [photos, setPhotos] = useState<File[]>([]);
  const [observedDate, setObservedDate] = useState(getTodayValue);
  const [dateSource, setDateSource] = useState<"capture" | "today">("today");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [observationSaveState, setObservationSaveState] = useState<SaveState>("idle");
  const [observationMessage, setObservationMessage] = useState("");

  const refreshPlants = useCallback(() => {
    fetch("/api/plants")
      .then((response) => response.json() as Promise<PlantsResponse>)
      .then((payload) => {
        const nextPlants = payload.plants.length ? payload.plants : fallbackPlants;
        setPlants(nextPlants);
        setSelectedPlantId((current) => nextPlants.some((plant) => plant.id === current) ? current : "");
        setProfilePlantId((current) => nextPlants.some((plant) => plant.id === current) ? current : "");
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
      })
      .catch(() => {
        setObservationTags(DEFAULT_OBSERVATION_TAGS);
      });
  }, []);

  useEffect(() => {
    fetch("/api/plant-details")
      .then((response) => response.json() as Promise<RecentPlantsResponse>)
      .then((payload) => setRecentObservedPlants(payload.recentPlants ?? []))
      .catch(() => setRecentObservedPlants([]));
  }, []);

  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
  const selectedPlantLabel = selectedPlant ? formatPlantName(selectedPlant) : "";
  const profilePlant = plants.find((plant) => plant.id === profilePlantId);
  const dueCount = useMemo(
    () => plants.filter((plant) => plant.isWateringDue && !["자구", "사망"].includes(plant.category.trim())).length,
    [plants],
  );
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date()),
    [],
  );
  const canSaveObservation = Boolean(
    selectedPlant && (photos.length || selectedTags.length || note.trim()) && observationSaveState !== "saving",
  );
  function selectPlant(plant: Plant) {
    setSelectedPlantId(plant.id);
    setQuery(plant.name);
    setObservationMessage("");
  }

  function selectProfilePlant(plant: Plant) {
    setProfilePlantId(plant.id);
    setProfileQuery(plant.name);
  }

  function storeRecentPlant() {
    if (!selectedPlant) return;
    const label = formatPlantName(selectedPlant);
    const next = [label, ...recentPlants.filter((item) => item !== label)].slice(0, 5);
    setRecentPlants(next);
    window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next));
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  function updateCaptureDate(captureDate: string | null) {
    setObservedDate(captureDate ?? getTodayValue());
    setDateSource(captureDate ? "capture" : "today");
  }

  async function saveObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSaveObservation || !selectedPlant) return;

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

  const tabs = [
    { id: "water" as const, label: "물주기", icon: Droplets, badge: dueCount },
    { id: "observation" as const, label: "관찰일지", icon: NotebookPen },
    { id: "profile" as const, label: "내 식물", icon: Sprout },
  ];

  return (
    <main className="min-h-dvh bg-[#f1f6eb] text-stone-950">
      <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-6 pt-5">
        <header className="mb-4 flex items-center justify-between rounded-lg bg-[#456615] px-4 py-3 text-white shadow-lg shadow-[#36510e]/15">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#fff1a8] text-[#456615]">
              <Flower2 size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-white/70">{todayLabel}</p>
              <h1 className="text-xl font-bold">Plant Log</h1>
            </div>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#456615]">오늘도 쑥쑥</span>
        </header>

        <nav className="sticky top-0 z-20 -mx-1 mb-5 bg-[#f1f6eb]/95 px-1 py-2 backdrop-blur" aria-label="기록 종류">
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-emerald-100 bg-white p-1 shadow-sm shadow-emerald-900/5">
            {tabs.map(({ id, label, icon: Icon, badge }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex min-h-12 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-bold transition ${isActive ? "bg-[#456615] text-white" : "text-stone-600"}`}
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
            <PlantPhotoUploader files={photos} onChange={setPhotos} onCaptureDateChange={updateCaptureDate} />
            <PlantSelect
              plants={plants}
              value={selectedPlantLabel}
              query={query}
              recentPlants={recentPlants}
              onQueryChange={(value) => {
                setQuery(value);
                if (value !== selectedPlant?.name) setSelectedPlantId("");
              }}
              onSelect={selectPlant}
            />

            <section className="rounded-lg border border-violet-100 bg-[#f8f5ff] p-4">
              <label htmlFor="observed-date" className="mb-2 block text-sm font-semibold text-stone-800">관찰 날짜</label>
              <input id="observed-date" type="date" value={observedDate} onChange={(event) => { setObservedDate(event.target.value); setDateSource("today"); }} className="h-12 w-full rounded-lg border border-violet-100 bg-white px-3 text-base outline-none focus:border-emerald-700" />
              <p className="mt-2 text-xs text-stone-500">{dateSource === "capture" ? "첫 번째 사진의 촬영일을 불러왔어요." : "기본값은 오늘 날짜예요."}</p>
            </section>

            <section className="rounded-lg border border-rose-100 bg-[#fff5f3] p-4">
              <h2 className="text-sm font-semibold text-stone-800">관찰 태그</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {observationTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${isSelected ? "border-emerald-900 bg-emerald-900 text-white" : "border-rose-100 bg-white text-stone-700"}`}>{tag}</button>;
                })}
              </div>
            </section>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-stone-800">메모</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="잎이 어떻게 달라졌나요?" rows={5} className="w-full resize-none rounded-lg border border-amber-100 bg-[#fffdf7] p-4 text-base outline-none placeholder:text-stone-400 focus:border-emerald-700" />
            </label>

            <StatusMessage state={observationSaveState} message={observationMessage} />
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-[#f1f6eb] via-[#f1f6eb] to-transparent px-4 pb-2 pt-4">
              <button type="submit" disabled={!canSaveObservation} className="min-h-14 w-full rounded-lg bg-emerald-900 px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/15 transition active:scale-[0.99] disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none">
                {observationSaveState === "saving" ? "저장 중..." : "관찰일지 저장"}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === "profile" ? (
          <div className="space-y-5">
            <PlantSelect
              plants={plants}
              value={profilePlant ? formatPlantName(profilePlant) : ""}
              query={profileQuery}
              recentPlants={[]}
              onQueryChange={(value) => {
                setProfileQuery(value);
                if (!value) setProfilePlantId("");
              }}
              onSelect={selectProfilePlant}
            />
            {profilePlant ? (
              <PlantOverview key={profilePlant.id} plant={profilePlant} />
            ) : (
              <RecentObservedPlants plants={plants} recentPlants={recentObservedPlants} onSelect={selectProfilePlant} />
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
