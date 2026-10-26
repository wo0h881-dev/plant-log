"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, Search, X } from "lucide-react";
import { PlantCoverThumbnail } from "@/components/PlantCoverThumbnail";
import { matchesPlantSearch } from "@/lib/plant-search";
import type { Plant } from "@/types/plant";

type PlantSelectProps = {
  plants: Plant[];
  value: string;
  query: string;
  recentPlants: string[];
  onQueryChange: (value: string) => void;
  onSelect: (plant: Plant) => void;
  variant?: "row" | "search";
  openRequest?: number;
  showPhotos?: boolean;
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

export function PlantSelect({ plants, value, query, recentPlants, onQueryChange, onSelect, variant = "row", openRequest = 0, showPhotos = true }: PlantSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlants = plants.filter((plant) => matchesPlantSearch(plant, normalizedQuery));
  const selectedPlant = plants.find((plant) => formatPlantName(plant) === value);

  function openList() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function choosePlant(plant: Plant) {
    inputRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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

  useEffect(() => {
    if (!openRequest) return;
    const timeoutId = window.setTimeout(() => {
      setIsOpen(true);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [openRequest]);

  const searchField = (
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#777B74]" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={query}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => { onQueryChange(event.target.value); setIsOpen(true); }}
        placeholder="식물 검색"
        aria-label="식물 검색"
        onKeyDown={(event) => { if (event.key === "Escape") { inputRef.current?.blur(); setIsOpen(false); } }}
        className="field pl-11 pr-11"
      />
      {query ? (
        <button type="button" onClick={() => { onQueryChange(""); setIsOpen(true); inputRef.current?.focus(); }} aria-label="검색어 지우기" title="검색어 지우기" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#777B74]">
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <section ref={containerRef} className="relative">
      {variant === "row" ? (
        <>
          <label htmlFor={inputId} className="section-title mb-3 block">식물 선택</label>
          {!isOpen ? (
            <button type="button" onClick={openList} className="flex min-h-14 w-full items-center gap-3 rounded-lg bg-[#F5F6F8] px-4 text-left">
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-bold ${selectedPlant ? "text-[#151515]" : "text-[#909090]"}`}>{selectedPlant?.name ?? "식물을 선택하세요"}</span>
                {selectedPlant ? <span className="mt-0.5 block truncate text-[11px] text-[#909090]">{selectedPlant.category}</span> : null}
              </span>
              <ChevronRight size={19} className="shrink-0 text-[#777B74]" aria-hidden="true" />
            </button>
          ) : searchField}
        </>
      ) : searchField}

      {isOpen ? (
        <div className="absolute inset-x-0 z-40 mt-2 rounded-lg border border-[#ECEEF1] bg-white p-2 shadow-lg shadow-black/5">
          {!normalizedQuery && recentPlants.length ? (
            <div className="mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
              {recentPlants.map((plantName) => {
                const plant = plants.find((item) => formatPlantName(item) === plantName);
                return plant ? <button key={plantName} type="button" onClick={() => choosePlant(plant)} className="shrink-0 rounded-full bg-[#EEF2FF] px-3 py-2 text-xs font-bold text-[#4263EB]">{plant.name}</button> : null;
              })}
            </div>
          ) : null}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredPlants.length ? filteredPlants.map((plant) => {
              const isSelected = formatPlantName(plant) === value;
              return (
                <button key={plant.id} type="button" onClick={() => choosePlant(plant)} className={`flex min-h-12 w-full items-center gap-3 rounded-md px-2.5 text-left transition ${isSelected ? "bg-[#EEF2FF] text-[#4263EB]" : "text-[#191F28] active:bg-[#F5F6F8]"}`}>
                  {showPhotos ? <PlantCoverThumbnail key={plant.coverPhotoUrl ?? "no-cover"} src={plant.coverPhotoUrl} /> : null}
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">{plant.name}</span>
                  <span className="max-w-[35%] shrink-0 break-words text-right text-[11px] text-[#909090]">{plant.category}</span>{isSelected ? <Check size={14} className="shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            }) : <p className="py-6 text-center text-sm text-[#909090]">검색 결과가 없어요.</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
