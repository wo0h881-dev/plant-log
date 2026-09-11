"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { matchesPlantSearch } from "@/lib/plant-search";
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlants = plants.filter((plant) => matchesPlantSearch(plant, normalizedQuery));
  const selectedPlant = plants.find((plant) => formatPlantName(plant) === value);
  const selectedCategory = selectedPlant?.category ?? "";

  function choosePlant(plant: Plant) {
    onSelect(plant);
    setIsOpen(false);
  }

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return (
    <section ref={containerRef} className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="plant-search" className="text-sm font-bold text-stone-800">식물 선택</label>
        {selectedCategory ? <span className="rounded-full bg-[#edf5df] px-2.5 py-1 text-xs font-bold text-[#52751c]">{selectedCategory}</span> : null}
      </div>

      <div className="rounded-lg border border-[#dce9c8] bg-white p-3 shadow-sm shadow-[#456615]/5">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7d50]" aria-hidden="true" />
          <input
            id="plant-search"
            type="search"
            value={query}
            onFocus={() => setIsOpen(true)}
            onClick={() => setIsOpen(true)}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setIsOpen(true);
            }}
            placeholder={selectedPlant ? selectedPlant.name : "식물 이름 검색"}
            className="h-12 w-full rounded-lg border border-[#dce9c8] bg-[#f7faef] pl-10 pr-20 text-base outline-none transition focus:border-[#52751c]"
          />
          {query ? (
            <button type="button" onClick={() => { onQueryChange(""); setIsOpen(true); }} aria-label="검색어 지우기" className="absolute right-10 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-stone-500">
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
          <ChevronDown size={18} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#52751c] transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </div>

        {isOpen ? (
          <div className="mt-3 border-t border-[#edf2e5] pt-3">
            {!normalizedQuery && recentPlants.length ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {recentPlants.map((plantName) => {
                  const plant = plants.find((item) => formatPlantName(item) === plantName);
                  return plant ? <button key={plantName} type="button" onClick={() => choosePlant(plant)} className="shrink-0 rounded-full bg-[#edf5df] px-3 py-2 text-xs font-bold text-[#456615]">{plant.name}</button> : null;
                })}
              </div>
            ) : null}
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredPlants.length ? filteredPlants.map((plant) => {
                const isSelected = formatPlantName(plant) === value;
                return (
                  <button key={plant.id} type="button" onClick={() => choosePlant(plant)} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition ${isSelected ? "bg-[#456615] text-white" : "bg-[#f7faef] text-stone-700 hover:bg-[#edf5df]"}`}>
                    <span className="truncate">{plant.name}</span>
                    <span className={`ml-2 shrink-0 text-xs ${isSelected ? "text-white/75" : "text-stone-400"}`}>{isSelected ? "선택됨" : plant.category}</span>
                  </button>
                );
              }) : <p className="py-6 text-center text-sm text-stone-500">검색 결과가 없어요.</p>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
