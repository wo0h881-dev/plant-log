"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type RecentObservation = { id: string; createdAt: string; note: string; photoCount: number };

export function ObservationSaveChoice({ recent, plantName, busy, error, onChoose, onClose }: { recent: RecentObservation; plantName: string; busy: boolean; error: string; onChoose: (append: boolean) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="observation-choice-title" className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-[400px] overflow-y-auto rounded-lg border-0 bg-white p-5 text-[#191F28] backdrop:bg-black/40">
    <header className="flex items-center justify-between gap-3"><h2 id="observation-choice-title" className="text-lg font-bold">방금 쓴 일지가 있어요</h2><button type="button" onClick={onClose} disabled={busy} aria-label="저장 선택 닫기" title="닫기" className="icon-button"><X size={20} /></button></header>
    <p className="mt-3 break-words text-sm font-semibold">{plantName}</p>
    <p className="mt-1 text-xs text-[#8B929B]">{new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "numeric" }).format(new Date(recent.createdAt))} 작성 · 사진 {recent.photoCount}장</p>
    {recent.note ? <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-lg bg-[#F5F6F8] p-3 text-sm leading-6">{recent.note}</p> : null}
    {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
    <button type="button" onClick={() => onChoose(true)} disabled={busy} className="primary-button mt-5">{busy ? "저장 중..." : "기존 일지에 추가"}</button>
    <button type="button" onClick={() => onChoose(false)} disabled={busy} className="mt-3 min-h-12 w-full rounded-lg bg-[#F5F6F8] text-sm font-semibold disabled:opacity-40">새 일지로 저장</button>
  </dialog>;
}
