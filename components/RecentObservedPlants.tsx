"use client";

import Image from "next/image";
import { ArrowRight, Clock3, Sprout } from "lucide-react";
import type { Plant, RecentObservedPlant } from "@/types/plant";

type RecentObservedPlantsProps = {
  plants: Plant[];
  recentPlants: RecentObservedPlant[];
  onSelect: (plant: Plant) => void;
};

function formatDate(dateValue?: string) {
  if (!dateValue) return "최근 기록";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(
    new Date(`${dateValue.slice(0, 10)}T12:00:00`),
  );
}

export function RecentObservedPlants({ plants, recentPlants, onSelect }: RecentObservedPlantsProps) {
  const items = recentPlants.flatMap((recent) => {
    const plant = plants.find((item) => item.id === recent.plantId)
      ?? plants.find((item) => item.name === recent.plantName && (!recent.plantCategory || item.category === recent.plantCategory));
    return plant ? [{ recent, plant }] : [];
  });
  const featuredPhotoUrl = items[0]?.recent.photoUrl ?? items[0]?.plant.coverPhotoUrl;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">최근 관찰한 식물</h2>
          <p className="mt-0.5 text-xs text-stone-500">카드를 누르면 식물 기록을 볼 수 있어요.</p>
        </div>
        <Clock3 size={19} className="text-[#496238]" aria-hidden="true" />
      </div>

      {items.length ? (
        <>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3">
            {items.map(({ recent, plant }) => (
            <button
              key={`${recent.plantId}-${recent.plantName}`}
              type="button"
              onClick={() => onSelect(plant)}
              className="w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-sm shadow-stone-950/10"
            >
              <div className="relative aspect-[4/5] bg-[#dfe9ce]">
                {recent.photoUrl || plant.coverPhotoUrl ? (
                  <Image src={recent.photoUrl ?? plant.coverPhotoUrl!} alt={recent.plantName} fill sizes="144px" className="object-cover" unoptimized />
                ) : (
                  <span className="grid h-full place-items-center text-[#52751c]"><Sprout size={30} aria-hidden="true" /></span>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-stone-600">
                  {formatDate(recent.observedAt)}
                </span>
              </div>
              <span className="block truncate px-3 pb-1 pt-3 text-base font-black text-stone-900">{recent.plantName}</span>
              <span className="block truncate px-3 pb-3 text-xs font-medium text-stone-500">{recent.plantCategory}</span>
            </button>
            ))}
          </div>
          {featuredPhotoUrl ? (
            <button type="button" onClick={() => onSelect(items[0].plant)} className="relative mt-3 block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-[#dfe9ce] text-left shadow-lg shadow-stone-950/10">
              <Image src={featuredPhotoUrl} alt={items[0].recent.plantName} fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" unoptimized />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white/70">최근 관찰</span>
                  <span className="mt-1 block truncate text-xl font-black">{items[0].recent.plantName}</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-stone-950"><ArrowRight size={18} aria-hidden="true" /></span>
              </span>
            </button>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#cdddb4] bg-white/70 px-4 py-6 text-center text-sm text-stone-500">
          최근 관찰한 식물이 아직 없어요.
        </div>
      )}
    </section>
  );
}
