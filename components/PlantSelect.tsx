"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Search, SlidersHorizontal, Sprout, X } from "lucide-react";
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
};

function formatPlantName(plant: Plant) {
  return `${plant.category} - ${plant.name}`;
}

export function PlantSelect({ plants, value, query, recentPlants, onQueryChange, onSelect, variant = "row", openRequest = 0 }: PlantSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlants = plants.filter((plant) => matchesPlantSearch(plant, normalizedQuery));
  const selectedPlant = plants.find((plant) => formatPlantName(plant) === value);

  function openList() {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

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
        id={variant === "search" ? "profile-plant-search" : "plant-search"}
        type="search"
        value={query}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onChange={(event) => { onQueryChange(event.target.value); setIsOpen(true); }}
        placeholder="식물 검색"
        className={`h-11 w-full rounded-full border-0 bg-[#EFEFEB] pl-11 text-sm outline-none placeholder:text-[#909090] focus:ring-1 focus:ring-[#284F2A]/30 ${variant === "search" ? "pr-20" : "pr-11"}`}
      />
      {query ? (
        <button type="button" onClick={() => { onQueryChange(""); setIsOpen(true); inputRef.current?.focus(); }} aria-label="검색어 지우기" className={`absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#777B74] ${variant === "search" ? "right-10" : "right-2"}`}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
      {variant === "search" ? (
        <button type="button" onClick={openList} aria-label="식물 목록 열기" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#151515]">
          <SlidersHorizontal size={17} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <section ref={containerRef} className="relative">
      {variant === "row" ? (
        <>
          <label htmlFor="plant-search" className="mb-2 block text-[15px] font-extrabold text-[#151515]">식물 선택</label>
          {!isOpen ? (
            <button type="button" onClick={openList} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-[#F0F1EE] px-3 text-left">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#DDE6D7] text-[#284F2A]">
                {selectedPlant?.coverPhotoUrl ? <Image src={selectedPlant.coverPhotoUrl} alt="" fill sizes="44px" className="object-cover" unoptimized /> : <Sprout size={19} aria-hidden="true" />}
              </span>
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
        <div className="absolute inset-x-0 z-40 mt-2 rounded-3xl bg-white p-2 shadow-xl shadow-black/10 ring-1 ring-black/[0.04]">
          {!normalizedQuery && recentPlants.length ? (
            <div className="mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
              {recentPlants.map((plantName) => {
                const plant = plants.find((item) => formatPlantName(item) === plantName);
                return plant ? <button key={plantName} type="button" onClick={() => choosePlant(plant)} className="shrink-0 rounded-full bg-[#EEF3EB] px-3 py-2 text-xs font-bold text-[#284F2A]">{plant.name}</button> : null;
              })}
            </div>
          ) : null}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredPlants.length ? filteredPlants.map((plant) => {
              const isSelected = formatPlantName(plant) === value;
              return (
                <button key={plant.id} type="button" onClick={() => choosePlant(plant)} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-left transition ${isSelected ? "bg-[#284F2A] text-white" : "text-[#151515] active:bg-[#F0F1EE]"}`}>
                  <span className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl ${isSelected ? "bg-white/15" : "bg-[#EEF3EB] text-[#284F2A]"}`}>
                    {plant.coverPhotoUrl ? <Image src={plant.coverPhotoUrl} alt="" fill sizes="36px" className="object-cover" unoptimized /> : <Sprout size={16} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{plant.name}</span>
                  <span className={`shrink-0 text-[11px] ${isSelected ? "text-white/65" : "text-[#909090]"}`}>{plant.category}</span>
                </button>
              );
            }) : <p className="py-6 text-center text-sm text-[#909090]">검색 결과가 없어요.</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
