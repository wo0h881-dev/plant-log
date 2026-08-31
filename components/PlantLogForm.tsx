"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BatchWatering } from "@/components/BatchWatering";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { PlantSelect } from "@/components/PlantSelect";
import { fallbackPlants } from "@/lib/plants";
import type { Plant, SaveState } from "@/types/plant";

const RECENT_PLANTS_KEY = "plant-log:recent-plants";
const DEFAULT_OBSERVATION_TAGS = ["신엽", "하엽", "상태이상", "잎끝 갈변", "응애", "분갈이 필요"];
const CARE_PANELS = [
  { id: "water", label: "물", icon: "💧" },
  { id: "light", label: "빛", icon: "☀️" },
  { id: "soil", label: "흙", icon: "🌱" },
  { id: "pot", label: "화분", icon: "🪴" },
] as const;
const DEFAULT_SOIL_OPTIONS = ["배흙", "수태", "세라미스", "펄라이트"];
const DEFAULT_POT_OPTIONS = ["슬릿분", "토분", "플분", "투명분", "행잉분", "기타"];

type CarePanel = (typeof CARE_PANELS)[number]["id"];

type PlantsResponse = {
  plants: Plant[];
  source: "notion" | "fallback";
};

type OptionsResponse = {
  observationTags: string[];
  soilOptions: string[];
  potOptions: string[];
  source: "notion" | "fallback";
};

