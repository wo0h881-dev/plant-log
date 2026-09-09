"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Droplets, ExternalLink, History, Layers3, RefreshCcw, Sprout } from "lucide-react";
import type { Plant, PlantObservationSummary, PlantPhotoSummary } from "@/types/plant";

type DetailsResponse = {
  observations?: PlantObservationSummary[];
  photos?: PlantPhotoSummary[];
  message?: string;
};

function formatDate(dateValue?: string, short = false) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", short
    ? { month: "numeric", day: "numeric" }
    : { year: "numeric", month: "long", day: "numeric" }
  ).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function PlantOverview({ plant }: { plant: Plant }) {
  const [observations, setObservations] = useState<PlantObservationSummary[]>([]);
  const [photos, setPhotos] = useState<PlantPhotoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ plantId: plant.id, plantName: plant.name });
    fetch(`/api/plant-details?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as DetailsResponse;
        if (!response.ok) throw new Error(payload.message ?? "최근 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        setObservations(payload.observations ?? []);
        setPhotos(payload.photos ?? []);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "최근 기록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [plant.id, plant.name]);

  const wateringStatus = plant.isWateringDue
    ? "오늘 물줄 차례예요"
    : typeof plant.daysSinceWatered === "number"
      ? `${plant.daysSinceWatered}일 전에 물을 줬어요`
      : "첫 물주기 기록을 기다리고 있어요";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg bg-[#456615] text-white shadow-lg shadow-[#36510e]/15">
        <div className="relative aspect-[4/3] bg-[#dce8bf]">
          {photos.length ? (
            <div className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative h-full w-full shrink-0 snap-center">
                  <Image src={photo.url} alt={`${plant.name} 최근 사진 ${index + 1}`} fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" unoptimized />
                  <span className="absolute right-3 top-3 rounded-full bg-stone-950/55 px-2.5 py-1 text-xs font-bold text-white">{index + 1} / {photos.length}</span>
                  {photo.date ? <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-stone-700">{formatDate(photo.date, true)}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-full place-items-center text-center text-[#456615]">
              <div>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff1a8]"><Sprout size={30} aria-hidden="true" /></span>
                <p className="mt-3 text-sm font-bold">첫 사진을 기다리고 있어요</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/70">{plant.category}</p>
            <h2 className="truncate text-xl font-bold">{plant.name}</h2>
            <p className="mt-1 text-xs text-white/80">{wateringStatus}</p>
          </div>
          {photos.length > 1 ? <span className="shrink-0 text-xs font-semibold text-white/70">옆으로 넘겨보세요</span> : null}
        </div>
      </section>

      <section className="grid grid-cols-3 divide-x divide-stone-100 rounded-lg border border-stone-200 bg-white px-1 py-3">
        <div className="min-w-0 px-2 text-center">
          <Droplets size={16} className="mx-auto text-sky-600" aria-hidden="true" />
          <p className="mt-1 text-[11px] font-semibold text-stone-500">최근 물</p>
          <p className="mt-0.5 truncate text-xs font-bold text-stone-900">{formatDate(plant.lastWateredAt, true)}</p>
          <p className="mt-0.5 text-[10px] text-stone-500">주기 {plant.wateringCycleDays ? `${plant.wateringCycleDays}일` : "없음"}</p>
        </div>
        <div className="min-w-0 px-2 text-center">
          <RefreshCcw size={16} className="mx-auto text-amber-600" aria-hidden="true" />
          <p className="mt-1 text-[11px] font-semibold text-stone-500">분갈이</p>
          <p className="mt-0.5 truncate text-xs font-bold text-stone-900">{formatDate(plant.lastRepottedAt, true)}</p>
        </div>
        <div className="min-w-0 px-2 text-center">
          <Layers3 size={16} className="mx-auto text-rose-500" aria-hidden="true" />
          <p className="mt-1 text-[11px] font-semibold text-stone-500">현재 흙</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-bold text-stone-900">{plant.currentSoils?.join(" + ") || "기록 없음"}</p>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-[#52751c]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-stone-900">최근 관찰</h2>
        </div>

        {isLoading ? <p className="py-6 text-center text-sm text-stone-500">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-stone-500">아직 관찰 기록이 없어요.</p> : null}

        {observations.length ? (
          <div className="mt-3 divide-y divide-stone-100">
            {observations.map((observation) => (
              <article key={observation.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <time className="text-xs font-semibold text-stone-500">{formatDate(observation.date)}</time>
                  {observation.url ? (
                    <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 place-items-center text-stone-400">
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                {observation.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {observation.tags.map((tag) => <span key={tag} className="rounded-full bg-[#edf5df] px-2 py-1 text-[11px] font-semibold text-[#456615]">{tag}</span>)}
                  </div>
                ) : null}
                {observation.note ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-700">{observation.note}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
