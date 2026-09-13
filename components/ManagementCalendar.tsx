"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, NotebookPen, RefreshCcw } from "lucide-react";
import type { Plant, PlantCalendarEvent } from "@/types/plant";

type ManagementCalendarProps = {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
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

export function ManagementCalendar({ plants, onSelectPlant }: ManagementCalendarProps) {
  const today = toDateValue(new Date());
  const [month, setMonth] = useState(getMonthValue);
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<PlantCalendarEvent[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [error, setError] = useState("");

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
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [events]);
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
      <header className="mb-5">
        <h1 className="text-[32px] font-black leading-tight">관리 캘린더</h1>
        <p className="mt-1 text-[13px] font-medium text-[#777B74]">물주기와 관찰 기록을 날짜별로 확인해요.</p>
      </header>

      <section className="rounded-[26px] bg-white p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달" className="grid h-10 w-10 place-items-center rounded-full bg-[#F0F1EE] text-[#444842]"><ChevronLeft size={19} aria-hidden="true" /></button>
          <div className="flex items-center gap-2 text-[17px] font-black"><CalendarDays size={18} className="text-[#284F2A]" aria-hidden="true" />{year}년 {monthNumber}월</div>
          <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달" className="grid h-10 w-10 place-items-center rounded-full bg-[#F0F1EE] text-[#444842]"><ChevronRight size={19} aria-hidden="true" /></button>
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
              <button key={date} type="button" onClick={() => setSelectedDate(date)} className={`relative mx-auto grid aspect-square w-10 place-items-center rounded-full text-xs font-bold transition ${isSelected ? "bg-[#284F2A] text-white" : date === today ? "bg-[#E7EFE3] text-[#284F2A]" : "text-[#444842]"}`}>
                <span>{day}</span>
                {(hasWatering || hasObservation || hasRepotting) ? <span className="absolute bottom-1.5 flex gap-0.5">{hasWatering ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-[#BDE3EF]" : "bg-[#4F9DB6]"}`} /> : null}{hasObservation ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-[#568455]"}`} /> : null}{hasRepotting ? <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-[#F3D7A2]" : "bg-[#B28748]"}`} /> : null}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-center gap-4 border-t border-[#EEEFEA] pt-3 text-[10px] font-semibold text-[#777B74]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4F9DB6]" />물주기</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#568455]" />관찰일지</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B28748]" />분갈이</span></div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[17px] font-black">{formatSelectedDate(selectedDate)}</h2><span className="text-xs font-semibold text-[#909090]">{selectedEvents.length}개</span></div>
        {isLoading ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">기록을 불러오는 중...</div> : null}
        {!isLoading && error ? <div className="rounded-[22px] bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && !selectedEvents.length ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">이날의 관리 기록이 없어요.</div> : null}
        {selectedEvents.length ? <div className="space-y-2.5">{selectedEvents.map((event) => {
          const plant = plants.find((item) => item.id === event.plantId) ?? plants.find((item) => item.name === event.plantName);
          const isWatering = event.type === "watering";
          const isRepotting = event.type === "repotting";
          const eventLabel = isWatering ? "물주기" : isRepotting ? "분갈이" : event.tags?.join(" · ") || "관찰일지";
          const iconStyle = isWatering ? "bg-[#E3F1F5] text-[#377E96]" : isRepotting ? "bg-[#F3EBDD] text-[#8B6937]" : "bg-[#E7EFE3] text-[#284F2A]";
          return <button key={event.id} type="button" disabled={!plant} onClick={() => { if (plant) onSelectPlant(plant); }} className="flex w-full items-center gap-3 rounded-[22px] bg-white p-3 text-left transition enabled:active:scale-[0.99]"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconStyle}`}>{isWatering ? <Droplets size={19} aria-hidden="true" /> : isRepotting ? <RefreshCcw size={18} aria-hidden="true" /> : <NotebookPen size={18} aria-hidden="true" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{event.plantName}</span><span className="mt-0.5 block truncate text-[11px] text-[#909090]">{eventLabel}{event.note ? ` · ${event.note}` : ""}</span></span><ChevronRight size={16} className="shrink-0 text-[#A3A5A0]" aria-hidden="true" /></button>;
        })}</div> : null}
      </section>
    </>
  );
}
