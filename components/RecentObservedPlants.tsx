"use client";

import Image from "next/image";
import { Clock3, Sprout } from "lucide-react";
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

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-stone-900">최근 관찰한 식물</h2>
          <p className="mt-0.5 text-xs text-stone-500">카드를 누르면 식물 기록을 볼 수 있어요.</p>
        </div>
        <Clock3 size={19} className="text-[#52751c]" aria-hidden="true" />
      </div>

      {items.length ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {items.map(({ recent, plant }) => (
            <button
              key={`${recent.plantId}-${recent.plantName}`}
              type="button"
              onClick={() => onSelect(plant)}
              className="w-36 shrink-0 snap-start overflow-hidden rounded-lg border border-[#dce9c8] bg-white text-left shadow-sm shadow-[#456615]/10"
            >
              <div className="relative aspect-[4/5] bg-[#e5edcf]">
                {recent.photoUrl ? (
                  <Image src={recent.photoUrl} alt={recent.plantName} fill sizes="144px" className="object-cover" unoptimized />
                ) : (
                  <span className="grid h-full place-items-center text-[#52751c]"><Sprout size={30} aria-hidden="true" /></span>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-stone-600">
                  {formatDate(recent.observedAt)}
                </span>
              </div>
              <span className="block truncate px-3 pb-1 pt-2.5 text-sm font-bold text-stone-900">{recent.plantName}</span>
              <span className="block truncate px-3 pb-3 text-[11px] text-stone-500">{recent.plantCategory}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#cdddb4] bg-white/70 px-4 py-6 text-center text-sm text-stone-500">
          최근 관찰한 식물이 아직 없어요.
        </div>
      )}
    </section>
  );
}
