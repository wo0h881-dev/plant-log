"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, NotebookPen, RefreshCcw } from "lucide-react";
import type { Plant, PlantCalendarEvent } from "@/types/plant";
import { PlantSelect } from "@/components/PlantSelect";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { matchesPlantSearch } from "@/lib/plant-search";

type ManagementCalendarProps = {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
  filter: { plantId: string; query: string };
  onFilterChange: (filter: { plantId: string; query: string }) => void;
};

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthValue(date = new Date()) {
  return toDateValue(date).slice(0, 7);
}

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return getMonthValue(new Date(year, monthNumber - 1 + amount, 1));
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];
  while (cells.length % 7) cells.push(null);
  return cells;
}

function formatSelectedDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

export function ManagementCalendar({ plants, onSelectPlant, filter, onFilterChange }: ManagementCalendarProps) {
  const today = toDateValue(new Date());
  const [month, setMonth] = useState(getMonthValue);
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<PlantCalendarEvent[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [error, setError] = useState("");
  const { query, plantId } = filter;
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/calendar?month=${month}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { events?: PlantCalendarEvent[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "관리 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        setEvents(payload.events ?? []);
        setError("");
        setLoadedMonth(month);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setEvents([]);
        setError(fetchError instanceof Error ? fetchError.message : "관리 기록을 불러오지 못했습니다.");
        setLoadedMonth(month);
      });
    return () => controller.abort();
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlantCalendarEvent[]>();
    for (const event of events) {
      const plant = plants.find((item) => item.id === event.plantId);
      const matches = plantId
        ? (event.plantId ? event.plantId === plantId : event.plantName === selectedPlant?.name)
        : matchesPlantSearch(plant ?? { name: event.plantName, category: "" }, query);
      if (matches) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    }
    return map;
  }, [events, plants, plantId, query, selectedPlant?.name]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const isLoading = loadedMonth !== month;
  const days = buildMonthDays(month);
  const [year, monthNumber] = month.split("-").map(Number);

  function changeMonth(amount: number) {
    const nextMonth = moveMonth(month, amount);
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  return (
    <>
      <header className="screen-header">
        <div><h1 className="screen-title">관리 캘린더</h1><p className="screen-description">차곡차곡 쌓인 돌봄의 기록.</p></div>
      </header>

      <div className="mb-5">
        <PlantSelect plants={plants} value={selectedPlant ? `${selectedPlant.category} - ${selectedPlant.name}` : ""} query={query} recentPlants={[]} variant="search" showPhotos={false}
          onQueryChange={(value) => onFilterChange({ query: value, plantId: value === selectedPlant?.name ? plantId : "" })}
          onSelect={(plant) => onFilterChange({ plantId: plant.id, query: plant.name })} />
      </div>

      <section className="border-y border-[#ECEEF1] py-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달" title="이전 달" className="icon-button"><ChevronLeft size={19} aria-hidden="true" /></button>
          <div className="flex items-center gap-2 text-base font-semibold"><CalendarDays size={17} className="text-[#8B929B]" aria-hidden="true" />{year}년 {monthNumber}월</div>
          <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달" title="다음 달" className="icon-button"><ChevronRight size={19} aria-hidden="true" /></button>
        </div>

        <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-bold text-[#9A9D97]">
          {['월', '화', '수', '목', '금', '토', '일'].map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-1">
          {days.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} className="aspect-square" />;
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const dayEvents = eventsByDate.get(date) ?? [];
            const hasWatering = dayEvents.some((event) => event.type === "watering");
            const hasObservation = dayEvents.some((event) => event.type === "observation");
            const hasRepotting = dayEvents.some((event) => event.type === "repotting");
            const isSelected = selectedDate === date;
            return (
              <button key={date} type="button" onClick={() => setSelectedDate(date)} className={`relative mx-auto grid aspect-square w-full max-w-10 place-items-center rounded-lg text-xs font-medium transition ${isSelected ? "bg-[#4263EB] text-white" : date === today ? "bg-[#EEF2FF] text-[#4263EB]" : "text-[#626B76]"}`}>
                <span>{day}</span>
                {(hasWatering || hasObservation || hasRepotting) ? <span className="absolute bottom-1.5 flex gap-0.5">{hasWatering ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-[#BDE3EF]" : "bg-[#4263EB]"}`} /> : null}{hasObservation ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-[#8192BE]"}`} /> : null}{hasRepotting ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-[#F3D7A2]" : "bg-[#A0AEDD]"}`} /> : null}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-center gap-4 border-t border-[#EEEFEA] pt-3 text-[10px] font-semibold text-[#777B74]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4263EB]" />물주기</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#8192BE]" />관찰일지</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#A0AEDD]" />분갈이</span></div>
      </section>

      {selectedPlant ? <PlantCareSummary key={selectedPlant.id} plant={selectedPlant} /> : null}

      <section className="section-divider">
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">{formatSelectedDate(selectedDate)}</h2><span className="text-xs text-[#909090]">{selectedEvents.length}개</span></div>
        {isLoading ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">기록을 불러오는 중...</div> : null}
        {!isLoading && error ? <div className="rounded-[22px] bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && !selectedEvents.length ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">이날의 관리 기록이 없어요.</div> : null}
        {selectedEvents.length ? <div className="space-y-2.5">{selectedEvents.map((event) => {
          const plant = plants.find((item) => item.id === event.plantId) ?? plants.find((item) => item.name === event.plantName);
          const isWatering = event.type === "watering";
          const isRepotting = event.type === "repotting";
          const eventLabel = isWatering ? "물주기" : isRepotting ? "분갈이" : event.tags?.join(" · ") || "관찰일지";
          const iconStyle = isWatering ? "bg-[#EEF2FF] text-[#4263EB]" : isRepotting ? "bg-[#F2F4FA] text-[#8192BE]" : "bg-[#EEF2FF] text-[#4263EB]";
          return <button key={event.id} type="button" disabled={!plant} onClick={() => { if (plant) onSelectPlant(plant); }} className="flex min-h-[76px] w-full items-center gap-3 border-b border-[#ECEEF1] py-3 text-left"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconStyle}`}>{isWatering ? <Droplets size={18} aria-hidden="true" /> : isRepotting ? <RefreshCcw size={18} aria-hidden="true" /> : <NotebookPen size={18} aria-hidden="true" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{plant?.name ?? event.plantName}</span><span className="mt-1 block truncate text-[11px] text-[#909090]">{eventLabel}{event.note ? ` · ${event.note}` : ""}</span></span><ChevronRight size={16} className="shrink-0 text-[#A3A5A0]" aria-hidden="true" /></button>;
        })}</div> : null}
      </section>
    </>
  );
}
