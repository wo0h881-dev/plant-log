"use client";

import Image from "next/image";
import { ArrowRight, Heart, Sprout } from "lucide-react";
import { useState } from "react";
import type { Plant, RecentObservedPlant } from "@/types/plant";

type RecentObservedPlantsProps = {
  plants: Plant[];
  recentPlants: RecentObservedPlant[];
  onSelect: (plant: Plant) => void;
};

function formatDate(dateValue?: string) {
  if (!dateValue) return "최근 기록";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function RecentObservedPlants({ plants, recentPlants, onSelect }: RecentObservedPlantsProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAllPlants, setShowAllPlants] = useState(false);
  const items = recentPlants.flatMap((recent) => {
    const plant = plants.find((item) => item.id === recent.plantId)
      ?? plants.find((item) => item.name === recent.plantName && (!recent.plantCategory || item.category === recent.plantCategory));
    return plant ? [{ recent, plant }] : [];
  });
  const featured = items[0];
  const featuredPhotoUrl = featured?.recent.photoUrl ?? featured?.plant.coverPhotoUrl;
  const recentPhotoByPlantId = new Map(items.map(({ recent, plant }) => [plant.id, recent.photoUrl]));
  const allPlants = [...plants].sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "ko"));

  return (
    <section className="space-y-5">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-black text-[#151515]">{showAllPlants ? "모든 식물" : "최근 관찰한 식물"}</h2>
          <button type="button" onClick={() => setShowAllPlants((current) => !current)} className="min-h-9 rounded-full px-2 text-xs font-semibold text-[#6F746C] transition active:bg-[#E8EAE5]">
            {showAllPlants ? "최근보기" : "전체보기"} <span aria-hidden="true">{showAllPlants ? "‹" : "›"}</span>
          </button>
        </div>
        {showAllPlants ? (
          <div className="grid grid-cols-2 gap-3">
            {allPlants.map((plant) => {
              const photoUrl = recentPhotoByPlantId.get(plant.id) ?? plant.coverPhotoUrl;
              return (
                <button key={plant.id} type="button" onClick={() => onSelect(plant)} className="overflow-hidden rounded-[22px] bg-white text-left transition active:scale-[0.98]">
                  <span className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-[#DCE7D5] text-[#284F2A]">
                    {photoUrl ? <Image src={photoUrl} alt={plant.name} fill sizes="(max-width: 390px) 44vw, 170px" className="object-cover" unoptimized /> : <Sprout size={30} aria-hidden="true" />}
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-[13px] font-extrabold text-[#151515]">{plant.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-[#909090]">{plant.category}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : items.length ? (
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {items.map(({ recent, plant }) => {
              const photoUrl = recent.photoUrl ?? plant.coverPhotoUrl;
              return (
                <button key={plant.id} type="button" onClick={() => onSelect(plant)} className="w-[78px] shrink-0 text-left">
                  <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[18px] bg-[#DCE7D5] text-[#284F2A]">
                    {photoUrl ? <Image src={photoUrl} alt={plant.name} fill sizes="78px" className="object-cover" unoptimized /> : <Sprout size={24} aria-hidden="true" />}
                  </span>
                  <span className="mt-2 block truncate text-xs font-extrabold text-[#151515]">{plant.name}</span>
                  <span className="mt-0.5 block text-[10px] text-[#909090]">{formatDate(recent.observedAt)}</span>
                </button>
              );
            })}
          </div>
        ) : <div className="rounded-3xl bg-white px-4 py-6 text-center text-sm text-[#909090]">최근 관찰한 식물이 아직 없어요.</div>}
      </div>

      {!showAllPlants && featured ? (
        <div className="relative min-h-[245px] overflow-hidden rounded-[30px] bg-[#DCE7D5]">
          {featuredPhotoUrl ? <Image src={featuredPhotoUrl} alt={featured.plant.name} fill priority sizes="(max-width: 390px) 100vw, 390px" className="object-cover object-center" unoptimized /> : <span className="absolute inset-0 grid place-items-center text-[#284F2A]"><Sprout size={72} strokeWidth={1} aria-hidden="true" /></span>}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
          <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#151515] text-white" aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}>
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onSelect(featured.plant)} className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-left text-white">
            <span className="min-w-0">
              <span className="block truncate text-xl font-black">{featured.plant.name}</span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-white/75">{featured.plant.scientificName ?? featured.plant.category}</span>
              <span className="mt-2 block line-clamp-1 text-[11px] text-white/85">{featured.plant.description ?? "최근 관찰 기록과 관리 정보를 확인해보세요."}</span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#151515]"><ArrowRight size={17} aria-hidden="true" /></span>
          </button>
        </div>
      ) : null}

      {!showAllPlants && items.length ? (
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[17px] font-black text-[#151515]">최근 사진</h2><span className="text-xs font-semibold text-[#909090]">{Math.min(items.length, 4)}개</span></div>
          <div className="grid grid-cols-4 gap-2.5">
            {items.slice(0, 4).map(({ recent, plant }) => {
              const photoUrl = recent.photoUrl ?? plant.coverPhotoUrl;
              return <button key={`photo-${plant.id}`} type="button" onClick={() => onSelect(plant)} className="min-w-0 text-left"><span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-[#DCE7D5] text-[#284F2A]">{photoUrl ? <Image src={photoUrl} alt={plant.name} fill sizes="76px" className="object-cover" unoptimized /> : <Sprout size={19} aria-hidden="true" />}</span><span className="mt-1.5 block text-[10px] text-[#777B74]">{formatDate(recent.observedAt)}</span></button>;
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
