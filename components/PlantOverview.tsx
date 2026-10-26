"use client";

import { useEffect, useState } from "react";
import { Camera, ExternalLink, Heart, History } from "lucide-react";
import type { Plant, PlantObservationSummary, PlantPhotoSummary } from "@/types/plant";
import { PlantPhotoGallery } from "@/components/PlantPhotoGallery";
import { PlantNameEditor } from "@/components/PlantNameEditor";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { PlantCoverEditor } from "@/components/PlantCoverEditor";
import { PlantWateringCycleEditor } from "@/components/PlantWateringCycleEditor";
import { PlantCategoryEditor } from "@/components/PlantCategoryEditor";
import { PlantPhotoCarousel } from "@/components/PlantPhotoCarousel";
import { plantCarouselPhotos } from "@/lib/plant-photos";

type DetailsResponse = {
  observations?: PlantObservationSummary[];
  photos?: PlantPhotoSummary[];
  message?: string;
};

function formatDate(dateValue?: string, short = false) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", short ? { month: "numeric", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${dateValue.slice(0, 10)}T12:00:00`));
}

export function PlantOverview({ plant, categories, onOpenCalendar, onPlantRenamed, initialGalleryOpen = false, initialGalleryPhotoId }: { plant: Plant; categories: string[]; onOpenCalendar: (plant: Plant) => void; onPlantRenamed: (plant: Plant) => void; initialGalleryOpen?: boolean; initialGalleryPhotoId?: string }) {
  const [observations, setObservations] = useState<PlantObservationSummary[]>([]);
  const [photos, setPhotos] = useState<PlantPhotoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(initialGalleryOpen);
  const [galleryPhotoId, setGalleryPhotoId] = useState(initialGalleryPhotoId);
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
    <div className="plant-editorial space-y-5">
      <section className="editorial-cover">
        <div className="editorial-kicker"><span>나의 식물 기록</span><span>{plant.category}</span></div>
        <PlantPhotoCarousel key={plant.coverPhotoUrl ?? plant.id} photos={plantCarouselPhotos(plant.id, plant.name, plant.coverPhotoUrl, photos)} loading={isLoading} onOpen={(photo) => { setGalleryPhotoId(photo.id === `${plant.id}-cover` ? undefined : photo.id); setGalleryOpen(true); }} controls={<>
        <button type="button" onClick={() => setCoverEditorOpen(true)} aria-label="커버사진 변경" title="커버사진 변경" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]"><Camera size={17} /></button>
        <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]" title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"} aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" /></button>
        </>} />
        <div className="detail-identity">
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] text-[#8B929B]">{plant.scientificName ?? plant.category}</p>
            <h2 className="editorial-title">{plant.name}</h2>
            {plant.description ? <p className="mt-2 text-xs leading-5 text-[#8B929B]">{plant.description}</p> : null}
            {plant.isWateringDue ? <span className="mt-3 inline-flex items-center rounded-md bg-[#EEF2FF] px-2 py-1 text-[11px] font-medium text-[#4263EB]">물주기 확인이 필요해요</span> : null}
          </div>
        </div>
      </section>

      <PlantCareSummary key={plant.id} plant={plant} onOpenCalendar={onOpenCalendar} />

      <section className="editorial-settings" aria-label="식물 정보 수정">
        <h2 className="section-title mb-4">식물 프로필</h2>
        <PlantNameEditor plant={plant} onSaved={onPlantRenamed} />
        <PlantCategoryEditor plant={plant} categories={categories} onSaved={onPlantRenamed} />
        <PlantWateringCycleEditor plant={plant} onSaved={onPlantRenamed} />
      </section>

      <section className="section-divider">
        <div className="flex items-center gap-2"><History size={17} className="text-[#8B929B]" aria-hidden="true" /><h2 className="section-title">최근 관찰</h2></div>
        {isLoading ? <p className="py-6 text-center text-sm text-[#909090]">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-[#909090]">아직 관찰 기록이 없어요.</p> : null}
        {observations.length ? <div className="editorial-journal mt-3">{observations.map((observation, index) => <article key={observation.id} className="editorial-entry"><span className="editorial-entry-number" aria-hidden="true">{String(observations.length - index).padStart(2, "0")}</span><div className="min-w-0"><div className="flex items-center justify-between gap-3"><time className="text-xs font-semibold text-[#909090]">{formatDate(observation.date)}</time>{observation.url ? <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 place-items-center text-[#909090]"><ExternalLink size={14} aria-hidden="true" /></a> : null}</div>{observation.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{observation.tags.map((tag) => <span key={tag} className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4263EB]">{tag}</span>)}</div> : null}{observation.note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#555954]">{observation.note}</p> : null}</div></article>)}</div> : null}
      </section>
      {galleryOpen ? <PlantPhotoGallery plantId={plant.id} plantName={plant.name} photos={photos} photosLoading={isLoading} initialPhotoId={galleryPhotoId} onClose={() => setGalleryOpen(false)} /> : null}
      {coverEditorOpen ? <PlantCoverEditor plant={plant} onSaved={onPlantRenamed} onClose={() => setCoverEditorOpen(false)} /> : null}
    </div>
  );
}
