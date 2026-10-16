"use client";

import { ArrowRight, ChevronRight, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import type { Plant, PlantPhotoSummary, RecentObservedPlant } from "@/types/plant";
import { PlantPhotoCarousel } from "@/components/PlantPhotoCarousel";
import { plantCarouselPhotos } from "@/lib/plant-photos";

type RecentObservedPlantsProps = {
  plants: Plant[];
  recentPlants: RecentObservedPlant[];
  onSelect: (plant: Plant, openPhotos?: boolean, photoId?: string) => void;
};

function formatDate(dateValue?: string) {
  if (!dateValue) return "최근 기록";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function RecentObservedPlants({ plants, recentPlants, onSelect }: RecentObservedPlantsProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [showAllPlants, setShowAllPlants] = useState(false);
  const [allRecentPlants, setAllRecentPlants] = useState<RecentObservedPlant[] | null>(null);
  const [isLoadingAllPlants, setIsLoadingAllPlants] = useState(false);
  const displayedRecentPlants = showAllPlants && allRecentPlants ? allRecentPlants : recentPlants;
  const items = displayedRecentPlants.flatMap((recent) => {
    const plant = plants.find((item) => item.id === recent.plantId)
      ?? plants.find((item) => item.name === recent.plantName && (!recent.plantCategory || item.category === recent.plantCategory));
    return plant ? [{ recent, plant }] : [];
  });
  const featured = items[0];
  const featuredId = featured?.plant.id;
  const featuredName = featured?.plant.name;
  const [featuredPhotos, setFeaturedPhotos] = useState<{ plantId: string; photos: PlantPhotoSummary[] }>();
  useEffect(() => {
    if (!featuredId) return;
    const controller = new AbortController();
    fetch(`/api/plant-details?${new URLSearchParams({ plantId: featuredId, plantName: featuredName ?? "" })}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("사진 조회 실패"); return response.json(); })
      .then((payload) => { if (!controller.signal.aborted) setFeaturedPhotos({ plantId: featuredId, photos: payload.photos ?? [] }); })
      .catch(() => { if (!controller.signal.aborted) setFeaturedPhotos({ plantId: featuredId, photos: [] }); });
    return () => controller.abort();
  }, [featuredId, featuredName]);
  const previewItems = items.slice(0, 8);

  function toggleAllPlants() {
    if (showAllPlants) {
      setShowAllPlants(false);
      return;
    }

    setShowAllPlants(true);
    if (allRecentPlants || isLoadingAllPlants) return;

    setIsLoadingAllPlants(true);
    fetch("/api/plant-details?all=true")
      .then(async (response) => {
        const payload = (await response.json()) as { recentPlants?: RecentObservedPlant[] };
        if (!response.ok) throw new Error("최근 관찰 식물을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => setAllRecentPlants(payload.recentPlants ?? recentPlants))
      .catch(() => setAllRecentPlants(recentPlants))
      .finally(() => setIsLoadingAllPlants(false));
  }

  return (
    <section className="space-y-7">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">최근 관찰한 식물</h2>
          <button type="button" onClick={toggleAllPlants} className="flex min-h-10 items-center gap-1 px-1 text-xs font-medium text-[#8B929B]">
            {showAllPlants ? "최근보기" : "전체보기"}<ChevronRight size={13} className={showAllPlants ? "rotate-180" : ""} aria-hidden="true" />
          </button>
        </div>
        {showAllPlants && isLoadingAllPlants ? (
          <div className="grid grid-cols-2 gap-3" aria-label="최근 관찰 식물 불러오는 중">
            {Array.from({ length: 4 }, (_, index) => <span key={index} className="h-20 animate-pulse rounded-lg bg-[#F5F6F8]" />)}
          </div>
        ) : showAllPlants ? (
          <div className="grid grid-cols-2 gap-3">
            {items.map(({ recent, plant }) => {
              return (
                <button key={plant.id} type="button" onClick={() => onSelect(plant)} className="recent-plant">
                  <span className="block">
                    <span className="mb-2 block text-[10px] text-[#8B929B]">{plant.category}</span>
                    <span className="block break-words text-[13px] font-semibold">{plant.name}</span>
                    <span className="mt-2 block truncate text-[10px] text-[#909090]">{formatDate(recent.observedAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : items.length ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {previewItems.map(({ recent, plant }) => {
              return (
                <button key={plant.id} type="button" onClick={() => onSelect(plant)} className="recent-plant w-36 shrink-0">
                  <span className="mb-2 block truncate text-[10px] text-[#8B929B]">{plant.category}</span>
                  <span className="block truncate text-xs font-semibold">{plant.name}</span>
                  <span className="mt-2 block text-[10px] text-[#909090]">{formatDate(recent.observedAt)}</span>
                </button>
              );
            })}
          </div>
        ) : <div className="rounded-3xl bg-white px-4 py-6 text-center text-sm text-[#909090]">최근 관찰한 식물이 아직 없어요.</div>}
      </div>

      {!showAllPlants && featured ? (
        <div>
          <PlantPhotoCarousel key={`${featured.plant.id}:${featured.plant.coverPhotoUrl}`} photos={plantCarouselPhotos(featured.plant.id, featured.plant.name, featured.plant.coverPhotoUrl, featuredPhotos?.plantId === featured.plant.id ? featuredPhotos.photos : [])} loading={featuredPhotos?.plantId !== featured.plant.id} onOpen={(photo) => onSelect(featured.plant, true, photo.id === `${featured.plant.id}-cover` ? undefined : photo.id)} controls={
            <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]" title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"} aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" /></button>
          } />
          <button type="button" onClick={() => onSelect(featured.plant)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
            <span className="min-w-0">
              <span className="mb-1 block truncate text-[11px] text-[#8B929B]">{featured.plant.scientificName ?? featured.plant.category}</span>
              <span className="block break-words text-xl font-bold">{featured.plant.name}</span>
              {featured.plant.description ? <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[#8B929B]">{featured.plant.description}</span> : null}
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#ECEEF1] text-[#191F28]"><ArrowRight size={18} aria-hidden="true" /></span>
          </button>
        </div>
      ) : null}

    </section>
  );
}
