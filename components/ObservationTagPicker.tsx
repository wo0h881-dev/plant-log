"use client";

import { Check, ChevronDown, RefreshCcw, Thermometer, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { PlantDialog } from "@/components/PlantDialog";
const special = ["좋음", "안좋음", "분갈이", "온습도"];

export function ObservationTagPicker({ tags, selected, onToggle, children }: { tags: string[]; selected: string[]; onToggle: (tag: string) => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const statusOrder = ["신엽", "하엽", "과습", "뿌리", "상태이상", "해충"];
  const status = [...new Set([...statusOrder, ...tags])].filter((tag) => !special.includes(tag) && tag !== "분갈이 필요");
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="tag-select-trigger"><span>관찰태그{selected.length ? ` · ${selected.length}` : ""}</span><ChevronDown size={15} /></button>
    {open ? <PlantDialog title="관찰태그" onClose={() => setOpen(false)}><div className="space-y-5">
    <div role="group" aria-label="상태" className="status-chips">{status.map((name) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="status-chip">{selected.includes(name) ? <Check size={12} aria-hidden="true" /> : null}<span className="break-words">{name}</span></button>)}</div>
    <div>
      <p className="mb-2 text-xs text-[#8B929B]">전체 상태</p>
      <div role="group" aria-label="상태 평가" className="status-chips">{([['좋음', ThumbsUp], ['안좋음', ThumbsDown]] as const).map(([name, Icon]) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="status-chip"><Icon size={16} aria-hidden="true" />{name}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs text-[#8B929B]">추가 기록</p>
      <div role="group" aria-label="관리 기록" className="status-chips">{([['분갈이', RefreshCcw], ['온습도', Thermometer]] as const).map(([name, Icon]) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="status-chip"><Icon size={15} aria-hidden="true" />{name}</button>)}</div>
    </div>
    <div ref={detailsRef} className="space-y-5">{children}</div>
    {selected.length ? <p className="text-[11px] leading-5 text-[#4263EB]" aria-live="polite">{selected.join(" · ")}</p> : null}
    <button type="button" onClick={() => { for (const input of detailsRef.current?.querySelectorAll("input") ?? []) { if (!input.reportValidity()) return; } setOpen(false); }} className="primary-button">선택 완료{selected.length ? ` · ${selected.length}` : ""}</button>
  </div></PlantDialog> : null}</>;
}
