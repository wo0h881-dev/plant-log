"use client";

import type { Plant } from "@/types/plant";

type PlantSelectProps = {
  plants: Plant[];
  value: string;
  query: string;
  recentPlants: string[];
  onQueryChange: (value: string) => void;
  onSelect: (plant: Plant) => void;
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

export function PlantSelect({
  plants,
  value,
  query,
  recentPlants,
  onQueryChange,
  onSelect,
}: PlantSelectProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlants = plants.filter((plant) => {
    const searchable = `${plant.category} ${plant.name}`.toLowerCase();
    return searchable.includes(normalizedQuery);
  });
  const selectedCategory =
    plants.find((plant) => formatPlantName(plant) === value)?.category ?? filteredPlants[0]?.category ?? plants[0]?.category ?? "";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="plant-search" className="text-sm font-semibold text-stone-800">
          식물 선택
        </label>
        <span className="text-xs font-medium text-stone-500">{selectedCategory}</span>
      </div>

      <div className="rounded-[1.5rem] border border-stone-200 bg-white p-3 shadow-sm shadow-stone-950/5">
        <input
          id="plant-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="식물 이름 검색"
          className="h-12 w-full rounded-2xl bg-stone-50 px-4 text-base outline-none ring-1 ring-transparent transition focus:ring-emerald-500"
        />

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {filteredPlants.map((plant) => {
            const displayName = formatPlantName(plant);
            const isSelected = displayName === value;

            return (
              <button
                key={plant.id}
                type="button"
                onClick={() => onSelect(plant)}
                className={`flex min-h-11 w-full items-center justify-between rounded-2xl px-4 text-left text-sm transition ${
                  isSelected
                    ? "bg-emerald-900 text-white"
                    : "bg-stone-50 text-stone-700 hover:bg-emerald-50 hover:text-emerald-950"
                }`}
              >
                <span>{plant.name}</span>
                {isSelected ? <span className="text-xs font-medium">선택됨</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {recentPlants.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentPlants.map((plantName) => (
            <button
              key={plantName}
              type="button"
              onClick={() => {
                const plant = plants.find((item) => formatPlantName(item) === plantName);
                if (plant) onSelect(plant);
              }}
              className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950"
            >
              {plantName}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
