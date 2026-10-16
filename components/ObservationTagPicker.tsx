"use client";

import { Check, ChevronDown, RefreshCcw, Thermometer, ThumbsDown, ThumbsUp } from "lucide-react";
const special = ["좋음", "안좋음", "분갈이", "온습도"];

export function ObservationTagPicker({ tags, selected, onToggle }: { tags: string[]; selected: string[]; onToggle: (tag: string) => void }) {
  const statusOrder = ["신엽", "하엽", "과습", "뿌리", "상태이상", "해충"];
  const status = [...new Set([...statusOrder, ...tags])].filter((tag) => !special.includes(tag) && tag !== "분갈이 필요");
  return <div className="space-y-5">
    <div role="group" aria-label="상태" className="status-chips">{status.map((name) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="status-chip">{selected.includes(name) ? <Check size={12} aria-hidden="true" /> : null}<span className="break-words">{name}</span></button>)}</div>
    <div>
      <p className="mb-2 text-xs text-[#8B929B]">전체 상태</p>
      <div role="group" aria-label="상태 평가" className="grid grid-cols-2 gap-1 rounded-lg bg-[#F5F6F8] p-1">{([['좋음', ThumbsUp], ['안좋음', ThumbsDown]] as const).map(([name, Icon]) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="evaluation-button"><Icon size={16} aria-hidden="true" />{name}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs text-[#8B929B]">추가 기록</p>
      <div role="group" aria-label="관리 기록" className="grid grid-cols-2 gap-2">{([['분갈이', RefreshCcw], ['온습도', Thermometer]] as const).map(([name, Icon]) => <button key={name} type="button" aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className="tag-button justify-between px-3"><span className="flex items-center gap-2"><Icon size={15} aria-hidden="true" />{name}</span><ChevronDown size={13} className={selected.includes(name) ? "rotate-180" : ""} aria-hidden="true" /></button>)}</div>
    </div>
    {selected.length ? <p className="text-[11px] leading-5 text-[#4263EB]" aria-live="polite">{selected.join(" · ")}</p> : null}
  </div>;
}
