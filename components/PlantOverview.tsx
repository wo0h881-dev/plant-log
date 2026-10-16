"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, ExternalLink, Heart, History, Sprout } from "lucide-react";
import type { Plant, PlantObservationSummary, PlantPhotoSummary } from "@/types/plant";
import { PlantPhotoGallery } from "@/components/PlantPhotoGallery";
import { PlantNameEditor } from "@/components/PlantNameEditor";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { PlantCoverEditor } from "@/components/PlantCoverEditor";
import { PlantWateringCycleEditor } from "@/components/PlantWateringCycleEditor";

type DetailsResponse = {
  observations?: PlantObservationSummary[];
  photos?: PlantPhotoSummary[];
  message?: string;
};

function formatDate(dateValue?: string, short = false) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", short ? { month: "numeric", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function PlantOverview({ plant, onPlantRenamed, initialGalleryOpen = false }: { plant: Plant; onPlantRenamed: (plant: Plant) => void; initialGalleryOpen?: boolean }) {
  const [observations, setObservations] = useState<PlantObservationSummary[]>([]);
  const [photos, setPhotos] = useState<PlantPhotoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(initialGalleryOpen);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);

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

  return (
    <div className="space-y-5">
      <section>
        <div className="detail-photo">
        <button type="button" onClick={() => setGalleryOpen(true)} aria-label="최근 사진 보기" className="absolute inset-0">
          {plant.coverPhotoUrl ? <Image src={plant.coverPhotoUrl} alt={plant.name} fill sizes="(max-width: 440px) 100vw, 440px" className="object-cover object-center" unoptimized /> : <span className="absolute inset-0 grid place-items-center text-[#A7B4A6]"><Sprout size={56} strokeWidth={1} aria-hidden="true" /></span>}
        </button>
        <button type="button" onClick={() => setCoverEditorOpen(true)} aria-label="커버사진 변경" title="커버사진 변경" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]"><Camera size={17} /></button>
        <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]" title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"} aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" /></button>
        <button type="button" onClick={() => setGalleryOpen(true)} aria-label="식물 사진 크게 보기" title="식물 사진 크게 보기" className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]"><ArrowRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="detail-identity">
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] text-[#8B929B]">{plant.scientificName ?? plant.category}</p>
            <h2 className="break-words text-[23px] font-bold">{plant.name}</h2>
            {plant.description ? <p className="mt-2 text-xs leading-5 text-[#8B929B]">{plant.description}</p> : null}
            {plant.isWateringDue ? <span className="mt-3 inline-flex items-center rounded-md bg-[#EFF3FC] px-2 py-1 text-[11px] font-medium text-[#4869D8]">물주기 확인이 필요해요</span> : null}
          </div>
        </div>
      </section>

      <PlantCareSummary key={plant.id} plant={plant} />

      <PlantNameEditor plant={plant} onSaved={onPlantRenamed} />
      <PlantWateringCycleEditor plant={plant} onSaved={onPlantRenamed} />

      <section className="section-divider">
        <div className="flex items-center gap-2"><History size={17} className="text-[#8B929B]" aria-hidden="true" /><h2 className="section-title">최근 관찰</h2></div>
        {isLoading ? <p className="py-6 text-center text-sm text-[#909090]">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-[#909090]">아직 관찰 기록이 없어요.</p> : null}
        {observations.length ? <div className="mt-3 divide-y divide-[#EEEFEA]">{observations.map((observation) => <article key={observation.id} className="py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-3"><time className="text-xs font-semibold text-[#909090]">{formatDate(observation.date)}</time>{observation.url ? <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 place-items-center text-[#909090]"><ExternalLink size={14} aria-hidden="true" /></a> : null}</div>{observation.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{observation.tags.map((tag) => <span key={tag} className="rounded-full bg-[#EEF3EB] px-2 py-1 text-[11px] font-semibold text-[#284F2A]">{tag}</span>)}</div> : null}{observation.note ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#555954]">{observation.note}</p> : null}</article>)}</div> : null}
      </section>
      {galleryOpen ? <PlantPhotoGallery plantId={plant.id} plantName={plant.name} photos={photos} onClose={() => setGalleryOpen(false)} /> : null}
      {coverEditorOpen ? <PlantCoverEditor plant={plant} onSaved={onPlantRenamed} onClose={() => setCoverEditorOpen(false)} /> : null}
    </div>
  );
}
