"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import type { PlantPhotoSummary } from "@/types/plant";

export function PlantPhotoCarousel({ photos, loading = false, onOpen, controls, caption, controlsInside = false }: { photos: PlantPhotoSummary[]; loading?: boolean; onOpen: (photo: PlantPhotoSummary) => void; controls?: ReactNode; caption?: ReactNode; controlsInside?: boolean }) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, photos.length - 1));
  const firstDot = controlsInside ? Math.max(0, Math.min(current - 2, photos.length - 5)) : 0;
  const dotPositions = Array.from({ length: controlsInside ? Math.min(5, photos.length) : photos.length }, (_, position) => firstDot + position);
  function move(next: number) {
    const element = track;
    if (!element) return;
    const position = Math.max(0, Math.min(photos.length - 1, next));
    element.scrollTo({ left: position * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  const pagination = photos.length > 1 ? <div className={`carousel-controls${controlsInside ? " carousel-controls-inside" : ""}`}>
    <button type="button" onClick={() => move(current - 1)} disabled={current === 0} aria-label="이전 캐러셀 사진" title="이전 사진" className="icon-button disabled:opacity-25"><ChevronLeft size={18} /></button>
    <div className="carousel-dots">{controlsInside || photos.length <= 7 ? dotPositions.map((position) => <button key={photos[position].id} type="button" onClick={() => move(position)} aria-label={`${position + 1}번째 사진으로 이동`} aria-current={position === current ? "true" : undefined}><span className={position === current ? "is-current" : ""} /></button>) : <span className="text-xs text-[#8B929B]">{current + 1} / {photos.length}</span>}</div>
    <button type="button" onClick={() => move(current + 1)} disabled={current >= photos.length - 1} aria-label="다음 캐러셀 사진" title="다음 사진" className="icon-button disabled:opacity-25"><ChevronRight size={18} /></button>
  </div> : null;

  return <section aria-roledescription="carousel" aria-label="식물 사진" onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(current + (event.key === "ArrowLeft" ? -1 : 1)); } }} className={`min-w-0${controlsInside ? " carousel-contained" : ""}`}>
    <div className="detail-photo">
      {photos.length ? <div ref={setTrack} onScroll={(event) => { const element = event.currentTarget; if (element.clientWidth) setIndex(Math.round(element.scrollLeft / element.clientWidth)); }} className="carousel-track absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {photos.map((photo, position) => <div key={photo.id} role="group" aria-label={`사진 ${position + 1}`} aria-hidden={position !== current} aria-roledescription="slide" className="relative h-full w-full shrink-0 snap-center">
          <button type="button" tabIndex={position === current ? 0 : -1} onClick={() => onOpen(photo)} aria-label={position === current ? "최근 사진 보기" : `사진 ${position + 1} 크게 보기`} className="absolute inset-0">{Math.abs(position - current) <= 1 ? <PlantPhoto key={photo.url} src={photo.url} alt={photo.name} priority={position === 0} /> : null}</button>
        </div>)}
      </div> : loading ? <span role="status" aria-label="사진 불러오는 중" className="photo-skeleton"><span className="photo-skeleton-shine" /></span> : <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-xs text-[#A0A8B3]"><ImageOff size={30} strokeWidth={1.5} aria-hidden="true" />등록된 사진이 없어요</span>}
      {controls}
      {caption}
      {photos.length ? <span className={`carousel-counter pointer-events-none absolute right-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white ${controlsInside && photos.length > 1 ? "bottom-12" : "bottom-3"}`} aria-live="polite">{loading ? "사진 확인 중" : `${current + 1} / ${photos.length}`}</span> : null}
      {controlsInside ? pagination : null}
    </div>
    {!controlsInside ? pagination : null}
  </section>;
}
