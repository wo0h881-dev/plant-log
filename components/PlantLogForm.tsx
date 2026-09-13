"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Droplets, NotebookPen, Sprout } from "lucide-react";
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
  const pageCopy = {
    water: { eyebrow: "WATERING", title: "물주기", description: "오늘 필요한 물주기를 한눈에 확인해요" },
    observation: { eyebrow: "NEW LOG", title: "관찰일지", description: "오늘의 변화를 사진으로 남겨요" },
    profile: { eyebrow: "MY GARDEN", title: "내 식물", description: "사진과 관리 기록을 모아봐요" },
  }[activeTab];

  return (
    <main className="min-h-dvh bg-[#f7f7f2] text-[#171914]">
      <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="mb-6 flex items-start justify-between gap-4 px-1">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-[#5c6f47]">
              <span>{pageCopy.eyebrow}</span>
              <span className="h-px w-8 bg-[#9aac83]" />
              <span className="font-semibold text-stone-400">{todayLabel}</span>
            </div>
            <h1 className="text-[2rem] font-black leading-none text-[#1d2a18]">{pageCopy.title}</h1>
            <p className="mt-2 text-sm font-medium text-stone-500">{pageCopy.description}</p>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#11180f] text-[#cbe27c] shadow-lg shadow-stone-950/10">
            <Sprout size={23} aria-hidden="true" />
          </span>
        </header>

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

            <section className="rounded-lg border border-[#e4e5dd] bg-white p-4 shadow-sm shadow-stone-950/[0.03]">
              <label htmlFor="observed-date" className="mb-2 block text-sm font-semibold text-stone-800">관찰 날짜</label>
              <input id="observed-date" type="date" value={observedDate} onChange={(event) => { setObservedDate(event.target.value); setDateSource("today"); }} className="h-12 w-full rounded-lg border border-[#dedfd7] bg-[#f8f8f4] px-3 text-base outline-none focus:border-[#496238]" />
              <p className="mt-2 text-xs text-stone-500">{dateSource === "capture" ? "첫 번째 사진의 촬영일을 불러왔어요." : "기본값은 오늘 날짜예요."}</p>
            </section>

            <section className="rounded-lg border border-[#e4e5dd] bg-white p-4 shadow-sm shadow-stone-950/[0.03]">
              <h2 className="text-sm font-semibold text-stone-800">관찰 태그</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {observationTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`min-h-10 rounded-full border px-4 text-sm font-bold transition ${isSelected ? "border-[#315b36] bg-[#315b36] text-white" : "border-[#dedfd7] bg-[#f8f8f4] text-stone-700"}`}>{tag}</button>;
                })}
              </div>
            </section>

            <label className="block rounded-lg border border-[#e4e5dd] bg-white p-4 shadow-sm shadow-stone-950/[0.03]">
              <span className="mb-2 block text-sm font-semibold text-stone-800">메모</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="잎이 어떻게 달라졌나요?" rows={5} className="w-full resize-none rounded-lg border border-[#dedfd7] bg-[#f8f8f4] p-4 text-base outline-none placeholder:text-stone-400 focus:border-[#496238]" />
            </label>

            <StatusMessage state={observationSaveState} message={observationMessage} />
            <div className="sticky bottom-24 z-20 -mx-2 bg-[#f7f7f2]/90 px-2 py-2 backdrop-blur">
              <button type="submit" disabled={!canSaveObservation} className="min-h-14 w-full rounded-lg bg-[#11180f] px-5 text-base font-black text-white shadow-xl shadow-stone-950/15 transition active:scale-[0.99] disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none">
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

      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md border-t border-[#dedfd7] bg-[#fbfbf8]/95 px-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl" aria-label="기록 종류">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black transition ${isActive ? "bg-[#315b36] text-white shadow-md shadow-[#315b36]/15" : "text-stone-500"}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
                {badge ? <span className={`absolute right-[18%] top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${isActive ? "bg-[#d8ef80] text-[#26351d]" : "bg-[#f4c96f] text-stone-900"}`}>{badge}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
