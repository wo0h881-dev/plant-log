"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDown, Search, Sprout, X } from "lucide-react";
import type { Plant, RecentObservedPlant } from "@/types/plant";

type PlantSelectProps = {
  plants: Plant[];
  value: string;
  query: string;
  recentPlants: string[];
  featuredPlants?: RecentObservedPlant[];
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
  featuredPlants = [],
  onQueryChange,
  onSelect,
}: PlantSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlants = plants.filter((plant) => {
    const searchable = `${plant.category} ${plant.name}`.toLowerCase();
    return searchable.includes(normalizedQuery);
  });
  const selectedPlant = plants.find((plant) => formatPlantName(plant) === value);
  const selectedCategory = selectedPlant?.category ?? filteredPlants[0]?.category ?? plants[0]?.category ?? "";
  const showFeatured = !normalizedQuery && featuredPlants.length > 0;

  function choosePlant(plant: Plant) {
    onSelect(plant);
    setIsOpen(false);
  }

  function resolveFeaturedPlant(featured: RecentObservedPlant) {
    return plants.find((plant) => plant.id === featured.plantId)
      ?? plants.find((plant) => plant.name === featured.plantName && (!featured.plantCategory || plant.category === featured.plantCategory));
  }

  return (
    <section
      className="space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <div className="flex items-center justify-between">
        <label htmlFor="plant-search" className="text-sm font-bold text-stone-800">식물 선택</label>
        <span className="rounded-full bg-[#edf5df] px-2.5 py-1 text-xs font-bold text-[#52751c]">{selectedCategory}</span>
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
            onChange={(event) => onQueryChange(event.target.value)}
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
            {showFeatured ? (
              <div>
                <p className="mb-2 text-xs font-bold text-stone-500">최근 관찰한 식물</p>
                <div className="flex snap-x gap-2 overflow-x-auto pb-2">
                  {featuredPlants.map((featured) => {
                    const plant = resolveFeaturedPlant(featured);
                    if (!plant) return null;
                    return (
                      <button key={`${featured.plantId}-${featured.plantName}`} type="button" onClick={() => choosePlant(plant)} className="w-28 shrink-0 snap-start overflow-hidden rounded-lg border border-[#dce9c8] bg-[#f7faef] text-left">
                        <div className="relative aspect-square bg-[#e5edcf]">
                          {featured.photoUrl ? <Image src={featured.photoUrl} alt={featured.plantName} fill sizes="112px" className="object-cover" unoptimized /> : <span className="grid h-full place-items-center text-[#52751c]"><Sprout size={25} aria-hidden="true" /></span>}
                        </div>
                        <span className="block truncate px-2 pb-1 pt-2 text-xs font-bold text-stone-900">{featured.plantName}</span>
                        <span className="block truncate px-2 pb-2 text-[10px] text-stone-500">{featured.plantCategory}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
