"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { PlantPhoto } from "@/components/PlantPhoto";
import type { PlantPhotoSummary } from "@/types/plant";

export function PlantPhotoCarousel({ photos, loading = false, onOpen, controls }: { photos: PlantPhotoSummary[]; loading?: boolean; onOpen: (photo: PlantPhotoSummary) => void; controls?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, photos.length - 1));
  function move(next: number) {
    const element = track.current;
    if (!element) return;
    const position = Math.max(0, Math.min(photos.length - 1, next));
    element.scrollTo({ left: position * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  return <section aria-roledescription="carousel" aria-label="식물 사진" onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(current + (event.key === "ArrowLeft" ? -1 : 1)); } }} className="min-w-0">
    <div className="detail-photo">
      {photos.length ? <div ref={track} onScroll={(event) => { const element = event.currentTarget; if (element.clientWidth) setIndex(Math.round(element.scrollLeft / element.clientWidth)); }} className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
        {photos.map((photo, position) => <div key={photo.id} role="group" aria-label={`사진 ${position + 1}`} aria-hidden={position !== current} aria-roledescription="slide" className="relative h-full w-full shrink-0 snap-center">
          <button type="button" tabIndex={position === current ? 0 : -1} onClick={() => onOpen(photo)} aria-label={position === current ? "최근 사진 보기" : `사진 ${position + 1} 크게 보기`} className="absolute inset-0">{Math.abs(position - current) <= 1 ? <PlantPhoto key={photo.url} src={photo.url} alt={photo.name} priority={position === 0} /> : null}</button>
        </div>)}
      </div> : loading ? <span role="status" aria-label="사진 불러오는 중" className="photo-skeleton"><span className="photo-skeleton-shine" /></span> : <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 text-xs text-[#A0A8B3]"><ImageOff size={30} strokeWidth={1.5} aria-hidden="true" />등록된 사진이 없어요</span>}
      {controls}
      {photos.length ? <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white" aria-live="polite">{loading ? "사진 확인 중" : `${current + 1} / ${photos.length}`}</span> : null}
    </div>
    {photos.length > 1 ? <div className="mt-2 flex h-9 items-center justify-between">
      <button type="button" onClick={() => move(current - 1)} disabled={current === 0} aria-label="이전 캐러셀 사진" title="이전 사진" className="icon-button disabled:opacity-25"><ChevronLeft size={18} /></button>
      <div className="flex items-center gap-1.5">{photos.length <= 7 ? photos.map((photo, position) => <button key={photo.id} type="button" onClick={() => move(position)} aria-label={`${position + 1}번째 사진으로 이동`} aria-current={position === current ? "true" : undefined} className="grid h-8 w-6 place-items-center"><span className={`h-1.5 rounded-full ${position === current ? "w-4 bg-[#4263EB]" : "w-1.5 bg-[#DCE1EB]"}`} /></button>) : <span className="text-xs text-[#8B929B]">{current + 1} / {photos.length}</span>}</div>
      <button type="button" onClick={() => move(current + 1)} disabled={current >= photos.length - 1} aria-label="다음 캐러셀 사진" title="다음 사진" className="icon-button disabled:opacity-25"><ChevronRight size={18} /></button>
    </div> : null}
  </section>;
}
