"use client";

import { Bug, Droplets, Flower2, Leaf, MoreHorizontal, RefreshCcw, Tag, Thermometer, ThumbsDown, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = { 신엽: Leaf, 하엽: Leaf, 과습: Droplets, 해충: Bug, 병해충: Bug, 꽃: Flower2, 분갈이: RefreshCcw, 기타: MoreHorizontal, 온습도: Thermometer, 좋음: ThumbsUp, 안좋음: ThumbsDown };
const special = ["좋음", "안좋음", "분갈이", "온습도"];

export function ObservationTagPicker({ tags, selected, onToggle }: { tags: string[]; selected: string[]; onToggle: (tag: string) => void }) {
  const statusOrder = ["신엽", "하엽", "과습", "뿌리", "상태이상", "해충"];
  const status = [...new Set([...statusOrder, ...tags])].filter((tag) => !special.includes(tag) && tag !== "분갈이 필요");
  return <div className="space-y-3">{[status, ["좋음", "안좋음"], ["분갈이", "온습도"]].map((group, index) => <div key={index} role="group" aria-label={["상태", "상태 평가", "관리 기록"][index]} className={`grid gap-2 ${index === 0 ? "grid-cols-3" : "grid-cols-2 border-t border-[#EEEFEA] pt-3"}`}>{group.map((name) => {
    const Icon = icons[name] ?? Tag;
    const active = selected.includes(name);
    return <button key={name} type="button" aria-pressed={active} onClick={() => onToggle(name)} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-1 text-xs font-bold ${active ? "bg-[#284F2A] text-white" : "bg-[#F0F1EE] text-[#333633]"}`}><Icon size={16} aria-hidden="true" /><span className="break-all">{name}</span></button>;
  })}</div>)}</div>;
}
