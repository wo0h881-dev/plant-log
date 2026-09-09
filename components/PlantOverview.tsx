"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Droplets, ExternalLink, History, Layers3, Sprout } from "lucide-react";
import type { Plant, PlantObservationSummary } from "@/types/plant";

type DetailsResponse = {
  observations?: PlantObservationSummary[];
  message?: string;
};

function formatDate(dateValue?: string) {
  if (!dateValue) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(
    new Date(`${dateValue.slice(0, 10)}T12:00:00`),
  );
}

export function PlantOverview({ plant }: { plant: Plant }) {
  const [observations, setObservations] = useState<PlantObservationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/plant-details?plantId=${encodeURIComponent(plant.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as DetailsResponse;
        if (!response.ok) throw new Error(payload.message ?? "최근 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => setObservations(payload.observations ?? []))
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "최근 기록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [plant.id]);

  const wateringStatus = plant.isWateringDue
    ? "오늘 물줄 차례예요"
    : typeof plant.daysSinceWatered === "number"
      ? `${plant.daysSinceWatered}일 전에 물을 줬어요`
      : "첫 물주기 기록을 기다리고 있어요";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-emerald-100 bg-[#eaf6e7] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-emerald-800">{plant.category}</span>
            <h2 className="mt-2 truncate text-xl font-bold text-stone-950">{plant.name}</h2>
            <p className="mt-1 text-sm font-medium text-stone-600">{wateringStatus}</p>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#fff4c7] text-emerald-800">
            <Sprout size={24} aria-hidden="true" />
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section className="rounded-lg border border-sky-100 bg-[#eef8fb] p-4">
          <Droplets size={19} className="text-sky-700" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold text-stone-500">최근 물준 날</p>
          <p className="mt-1 text-sm font-bold text-stone-900">{formatDate(plant.lastWateredAt)}</p>
          <p className="mt-2 text-xs text-stone-600">관수 주기 {plant.wateringCycleDays ?? "미설정"}{plant.wateringCycleDays ? "일" : ""}</p>
        </section>

        <section className="rounded-lg border border-amber-100 bg-[#fff8e7] p-4">
          <CalendarDays size={19} className="text-amber-700" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold text-stone-500">최근 분갈이</p>
          <p className="mt-1 text-sm font-bold text-stone-900">{formatDate(plant.lastRepottedAt)}</p>
        </section>
      </div>

      <section className="rounded-lg border border-rose-100 bg-[#fff5f3] p-4">
        <div className="flex items-center gap-2">
          <Layers3 size={18} className="text-rose-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-stone-900">현재 흙</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {plant.currentSoils?.length ? plant.currentSoils.map((soil) => (
            <span key={soil} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm">{soil}</span>
          )) : <p className="text-sm text-stone-500">아직 기록된 흙이 없어요.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-bold text-stone-900">최근 관찰</h2>
        </div>

        {isLoading ? <p className="py-6 text-center text-sm text-stone-500">기록을 불러오는 중...</p> : null}
        {!isLoading && error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error && !observations.length ? <p className="py-6 text-center text-sm text-stone-500">아직 관찰 기록이 없어요.</p> : null}

        {observations.length ? (
          <div className="mt-3 divide-y divide-stone-100">
            {observations.map((observation) => (
              <article key={observation.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <time className="text-xs font-semibold text-stone-500">{formatDate(observation.date)}</time>
                  {observation.url ? (
                    <a href={observation.url} target="_blank" rel="noreferrer" aria-label="Notion에서 관찰 기록 열기" className="grid h-8 w-8 place-items-center text-stone-400">
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                {observation.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {observation.tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">{tag}</span>)}
                  </div>
                ) : null}
                {observation.note ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-700">{observation.note}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
