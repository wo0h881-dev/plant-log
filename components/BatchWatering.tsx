"use client";

import { useMemo, useState } from "react";
import type { Plant, SaveState } from "@/types/plant";

type BatchWateringProps = {
  plants: Plant[];
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

export function BatchWatering({ plants }: BatchWateringProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredPlants = plants.filter((plant) =>
    formatPlantName(plant).toLowerCase().includes(query.trim().toLowerCase()),
  );

  function togglePlant(plantId: string) {
    setSelectedIds((current) =>
      current.includes(plantId) ? current.filter((id) => id !== plantId) : [...current, plantId],
    );
  }

  async function saveWateringLogs() {
    const selectedPlants = plants.filter((plant) => selectedIdSet.has(plant.id));

    if (!selectedPlants.length) {
      setSaveState("error");
      setMessage("물 준 식물을 선택하세요.");
      return;
    }

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/watering-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wateredAt: new Date().toISOString(),
          plants: selectedPlants.map((plant) => ({
            id: plant.id,
            name: plant.name,
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? "물주기 기록 저장에 실패했습니다.");
      }

      setSelectedIds([]);
      setSaveState("success");
      setMessage(`${selectedPlants.length}개 식물의 물주기를 저장했습니다.`);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "물주기 기록 저장에 실패했습니다.");
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-950/5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <span>
          <span className="block text-base font-bold text-stone-900">여러 식물 물주기</span>
          <span className="block text-sm text-stone-500">
            {isOpen ? "오늘 물 준 식물을 쭉 체크하세요" : "눌러서 체크리스트 열기"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900">
            {selectedIds.length}개
          </span>
          <span className="text-xl font-bold text-emerald-900">{isOpen ? "−" : "+"}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="물 준 식물 검색"
            className="mb-3 h-11 w-full rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
          />

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredPlants.map((plant) => {
              const isSelected = selectedIdSet.has(plant.id);

              return (
                <label
                  key={plant.id}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-4 text-sm transition ${
                    isSelected ? "bg-emerald-900 text-white" : "bg-stone-50 text-stone-700"
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{plant.name}</span>
                    <span className={isSelected ? "text-white/75" : "text-stone-500"}>{plant.category}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePlant(plant.id)}
                    className="h-5 w-5 accent-emerald-900"
                  />
                </label>
              );
            })}
          </div>

          {message ? (
            <p
              className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                saveState === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={saveWateringLogs}
            disabled={!selectedIds.length || saveState === "saving"}
            className="mt-3 min-h-12 w-full rounded-[1.1rem] bg-emerald-800 px-5 text-base font-bold text-white shadow-md shadow-emerald-950/15 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
          >
            {saveState === "saving" ? "물주기 저장 중..." : "선택한 식물 물줌 저장"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
