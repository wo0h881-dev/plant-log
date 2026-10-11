"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Droplets, ExternalLink, Heart, History, Layers3, RefreshCcw, Sprout } from "lucide-react";
import type { Plant, PlantObservationSummary, PlantPhotoSummary } from "@/types/plant";
import { PlantPhotoGallery } from "@/components/PlantPhotoGallery";
import type { WateringStats } from "@/lib/watering";

type DetailsResponse = {
  observations?: PlantObservationSummary[];
  photos?: PlantPhotoSummary[];
  message?: string;
};

function formatDate(dateValue?: string, short = false) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", short ? { month: "numeric", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function PlantOverview({ plant }: { plant: Plant }) {
  const [observations, setObservations] = useState<PlantObservationSummary[]>([]);
  const [photos, setPhotos] = useState<PlantPhotoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [stats, setStats] = useState<WateringStats | null>(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ plantId: plant.id, plantName: plant.name });
    fetch(`/api/plant-details?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as DetailsResponse;
        if (!response.ok) throw new Error(payload.message ?? "최근 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => { setObservations(payload.observations ?? []); setPhotos(payload.photos ?? []); })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "최근 기록을 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [plant.id, plant.name]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/watering-stats?plantId=${encodeURIComponent(plant.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "물주기 기록을 불러오지 못했습니다.");
        setStats(payload as WateringStats);
      })
      .catch((reason) => { if (!controller.signal.aborted) setStatsError(reason instanceof Error ? reason.message : "물주기 기록을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [plant.id]);

  const heroPhotos = photos.length ? photos : plant.coverPhotoUrl ? [{ id: `${plant.id}-cover`, name: plant.name, url: plant.coverPhotoUrl }] : [];

  return (
    <div className="space-y-5">
      <section className="relative min-h-[265px] overflow-hidden rounded-[30px] bg-[#DCE7D5]">
        {heroPhotos.length ? (
          <Image src={heroPhotos[0].url} alt={plant.name} fill sizes="(max-width: 390px) 100vw, 390px" className="object-cover object-center" unoptimized />
        ) : <span className="absolute inset-0 grid place-items-center text-[#284F2A]"><Sprout size={72} strokeWidth={1} aria-hidden="true" /></span>}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
        <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#151515] text-white" aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" /></button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black">{plant.name}</h2>
            <p className="mt-0.5 truncate text-xs font-semibold text-white/75">{plant.scientificName ?? plant.category}</p>
            <p className="mt-2 line-clamp-1 text-[11px] text-white/85">{plant.description ?? (plant.isWateringDue ? "오늘 물줄 차례예요." : "최근 기록과 관리 정보를 확인해보세요.")}</p>
          </div>
          <button type="button" onClick={() => setGalleryOpen(true)} aria-label="식물 사진 크게 보기" className="pointer-events-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#151515]"><ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[17px] font-black text-[#151515]">최근 사진</h2><span className="text-xs font-semibold text-[#909090]">{photos.length}개</span></div>
        <button type="button" onClick={() => setGalleryOpen(true)} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#284F2A]">사진 크게 보기<ArrowRight size={17} aria-hidden="true" /></button>
      </section>

      <section className="grid grid-cols-3 divide-x divide-[#E8E9E5] rounded-2xl bg-white px-1 py-3">
        <div className="min-w-0 px-2 text-center"><Droplets size={15} className="mx-auto text-[#47794B]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">최근 물</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#151515]">{stats ? formatDate(stats.lastWateredAt, true) : "확인 중"}</p></div>
        <div className="min-w-0 px-2 text-center"><RefreshCcw size={15} className="mx-auto text-[#82734C]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">분갈이</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#151515]">{formatDate(plant.lastRepottedAt, true)}</p></div>
        <div className="min-w-0 px-2 text-center"><Layers3 size={15} className="mx-auto text-[#776A66]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">현재 흙</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#151515]">{plant.currentSoils?.join(" + ") || "기록 없음"}</p></div>
      </section>

      <section className="space-y-3 rounded-[22px] bg-white p-4">
        <h2 className="text-[15px] font-black">실제 물주기</h2>
        {statsError ? <p role="status" className="text-xs text-red-700">{statsError}</p> : !stats ? <p className="text-xs text-[#909090]">기록을 확인하고 있어요.</p> : <>
          <dl className="space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-[#909090]">마지막 물주기</dt><dd className="text-right font-bold">{formatDate(stats.lastWateredAt, true)}{stats.daysSinceWatered !== undefined ? ` · ${stats.daysSinceWatered}일 전` : ""}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#909090]">최근 평균 ({stats.recentIntervals}회 간격)</dt><dd className="font-bold">{stats.recentAverageDays !== undefined ? `${stats.recentAverageDays}일` : "기록 부족"}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#909090]">전체 평균 ({stats.wateringDays}일 기록)</dt><dd className="font-bold">{stats.averageDays !== undefined ? `${stats.averageDays}일` : "기록 부족"}</dd></div></dl>
          {stats.wateringDays < 2 ? <p className="text-[11px] text-[#909090]">서로 다른 날짜의 물주기 기록이 2번 이상 필요해요.</p> : null}
        </>}
      </section>

      <section className="rounded-[22px] bg-white p-4">
        <div className="flex items-center gap-2"><History size={17} className="text-[#284F2A]" aria-hidden="true" /><h2 className="text-[15px] font-black text-[#151515]">최근 관찰</h2></div>
        {isLoading ? <p className="py-6 text-center text-sm text-[#909090]">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-[#909090]">아직 관찰 기록이 없어요.</p> : null}
        {observations.length ? <div className="mt-3 divide-y divide-[#EEEFEA]">{observations.map((observation) => <article key={observation.id} className="py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-3"><time className="text-xs font-semibold text-[#909090]">{formatDate(observation.date)}</time>{observation.url ? <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 place-items-center text-[#909090]"><ExternalLink size={14} aria-hidden="true" /></a> : null}</div>{observation.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{observation.tags.map((tag) => <span key={tag} className="rounded-full bg-[#EEF3EB] px-2 py-1 text-[11px] font-semibold text-[#284F2A]">{tag}</span>)}</div> : null}{observation.note ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#555954]">{observation.note}</p> : null}</article>)}</div> : null}
      </section>
      {galleryOpen ? <PlantPhotoGallery plantId={plant.id} plantName={plant.name} photos={heroPhotos} onClose={() => setGalleryOpen(false)} /> : null}
    </div>
  );
}
