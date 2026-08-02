"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantSelect } from "@/components/PlantSelect";
import { getPlants } from "@/lib/plants";
import type { Plant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [selectedPlant, setSelectedPlant] = useState("");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
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
    getPlants().then((items) => {
      setPlants(items);
      setSelectedPlant(items[0]?.name ?? "");
      setQuery(items[0]?.name ?? "");
    });
  }, []);

  const canSave = useMemo(() => Boolean(photo && selectedPlant && saveState !== "saving"), [photo, selectedPlant, saveState]);

  function selectPlant(plantName: string) {
    setSelectedPlant(plantName);
    setQuery(plantName);
  }

  function storeRecentPlant(plantName: string) {
    const next = [plantName, ...recentPlants.filter((item) => item !== plantName)].slice(0, 5);
    setRecentPlants(next);
    window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!photo) {
      setMessage("사진을 선택하세요.");
      setSaveState("error");
      return;
    }

    if (!selectedPlant) {
      setMessage("식물을 선택하세요.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setMessage("");

    const formData = new FormData();
    formData.append("photo", photo);
    formData.append("plantName", selectedPlant);
    formData.append("note", note);
    formData.append("createdAt", new Date().toISOString());

    try {
      const response = await fetch("/api/plant-logs", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "저장에 실패했습니다.");
      }

      storeRecentPlant(selectedPlant);
      setSaveState("success");
      setMessage("Notion에 저장했습니다.");
      setNote("");
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
          <PlantPhotoUploader file={photo} onChange={setPhoto} />

          <PlantSelect
            plants={plants}
            value={selectedPlant}
            query={query}
            recentPlants={recentPlants}
            onQueryChange={setQuery}
            onSelect={selectPlant}
          />

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
