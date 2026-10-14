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

  return <section className="mt-5 space-y-3" aria-label={`${plant.name} 관리 정보`}>
    <h2 className="text-[17px] font-black">{plant.name} 관리 정보</h2>
    <div className="grid grid-cols-3 divide-x divide-[#E8E9E5] rounded-2xl bg-white px-1 py-3">
      <div className="min-w-0 px-2 text-center"><Droplets size={15} className="mx-auto text-[#47794B]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">최근 물</p><p className="mt-0.5 text-[11px] font-bold">{stats ? formatDate(stats.lastWateredAt) : error ? "조회 실패" : "확인 중"}</p></div>
      <div className="min-w-0 px-2 text-center"><RefreshCcw size={15} className="mx-auto text-[#82734C]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">분갈이</p><p className="mt-0.5 text-[11px] font-bold">{formatDate(plant.lastRepottedAt)}</p></div>
      <div className="min-w-0 px-2 text-center"><Layers3 size={15} className="mx-auto text-[#776A66]" aria-hidden="true" /><p className="mt-1 text-[10px] text-[#909090]">현재 흙</p><p className="mt-0.5 break-words text-[11px] font-bold">{plant.currentSoils?.join(" + ") || "기록 없음"}</p></div>
    </div>
    <section className="space-y-3 rounded-[22px] bg-white p-4">
      <h3 className="text-[15px] font-black">실제 물주기</h3>
      {error ? <p role="status" className="text-xs text-red-700">{error}</p> : !stats ? <p className="text-xs text-[#909090]">기록을 확인하고 있어요.</p> : <>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">마지막 물주기</dt><dd className="text-right font-bold">{formatDate(stats.lastWateredAt)}{stats.daysSinceWatered !== undefined ? ` · ${stats.daysSinceWatered}일 전` : ""}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">최근 평균 ({stats.recentIntervals}회 간격)</dt><dd className="font-bold">{stats.recentAverageDays !== undefined ? `${stats.recentAverageDays}일` : "기록 부족"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#909090]">전체 평균 ({stats.wateringDays}일 기록)</dt><dd className="font-bold">{stats.averageDays !== undefined ? `${stats.averageDays}일` : "기록 부족"}</dd></div>
        </dl>
        {stats.wateringDays < 2 ? <p className="text-[11px] text-[#909090]">서로 다른 날짜의 물주기 기록이 2번 이상 필요해요.</p> : null}
      </>}
    </section>
  </section>;
}
