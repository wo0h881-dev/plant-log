"use client";

import { useEffect, useState } from "react";
import { Camera, ExternalLink, Heart, History, MoreHorizontal, Pencil, Droplets, Tags } from "lucide-react";
import type { Plant, PlantObservationSummary, PlantPhotoSummary } from "@/types/plant";
import { PlantPhotoGallery } from "@/components/PlantPhotoGallery";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { PlantCoverEditor } from "@/components/PlantCoverEditor";
import { PlantProfileEditor, type ProfileField } from "@/components/PlantProfileEditor";
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
  const [editingField, setEditingField] = useState<ProfileField | null>(null);

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
      <section className="plant-profile-panel" aria-label={`${plant.name} 프로필`}>
      <section className="editorial-cover">
        <div className="editorial-kicker"><span>나의 식물 기록</span><span>{plant.category}</span></div>
        <PlantPhotoCarousel controlsInside key={plant.coverPhotoUrl ?? plant.id} photos={plantCarouselPhotos(plant.id, plant.name, plant.coverPhotoUrl, photos)} loading={isLoading} onOpen={(photo) => { setGalleryPhotoId(photo.id === `${plant.id}-cover` ? undefined : photo.id); setGalleryOpen(true); }} controls={<>
        <button type="button" onClick={() => setCoverEditorOpen(true)} aria-label="커버사진 변경" title="커버사진 변경" className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]"><Camera size={17} /></button>
        <button type="button" onClick={() => setIsFavorite((current) => !current)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#191F28]" title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"} aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}><Heart size={17} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" /></button>
        </>} />
        <div className="detail-identity profile-card">
          <div className="profile-actions"><button type="button" popoverTarget={`profile-menu-${plant.id}`} aria-label="프로필 편집 메뉴" title="프로필 편집" className="icon-button"><MoreHorizontal size={21} /></button>
            <div popover="auto" id={`profile-menu-${plant.id}`} className="profile-popover">{([ ["name", "식물 이름 편집", Pencil], ["category", "대분류 편집", Tags], ["cycle", "관수 주기 편집", Droplets] ] as const).map(([field, label, Icon]) => <button key={field} type="button" onClick={(event) => { event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover(); setEditingField(field); }}><Icon size={17} />{label}</button>)}</div>
          </div>
          <div className="min-w-0">
            {plant.scientificName ? <p className="mb-1.5 text-[11px] text-[#8B929B]">{plant.scientificName}</p> : null}
            <h2 className="editorial-title">{plant.name}</h2>
            <div className="mt-3 space-y-2 text-xs text-[#626B76]"><p>{plant.category}</p><p>관수 주기 <strong className="font-semibold">{plant.wateringCycleDays !== undefined ? `${plant.wateringCycleDays}일` : "미설정"}</strong></p></div>
            {plant.description ? <p className="mt-2 text-xs leading-5 text-[#8B929B]">{plant.description}</p> : null}
            {plant.isWateringDue ? <span className="mt-3 inline-flex items-center rounded-md bg-[#EEF2FF] px-2 py-1 text-[11px] font-medium text-[#4263EB]">물주기 확인이 필요해요</span> : null}
          </div>
        </div>
      </section>

      <PlantCareSummary key={plant.id} plant={plant} onOpenCalendar={onOpenCalendar} vertical />
      </section>

      {editingField ? <PlantProfileEditor plant={plant} field={editingField} categories={categories} onSaved={onPlantRenamed} onClose={() => setEditingField(null)} /> : null}

      <section className="section-divider">
        <div className="flex items-center gap-2"><History size={17} className="text-[#8B929B]" aria-hidden="true" /><h2 className="section-title">최근 관찰</h2></div>
        {isLoading ? <p className="py-6 text-center text-sm text-[#909090]">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-[#909090]">아직 관찰 기록이 없어요.</p> : null}
        {observations.length ? <ol className="editorial-journal mt-5">{observations.map((observation) => (
          <li key={observation.id} className="editorial-entry">
            <span className="editorial-entry-number" aria-hidden="true" />
            <div className="min-w-0">
              <time className="mb-2 block text-xs text-[#909090]">{formatDate(observation.date)}</time>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold leading-6">{observation.tags.join(" · ") || "관찰 기록"}</h3>
                {observation.url ? <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 shrink-0 place-items-center text-[#909090]"><ExternalLink size={14} aria-hidden="true" /></a> : null}
              </div>
              {observation.note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#555954]">{observation.note}</p> : null}
            </div>
          </li>
        ))}</ol> : null}
      </section>
      {galleryOpen ? <PlantPhotoGallery plantId={plant.id} plantName={plant.name} photos={photos} photosLoading={isLoading} initialPhotoId={galleryPhotoId} onClose={() => setGalleryOpen(false)} /> : null}
      {coverEditorOpen ? <PlantCoverEditor plant={plant} onSaved={onPlantRenamed} onClose={() => setCoverEditorOpen(false)} /> : null}
    </div>
  );
}
