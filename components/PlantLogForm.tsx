"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantSelect } from "@/components/PlantSelect";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";

type PlantsResponse = {
  plants: Plant[];
  source: "notion" | "fallback";
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant>(fallbackPlants[0]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [wateredToday, setWateredToday] = useState(false);
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/plants")
      .then((response) => response.json() as Promise<PlantsResponse>)
      .then((payload) => {
        const nextPlants = payload.plants.length ? payload.plants : fallbackPlants;
        setPlants(nextPlants);
        setSelectedPlant(nextPlants[0]);
      })
      .catch(() => {
        setPlants(fallbackPlants);
        setSelectedPlant(fallbackPlants[0]);
      });
  }, []);

  const selectedPlantLabel = formatPlantName(selectedPlant);
  const hasRecordContent = photos.length > 0 || note.trim().length > 0 || wateredToday;
  const canSave = useMemo(
    () => Boolean(selectedPlant.name && hasRecordContent && saveState !== "saving"),
    [selectedPlant.name, hasRecordContent, saveState],
  );

  function selectPlant(plant: Plant) {
    setSelectedPlant(plant);
    setQuery(plant.name);
  }

  function storeRecentPlant(plantName: string) {
    const next = [plantName, ...recentPlants.filter((item) => item !== plantName)].slice(0, 5);
    setRecentPlants(next);
    window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPlant.name) {
      setMessage("식물을 선택하세요.");
      setSaveState("error");
      return;
    }

    if (!hasRecordContent) {
      setMessage("사진, 메모, 물 줌 기록 중 하나는 입력하세요.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setMessage("");

    const createdAt = new Date().toISOString();
    const formData = new FormData();
    photos.forEach((photo) => formData.append("photos", photo));
    formData.append("plantName", selectedPlant.name);
    formData.append("plantCategory", selectedPlant.category);
    formData.append("note", note);
    formData.append("createdAt", createdAt);
    if (wateredToday) {
      formData.append("wateredAt", createdAt);
    }

    try {
      const response = await fetch("/api/plant-logs", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "저장에 실패했습니다.");
      }

      storeRecentPlant(selectedPlantLabel);
      setSaveState("success");
      setMessage("Notion에 저장했습니다.");
      setNote("");
      setWateredToday(false);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#dff7df,transparent_34%),linear-gradient(180deg,#f7fbf4,#eef4ec)] text-stone-950">
      <form onSubmit={handleSubmit} className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-4 pt-5">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">오늘의 식물 기록</p>
            <h1 className="text-3xl font-bold tracking-tight">Plant Log</h1>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl shadow-sm shadow-emerald-950/10">
            🪴
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-5">
          <PlantPhotoUploader files={photos} onChange={setPhotos} />

          <PlantSelect
            plants={plants}
            value={selectedPlantLabel}
            query={query}
            recentPlants={recentPlants}
            onQueryChange={setQuery}
            onSelect={selectPlant}
          />

          <section className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm shadow-stone-950/5">
            <label className="flex min-h-12 items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-semibold text-stone-800">물 준 기록</span>
                <span className="block text-sm text-stone-500">체크하면 오늘 날짜가 물준날로 저장돼요</span>
              </span>
              <input
                type="checkbox"
                checked={wateredToday}
                onChange={(event) => setWateredToday(event.target.checked)}
                className="h-6 w-6 accent-emerald-900"
              />
            </label>
          </section>

          <section className="space-y-2">
            <label htmlFor="note" className="text-sm font-semibold text-stone-800">
              메모
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="잎 끝 갈변 확인&#10;오늘 물 줌&#10;응애 발견"
              rows={6}
              className="w-full resize-none rounded-[1.5rem] border border-stone-200 bg-white p-4 text-base shadow-sm shadow-stone-950/5 outline-none transition placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-500"
            />
          </section>
        </div>

        <footer className="sticky bottom-0 -mx-4 mt-5 bg-gradient-to-t from-[#eef4ec] via-[#eef4ec] to-transparent px-4 pb-2 pt-5">
          {message ? (
            <p
              className={`mb-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                saveState === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSave}
            className="min-h-14 w-full rounded-[1.25rem] bg-emerald-900 px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/20 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
          >
            {saveState === "saving" ? "저장 중..." : "Notion에 저장"}
          </button>
        </footer>
      </form>
    </main>
  );
}
