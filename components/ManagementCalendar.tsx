"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, NotebookPen, RefreshCcw } from "lucide-react";
import type { Plant, PlantCalendarEvent } from "@/types/plant";
import { PlantSelect } from "@/components/PlantSelect";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { PlantCoverThumbnail } from "@/components/PlantCoverThumbnail";
import { matchesPlantSearch } from "@/lib/plant-search";

type ManagementCalendarProps = {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
  filter: { plantId: string; query: string };
  onFilterChange: (filter: { plantId: string; query: string }) => void;
  hideSearch?: boolean;
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

export function ManagementCalendar({ plants, onSelectPlant, filter, onFilterChange, hideSearch = false }: ManagementCalendarProps) {
  const today = toDateValue(new Date());
  const [month, setMonth] = useState(getMonthValue);
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<PlantCalendarEvent[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState<"all" | PlantCalendarEvent["type"]>("all");
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
  const filteredEvents = selectedEvents.filter((event) => eventFilter === "all" || event.type === eventFilter);
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
      {!hideSearch ? <div className="mb-5">
        <PlantSelect plants={plants} value={selectedPlant ? `${selectedPlant.category} - ${selectedPlant.name}` : ""} query={query} recentPlants={[]} variant="search"
          onQueryChange={(value) => onFilterChange({ query: value, plantId: value === selectedPlant?.name ? plantId : "" })}
          onSelect={(plant) => onFilterChange({ plantId: plant.id, query: plant.name })} />
      </div> : null}

      <section className="py-4">
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
                {(hasWatering || hasObservation || hasRepotting) ? <span className={`calendar-markers absolute bottom-1 flex gap-1 ${isSelected ? "rounded-full bg-white px-1 py-0.5" : ""}`}>{hasWatering ? <span aria-label="물주기 기록" className="calendar-dot calendar-water" /> : null}{hasObservation ? <span aria-label="관찰일지 기록" className="calendar-dot calendar-observation" /> : null}{hasRepotting ? <span aria-label="분갈이 기록" className="calendar-dot calendar-repot" /> : null}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend"><span><Droplets size={13} /><i className="calendar-dot calendar-water" />물주기</span><span><NotebookPen size={13} /><i className="calendar-dot calendar-observation" />관찰일지</span><span><RefreshCcw size={13} /><i className="calendar-dot calendar-repot" />분갈이</span></div>
      </section>

      {selectedPlant ? <PlantCareSummary key={selectedPlant.id} plant={selectedPlant} /> : null}

      <section className="section-divider">
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">{formatSelectedDate(selectedDate)}</h2><span className="text-xs text-[#909090]">{filteredEvents.length}개</span></div>
        <div className="calendar-filters" role="tablist" aria-label="관리 기록 종류">
          {([["all", "전체"], ["watering", "물주기"], ["observation", "관찰일지"], ["repotting", "분갈이"]] as const).map(([type, label], index) => <button key={type} id={`calendar-filter-${type}`} type="button" role="tab" aria-selected={eventFilter === type} aria-controls="calendar-records" tabIndex={eventFilter === type ? 0 : -1} onClick={() => setEventFilter(type)} onKeyDown={(event) => {
            const types = ["all", "watering", "observation", "repotting"] as const;
            const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : -1;
            if (next >= 0) { event.preventDefault(); setEventFilter(types[next]); document.getElementById(`calendar-filter-${types[next]}`)?.focus(); }
          }}>{label}</button>)}
        </div>
        <div id="calendar-records" role="tabpanel" aria-labelledby={`calendar-filter-${eventFilter}`}>
        {isLoading ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">기록을 불러오는 중...</div> : null}
        {!isLoading && error ? <div className="rounded-[22px] bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && !filteredEvents.length ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">{eventFilter === "all" ? "이날의 관리 기록이 없어요." : "선택한 종류의 기록이 없어요."}</div> : null}
        {!isLoading && !error && filteredEvents.length ? <div className="plant-icon-grid">{filteredEvents.map((event) => {
          const plant = plants.find((item) => item.id === event.plantId) ?? plants.find((item) => item.name === event.plantName);
          const isWatering = event.type === "watering";
          const isRepotting = event.type === "repotting";
          const detail = event.note?.trim() || (isWatering ? "물줌" : "");
          return <button key={event.id} type="button" disabled={!plant} onClick={() => { if (plant) onSelectPlant(plant); }} className="plant-icon-tile calendar-event-tile" data-event-type={event.type} aria-label={`${plant?.name ?? event.plantName} ${isWatering ? "물주기" : isRepotting ? "분갈이" : "관찰일지"} 기록`}><PlantCoverThumbnail key={plant?.coverPhotoUrl ?? "no-cover"} src={plant?.coverPhotoUrl} /><span className="tile-name">{plant?.name ?? event.plantName}</span>{detail ? <span className="tile-detail tile-note">{detail}</span> : null}</button>;
        })}</div> : null}
        </div>
      </section>
    </>
  );
}
