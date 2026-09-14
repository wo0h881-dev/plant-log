"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Bell, Bug, Check, Droplets, Flower2, Leaf, MoreHorizontal, MoreVertical, NotebookPen, Plus, Sprout, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BatchWatering } from "@/components/BatchWatering";
import { ManagementCalendar } from "@/components/ManagementCalendar";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantOverview } from "@/components/PlantOverview";
import { PlantSelect } from "@/components/PlantSelect";
import { RecentObservedPlants } from "@/components/RecentObservedPlants";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, RecentObservedPlant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";
const DEFAULT_OBSERVATION_TAGS = ["신엽", "하엽", "과습", "병해충", "꽃", "기타"];
const OBSERVATION_TAG_ICONS: Record<string, LucideIcon> = {
  신엽: Leaf,
  하엽: Leaf,
  과습: Droplets,
  병해충: Bug,
  꽃: Flower2,
  기타: MoreHorizontal,
};

type RecordTab = "water" | "observation" | "profile" | "more";
type PlantsResponse = { plants: Plant[]; source: "notion" | "fallback" };
type RecentPlantsResponse = { recentPlants?: RecentObservedPlant[] };
type OptionsResponse = { observationTags?: string[] };

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
  return <div className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${isError ? "bg-red-50 text-red-700" : "bg-[#E7EFE3] text-[#284F2A]"}`}>{isError ? <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}<span>{message}</span></div>;
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [isPlantsLoading, setIsPlantsLoading] = useState(true);
  const [isRecentPlantsLoading, setIsRecentPlantsLoading] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [activeTab, setActiveTab] = useState<RecordTab>("water");
  const [query, setQuery] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [profilePlantId, setProfilePlantId] = useState("");
  const [profileOpenRequest, setProfileOpenRequest] = useState(0);
  const [recentPlants, setRecentPlants] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(RECENT_PLANTS_KEY);
    if (!stored) return [];
    try { return JSON.parse(stored) as string[]; } catch { return []; }
  });
  const [recentObservedPlants, setRecentObservedPlants] = useState<RecentObservedPlant[]>([]);
  const [observationTags, setObservationTags] = useState<string[]>(DEFAULT_OBSERVATION_TAGS);
  const [photos, setPhotos] = useState<File[]>([]);
  const [observedDate, setObservedDate] = useState(getTodayValue);
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
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => { refreshPlants(); }, [refreshPlants]);
  useEffect(() => { refreshRecentPlants(); }, [refreshRecentPlants]);
  useEffect(() => { refreshOptions(); }, [refreshOptions]);
  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);
  const selectedPlantLabel = selectedPlant ? formatPlantName(selectedPlant) : "";
  const profilePlant = plants.find((plant) => plant.id === profilePlantId);
  const dueCount = useMemo(() => plants.filter((plant) => plant.isWateringDue && !["자구", "사망"].includes(plant.category.trim())).length, [plants]);
  const canSaveObservation = Boolean(selectedPlant && (photos.length || selectedTags.length || note.trim()) && observationSaveState !== "saving");

  function selectPlant(plant: Plant) {
    setSelectedPlantId(plant.id);
    setQuery(plant.name);
    setObservationMessage("");
  }

  function selectProfilePlant(plant: Plant) {
    setProfilePlantId(plant.id);
    setProfileQuery(plant.name);
  }

  function openPlantFromCalendar(plant: Plant) {
    selectProfilePlant(plant);
    setActiveTab("profile");
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
      refreshRecentPlants();
    } catch (error) {
      setObservationSaveState("error");
      setObservationMessage(error instanceof Error ? error.message : "관찰일지 저장에 실패했습니다.");
    }
  }

  const tabs = [
    { id: "water" as const, label: "물주기", icon: Leaf, badge: dueCount },
    { id: "observation" as const, label: "관찰일지", icon: NotebookPen },
    { id: "profile" as const, label: "내 식물", icon: Sprout },
    { id: "more" as const, label: "더보기", icon: MoreHorizontal },
  ];

  return (
    <main className="min-h-dvh bg-[#F7F8F5] text-[#151515]">
      <div className="mx-auto min-h-dvh w-full max-w-[390px] px-5 pb-24 pt-[max(1.1rem,env(safe-area-inset-top))]">
        {activeTab === "water" ? (
          <>
            <header className="mb-5 flex items-center justify-between gap-4">
              <div><h1 className="text-[32px] font-black leading-tight">물주기</h1><p className="mt-1 text-[13px] font-medium text-[#777B74]">건강한 오늘이, 더 푸른 내일을 만들어요.</p></div>
              <span className="grid h-10 w-10 place-items-center text-[#151515]"><Bell size={23} strokeWidth={1.7} aria-hidden="true" /></span>
            </header>
            <BatchWatering
              plants={plants}
              recentPlants={recentObservedPlants}
              isLoading={isPlantsLoading}
              isPhotoLoading={isPlantsLoading || isRecentPlantsLoading}
              onWateringSaved={refreshPlants}
            />
          </>
        ) : null}

        {activeTab === "observation" ? (
          <>
            <header className="relative mb-4 flex h-10 items-center justify-between">
              <button type="button" onClick={() => setActiveTab("water")} aria-label="물주기로 돌아가기" className="-ml-2 grid h-10 w-10 place-items-center"><ArrowLeft size={23} aria-hidden="true" /></button>
              <h1 className="absolute inset-x-12 text-center text-xl font-black">관찰일지</h1>
              <span className="-mr-2 grid h-10 w-10 place-items-center"><MoreVertical size={21} aria-hidden="true" /></span>
            </header>
            <form onSubmit={saveObservation} className="space-y-3">
              <PlantPhotoUploader files={photos} onChange={setPhotos} onCaptureDateChange={(date) => setObservedDate(date ?? getTodayValue())} />
              <section className="space-y-5 rounded-[30px] bg-white p-4">
                <PlantSelect plants={plants} value={selectedPlantLabel} query={query} recentPlants={recentPlants} onQueryChange={(value) => { setQuery(value); if (value !== selectedPlant?.name) setSelectedPlantId(""); }} onSelect={selectPlant} variant="row" />
                <label className="flex items-center justify-between gap-4"><span className="text-[15px] font-extrabold">관찰 날짜</span><input type="date" value={observedDate} onChange={(event) => setObservedDate(event.target.value)} className="h-9 min-w-32 rounded-xl border-0 bg-[#F0F1EE] px-2 text-xs font-bold outline-none focus:ring-1 focus:ring-[#284F2A]/30" /></label>
                <section>
                  <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-extrabold">관찰태그</h2><span className="text-[11px] text-[#909090]">여러 개를 선택할 수 있어요.</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {observationTags.map((name) => {
                      const Icon = OBSERVATION_TAG_ICONS[name] ?? Tag;
                      const isSelected = selectedTags.includes(name);
                      return <button key={name} type="button" onClick={() => toggleTag(name)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-xs font-bold transition ${isSelected ? "bg-[#284F2A] text-white" : "bg-[#F0F1EE] text-[#333633]"}`}><Icon size={16} strokeWidth={1.8} aria-hidden="true" />{name}</button>;
                    })}
                  </div>
                </section>
                <label className="block">
                  <span className="mb-2 block text-[15px] font-extrabold">메모</span>
                  <span className="relative block"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="오늘의 변화를 기록해보세요." rows={4} className="w-full resize-none rounded-2xl border-0 bg-[#F0F1EE] p-3 pb-7 text-sm leading-6 outline-none placeholder:text-[#A3A5A0] focus:ring-1 focus:ring-[#284F2A]/30" /><span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] text-[#909090]">{note.length}/300</span></span>
                </label>
                <StatusMessage state={observationSaveState} message={observationMessage} />
                <button type="submit" disabled={!canSaveObservation} className="min-h-14 w-full rounded-2xl bg-[#284F2A] px-5 text-sm font-black text-white transition active:scale-[0.99] disabled:bg-[#C9CBC6] disabled:text-[#777B74]">{observationSaveState === "saving" ? "저장 중..." : "관찰일지 저장"}</button>
              </section>
            </form>
          </>
        ) : null}

        {activeTab === "profile" ? (
          <>
            <header className="mb-4 flex items-center justify-between"><h1 className="text-[32px] font-black leading-tight">내 식물</h1><button type="button" onClick={() => setProfileOpenRequest((current) => current + 1)} aria-label="식물 찾기" className="grid h-10 w-10 place-items-center rounded-full bg-[#151515] text-white"><Plus size={21} aria-hidden="true" /></button></header>
            <div className="space-y-5">
              <PlantSelect plants={plants} value={profilePlant ? formatPlantName(profilePlant) : ""} query={profileQuery} recentPlants={[]} onQueryChange={(value) => { setProfileQuery(value); if (!value || value !== profilePlant?.name) setProfilePlantId(""); }} onSelect={selectProfilePlant} variant="search" openRequest={profileOpenRequest} />
              {profilePlant ? <PlantOverview key={profilePlant.id} plant={profilePlant} /> : <RecentObservedPlants plants={plants} recentPlants={recentObservedPlants} onSelect={selectProfilePlant} />}
            </div>
          </>
        ) : null}

        {activeTab === "more" ? <ManagementCalendar plants={plants} onSelectPlant={openPlantFromCalendar} /> : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[390px] border-t border-[#ECEDE9] bg-white px-6 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5" aria-label="주요 화면">
        <div className="grid grid-cols-4 gap-3">
          {tabs.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeTab === id;
            return <button key={id} type="button" onClick={() => setActiveTab(id)} className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${isActive ? "text-[#284F2A]" : "text-[#A1A39E]"}`} aria-current={isActive ? "page" : undefined}><Icon size={19} strokeWidth={isActive ? 2.5 : 1.7} aria-hidden="true" /><span>{label}</span>{badge ? <span className="absolute right-1 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#284F2A] px-1 text-[9px] text-white">{badge}</span> : null}</button>;
          })}
        </div>
      </nav>
    </main>
  );
}
