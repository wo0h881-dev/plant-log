"use client";

import { useEffect, useState } from "react";
import { Droplets, Layers3, RefreshCcw } from "lucide-react";
import type { Plant } from "@/types/plant";
import type { WateringStats } from "@/lib/watering";

function formatDate(value?: string) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function PlantCareSummary({ plant }: { plant: Plant }) {
  const [stats, setStats] = useState<WateringStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/watering-stats?plantId=${encodeURIComponent(plant.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "물주기 기록을 불러오지 못했습니다.");
        if (!controller.signal.aborted) setStats(payload as WateringStats);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "물주기 기록을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [plant.id]);

  return <section className="mt-6" aria-label={`${plant.name} 관리 정보`}>
    <h2 className="section-title">{plant.name} 관리 정보</h2>
    <div className="metric-grid">
      <div className="min-w-0"><Droplets size={16} className="text-[#4869D8]" aria-hidden="true" /><p className="mt-2 text-[11px] text-[#8B929B]">최근 물</p><p className="mt-1 text-xs font-semibold">{stats ? formatDate(stats.lastWateredAt) : error ? "조회 실패" : "확인 중"}</p></div>
      <div className="min-w-0"><RefreshCcw size={16} className="text-[#B08A50]" aria-hidden="true" /><p className="mt-2 text-[11px] text-[#8B929B]">분갈이</p><p className="mt-1 text-xs font-semibold">{formatDate(plant.lastRepottedAt)}</p></div>
      <div className="min-w-0"><Layers3 size={16} className="text-[#7D8B79]" aria-hidden="true" /><p className="mt-2 text-[11px] text-[#8B929B]">현재 흙</p><p className="mt-1 break-words text-xs font-semibold">{plant.currentSoils?.join(" + ") || "기록 없음"}</p></div>
    </div>
    <div className="space-y-4 py-5">
      <h3 className="text-sm font-semibold">실제 물주기</h3>
      {error ? <p role="status" className="text-xs text-red-700">{error}</p> : !stats ? <p className="text-xs text-[#909090]">기록을 확인하고 있어요.</p> : <>
        <dl className="space-y-3 text-xs">
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">마지막 물주기</dt><dd className="text-right font-bold">{formatDate(stats.lastWateredAt)}{stats.daysSinceWatered !== undefined ? ` · ${stats.daysSinceWatered}일 전` : ""}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">최근 평균 ({stats.recentIntervals}회 간격)</dt><dd className="font-bold">{stats.recentAverageDays !== undefined ? `${stats.recentAverageDays}일` : "기록 부족"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">전체 평균 ({stats.wateringDays}일 기록)</dt><dd className="font-bold">{stats.averageDays !== undefined ? `${stats.averageDays}일` : "기록 부족"}</dd></div>
        </dl>
        {stats.wateringDays < 2 ? <p className="text-[11px] text-[#909090]">서로 다른 날짜의 물주기 기록이 2번 이상 필요해요.</p> : null}
      </>}
    </div>
  </section>;
}
