"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PlantPhotoSummary } from "@/types/plant";

export function PlantPhotoGallery({ plantId, plantName, photos, onClose }: {
  plantId: string; plantName: string; photos: PlantPhotoSummary[]; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const [bodyPhotos, setBodyPhotos] = useState<PlantPhotoSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const items = [...new Map([...photos, ...bodyPhotos].map((photo) => [photo.url.split("?")[0], photo])).values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const photo = items[index];
  const move = (amount: number) => setIndex((current) => Math.max(0, Math.min(items.length - 1, current + amount)));

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/plant-photos?plantId=${encodeURIComponent(plantId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "본문 사진을 불러오지 못했습니다.");
        setBodyPhotos(payload.photos ?? []);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "사진을 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [plantId]);

  return <dialog ref={dialog} onCancel={onClose} aria-label={`${plantName} 사진 크게 보기`} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }} className="fixed inset-0 m-auto h-dvh max-h-dvh w-screen max-w-none border-0 bg-[#151515] p-0 text-white backdrop:bg-black/80">
    <div className="flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex shrink-0 items-center justify-between gap-3"><h2 className="truncate text-base font-bold">{plantName}</h2><button type="button" onClick={onClose} aria-label="사진 닫기" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10"><X size={22} /></button></header>
      <div className="relative my-3 min-h-0 flex-1 touch-pan-y" onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }} onTouchEnd={(event) => { const start = touchX.current; touchX.current = null; if (start !== null && Math.abs(event.changedTouches[0].clientX - start) > 40) move(event.changedTouches[0].clientX < start ? 1 : -1); }}>
        {photo ? <Image key={photo.url} src={photo.url} alt={`${plantName} 사진 ${index + 1}`} fill sizes="100vw" unoptimized className="object-contain" onError={() => setError("사진 주소가 만료됐거나 사진을 불러오지 못했어요. 닫은 후 다시 시도해주세요.")} /> : <p className="grid h-full place-items-center text-sm text-white/60">{loading ? "사진을 불러오는 중..." : "등록된 사진이 없어요."}</p>}
      </div>
      {error ? <p role="status" className="mb-2 text-center text-xs text-white/70">{error}</p> : null}
      <footer className="flex shrink-0 items-center justify-center gap-6"><button type="button" aria-label="이전 사진" disabled={index === 0} onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronLeft size={24} /></button><span className="min-w-16 text-center text-sm" aria-live="polite">{items.length ? `${index + 1} / ${items.length}` : "0 / 0"}</span><button type="button" aria-label="다음 사진" disabled={index >= items.length - 1} onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronRight size={24} /></button></footer>
    </div>
  </dialog>;
}