type SettingChanges = {
  light: boolean;
  soil: boolean;
  pot: boolean;
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

function getTodayValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function PlantLogForm() {
  const [plants, setPlants] = useState<Plant[]>(fallbackPlants);
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<Plant>(fallbackPlants[0]);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [observedDate, setObservedDate] = useState(getTodayValue);
  const [dateSource, setDateSource] = useState<"capture" | "today">("today");
  const [activeCarePanel, setActiveCarePanel] = useState<CarePanel>("water");
  const [observationTags, setObservationTags] = useState<string[]>(DEFAULT_OBSERVATION_TAGS);
  const [soilOptions, setSoilOptions] = useState<string[]>(DEFAULT_SOIL_OPTIONS);
  const [potOptions, setPotOptions] = useState<string[]>(DEFAULT_POT_OPTIONS);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [waterMemo, setWaterMemo] = useState("");
  const [lightSource, setLightSource] = useState("");
  const [lightWatt, setLightWatt] = useState("");
  const [selectedSoils, setSelectedSoils] = useState<string[]>([]);
  const [potType, setPotType] = useState("");
  const [settingChanges, setSettingChanges] = useState<SettingChanges>({
    light: false,
    soil: false,
    pot: false,
  });
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

  const refreshPlants = useCallback(() => {
    fetch("/api/plants")
      .then((response) => response.json() as Promise<PlantsResponse>)
      .then((payload) => {
        const nextPlants = payload.plants.length ? payload.plants : fallbackPlants;
        setPlants(nextPlants);
        setSelectedPlant(
          (current) => nextPlants.find((plant) => plant.id === current.id) ?? nextPlants[0],
        );
      })
      .catch(() => {
        setPlants(fallbackPlants);
        setSelectedPlant(
          (current) => fallbackPlants.find((plant) => plant.id === current.id) ?? fallbackPlants[0],
        );
      });
  }, []);

  useEffect(() => {
    refreshPlants();
  }, [refreshPlants]);

  useEffect(() => {
    fetch("/api/options")
      .then((response) => response.json() as Promise<OptionsResponse>)
      .then((payload) => {
        setObservationTags(payload.observationTags.length ? payload.observationTags : DEFAULT_OBSERVATION_TAGS);
        setSoilOptions(payload.soilOptions.length ? payload.soilOptions : DEFAULT_SOIL_OPTIONS);
        setPotOptions(payload.potOptions.length ? payload.potOptions : DEFAULT_POT_OPTIONS);
      })
      .catch(() => {
        setObservationTags(DEFAULT_OBSERVATION_TAGS);
        setSoilOptions(DEFAULT_SOIL_OPTIONS);
        setPotOptions(DEFAULT_POT_OPTIONS);
      });
  }, []);

  const selectedPlantLabel = formatPlantName(selectedPlant);
  const hasWaterMemo = waterMemo.trim().length > 0;
  const structuredNote = useMemo(() => {
    const lines: string[] = [];

    if (hasWaterMemo) {
      lines.push(`물: ${waterMemo.trim()}`);
    }

    if (note.trim()) {
      lines.push(note.trim());
    }

    return lines.join("\n");
  }, [hasWaterMemo, waterMemo, note]);
  const hasSettingsContent =
    (settingChanges.light && (lightSource.trim().length > 0 || lightWatt.trim().length > 0)) ||
    (settingChanges.soil && selectedSoils.length > 0) ||
    (settingChanges.pot && potType.trim().length > 0);
  const hasRecordContent =
    photos.length > 0 || selectedTags.length > 0 || structuredNote.length > 0 || hasSettingsContent;
  const canSave = useMemo(
    () => Boolean(selectedPlant.name && hasRecordContent && saveState !== "saving"),
    [selectedPlant.name, hasRecordContent, saveState],
  );

  function selectPlant(plant: Plant) {
    setSelectedPlant(plant);
    setQuery(plant.name);
    setLightSource(plant.currentLightName ?? "");
    setLightWatt(typeof plant.currentLightWatt === "number" ? String(plant.currentLightWatt) : "");
    setSelectedSoils(plant.currentSoils ?? []);
    setPotType(plant.currentPot ?? "");
    setSettingChanges({ light: false, soil: false, pot: false });
  }

  function storeRecentPlant(plantName: string) {
    const next = [plantName, ...recentPlants.filter((item) => item !== plantName)].slice(0, 5);
    setRecentPlants(next);
    window.localStorage.setItem(RECENT_PLANTS_KEY, JSON.stringify(next));
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function toggleSoil(soil: string) {
    setSettingChanges((current) => ({ ...current, soil: true }));
    setSelectedSoils((current) =>
      current.includes(soil) ? current.filter((item) => item !== soil) : [...current, soil],
    );
  }

  function updateCaptureDate(captureDate: string | null) {
    setObservedDate(captureDate ?? getTodayValue());
    setDateSource(captureDate ? "capture" : "today");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPlant.name) {
      setMessage("식물을 선택하세요.");
      setSaveState("error");
      return;
    }

    if (!hasRecordContent) {
      setMessage("사진, 메모, 물 줌 기록, 세팅 변경 중 하나는 입력하세요.");
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    setMessage("");

    const formData = new FormData();
    photos.forEach((photo) => formData.append("photos", photo));
    formData.append("plantId", selectedPlant.id);
    formData.append("plantName", selectedPlant.name);
    formData.append("plantCategory", selectedPlant.category);
    formData.append("note", structuredNote);
    formData.append("createdAt", observedDate);
    formData.append("observationTags", JSON.stringify(selectedTags));
    if (hasWaterMemo) {
      formData.append("wateredAt", observedDate);
    }
    formData.append("settingLightName", settingChanges.light ? lightSource.trim() : "");
    formData.append("settingLightWatt", settingChanges.light ? lightWatt.trim() : "");
    formData.append("settingSoils", settingChanges.soil ? JSON.stringify(selectedSoils) : "[]");
    formData.append("settingPotName", settingChanges.pot ? potType.trim() : "");

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
      setSelectedTags([]);
      setWaterMemo("");
      setLightSource("");
      setLightWatt("");
      setSelectedSoils([]);
      setPotType("");
      setSettingChanges({ light: false, soil: false, pot: false });
      refreshPlants();
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
          <BatchWatering
            plants={plants}
            onWateringSaved={refreshPlants}
            showManualWatering={false}
          />

          <PlantSelect
            plants={plants}
            value={selectedPlantLabel}
            query={query}
            recentPlants={recentPlants}
            onQueryChange={setQuery}
            onSelect={selectPlant}
          />

          <section className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm shadow-stone-950/5">
            <div className="grid grid-cols-4 gap-2">
              {CARE_PANELS.map((panel) => {
                const isActive = activeCarePanel === panel.id;

                return (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setActiveCarePanel(panel.id)}
                    className={`aspect-square rounded-2xl text-center transition active:scale-[0.98] ${
                      isActive
                        ? "bg-emerald-900 text-white shadow-md shadow-emerald-950/15"
                        : "bg-stone-50 text-stone-700"
                    }`}
                  >
                    <span className="block text-2xl">{panel.icon}</span>
                    <span className="mt-1 block text-xs font-bold">{panel.label}</span>
                  </button>
                );
              })}
            </div>

            {activeCarePanel === "water" ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={waterMemo}
                  onChange={(event) => setWaterMemo(event.target.value)}
                  placeholder="물 양, 저면관수, 샤워 등"
                  className="h-12 w-full rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
                />
                <BatchWatering
                  plants={plants}
                  onWateringSaved={refreshPlants}
                  showDueAlerts={false}
                />
              </div>
            ) : null}

            {activeCarePanel === "light" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={lightSource}
                    onChange={(event) => {
                      setSettingChanges((current) => ({ ...current, light: true }));
                      setLightSource(event.target.value);
                    }}
                    placeholder="식물등 이름"
                    className="h-12 rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={lightWatt}
                    onChange={(event) => {
                      setSettingChanges((current) => ({ ...current, light: true }));
                      setLightWatt(event.target.value);
                    }}
                    placeholder="와트"
                    className="h-12 rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : null}

            {activeCarePanel === "soil" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {soilOptions.map((soil) => {
                    const isSelected = selectedSoils.includes(soil);

                    return (
                      <button
                        key={soil}
                        type="button"
                        onClick={() => toggleSoil(soil)}
                        className={`min-h-11 rounded-full px-4 text-sm font-bold transition active:scale-[0.98] ${
                          isSelected ? "bg-emerald-900 text-white" : "bg-stone-50 text-stone-700"
                        }`}
                      >
                        {soil}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-medium text-stone-500">
                  선택한 흙 조합이 식물분류 DB의 현재 흙과 세팅 변경 기록에 저장됩니다.
                </p>
              </div>
            ) : null}

            {activeCarePanel === "pot" ? (
              <div className="space-y-3">
                <datalist id="pot-options">
                  {potOptions.map((pot) => (
                    <option key={pot} value={pot} />
                  ))}
                </datalist>
                <input
                  type="text"
                  list="pot-options"
                  value={potType}
                  onChange={(event) => {
                    setSettingChanges((current) => ({ ...current, pot: true }));
                    setPotType(event.target.value);
                  }}
                  placeholder="화분 선택 또는 새 이름 입력"
                  className="h-12 w-full rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
                />
                <p className="text-xs font-medium text-stone-500">
                  새 이름을 입력하면 Notion 선택 옵션으로 같이 저장됩니다.
                </p>
              </div>
            ) : null}
          </section>

          <PlantPhotoUploader
            files={photos}
            onChange={setPhotos}
            onCaptureDateChange={updateCaptureDate}
          />

          <section className="rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 shadow-sm shadow-stone-950/5">
            <p className="text-sm font-semibold text-stone-800">관찰 날짜 · {observedDate}</p>
            <p className="mt-1 text-sm text-stone-500">
              {dateSource === "capture"
                ? "첫 번째 사진의 촬영일을 자동으로 불러왔어요."
                : "사진에 촬영정보가 없어 오늘 날짜를 사용해요."}
            </p>
          </section>

          <section className="space-y-3 rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm shadow-stone-950/5">
            <div>
              <p className="text-sm font-semibold text-stone-800">관찰 태그</p>
              <p className="mt-1 text-sm text-stone-500">자주 쓰는 기록을 눌러서 추가하세요</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {observationTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] ${
                      isSelected
                        ? "bg-emerald-900 text-white"
                        : "bg-stone-50 text-stone-700"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="note" className="text-sm font-semibold text-stone-800">
              추가 메모
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
