"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Droplets, NotebookPen, RefreshCcw, Sprout } from "lucide-react";
import type { Plant, PlantCalendarEvent } from "@/types/plant";
import { PlantSelect } from "@/components/PlantSelect";
import { PlantCareSummary } from "@/components/PlantCareSummary";
import { PlantCoverThumbnail } from "@/components/PlantCoverThumbnail";
import { canSelectPlant, matchesPlantSearch } from "@/lib/plant-search";

type ManagementCalendarProps = {
  plants: Plant[];
  onSelectPlant: (plant: Plant) => void;
  filter: { plantId: string; query: string };
  onFilterChange: (filter: { plantId: string; query: string }) => void;
  hideSearch?: boolean;
  active?: boolean;
  revision?: number;
};

const calendarKinds = [
  { type: "watering", label: "물주기", color: "calendar-water", icon: Droplets },
  { type: "observation", label: "관찰일지", color: "calendar-observation", icon: NotebookPen },
  { type: "repotting", label: "분갈이", color: "calendar-repot", icon: RefreshCcw },
  { type: "fertilizer", label: "비료", color: "calendar-fertilizer", icon: Sprout },
] as const;
const calendarFilters = [{ type: "all", label: "전체" } as const, ...calendarKinds];

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

export function ManagementCalendar({ plants, onSelectPlant, filter, onFilterChange, hideSearch = false, active = true, revision = 0 }: ManagementCalendarProps) {
  const today = toDateValue(new Date());
  const [month, setMonth] = useState(getMonthValue);
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<PlantCalendarEvent[]>([]);
  const [loadedMonth, setLoadedMonth] = useState("");
  const loadedKey = useRef("");
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState<"all" | PlantCalendarEvent["type"]>("all");
  const { query, plantId } = filter;
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  useEffect(() => {
    const key = `${month}:${revision}`;
    if (!active || loadedKey.current === key) return;
    const controller = new AbortController();
    fetch(`/api/calendar?month=${month}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { events?: PlantCalendarEvent[]; message?: string };
        if (!response.ok) throw new Error(payload.message ?? "관리 기록을 불러오지 못했습니다.");
        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setEvents(payload.events ?? []);
        setError("");
        setLoadedMonth(month);
        loadedKey.current = key;
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return;
        loadedKey.current = "";
        setEvents([]);
        setError(fetchError instanceof Error ? fetchError.message : "관리 기록을 불러오지 못했습니다.");
        setLoadedMonth(month);
      });
    return () => controller.abort();
  }, [active, month, revision]);

  const plantLookup = useMemo(() => {
    const byId = new Map<string, Plant>();
    const byName = new Map<string, Plant>();
    for (const plant of plants) {
      byId.set(plant.id, plant);
      if (!byName.has(plant.name)) byName.set(plant.name, plant);
    }
    return { byId, byName };
  }, [plants]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlantCalendarEvent[]>();
    for (const event of events) {
      const plant = event.plantId ? plantLookup.byId.get(event.plantId) : plantLookup.byName.get(event.plantName);
      const matches = plantId
        ? (event.plantId ? event.plantId === plantId : event.plantName === selectedPlant?.name)
        : (!query.trim() || !plant || canSelectPlant(plant)) && matchesPlantSearch(plant ?? { name: event.plantName, category: "" }, query);
      if (!matches) continue;
      const dayEvents = map.get(event.date);
      if (dayEvents) dayEvents.push(event);
      else map.set(event.date, [event]);
    }
    return map;
  }, [events, plantLookup, plantId, query, selectedPlant?.name]);
  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const filteredEvents = selectedEvents.filter((event) => eventFilter === "all" || event.type === eventFilter);
  const plantKey = (event: PlantCalendarEvent) => event.plantId ? `id:${event.plantId.replaceAll("-", "").toLowerCase()}` : `name:${event.plantName}`;
  const fertilizerByPlant = new Map<string, PlantCalendarEvent[]>();
  if (eventFilter === "all") {
    for (const event of filteredEvents) {
      if (event.type !== "fertilizer") continue;
      const key = plantKey(event);
      const group = fertilizerByPlant.get(key) ?? [];
      group.push(event);
      fertilizerByPlant.set(key, group);
    }
  }
  const mergedPlantKeys = new Set<string>();
  const mergedEventIds = new Set<string>();
  const calendarCards = filteredEvents.map((event) => {
    const key = plantKey(event);
    const fertilizers = event.type === "watering" && !mergedPlantKeys.has(key) ? fertilizerByPlant.get(key) ?? [] : [];
    if (fertilizers.length) {
      mergedPlantKeys.add(key);
      fertilizers.forEach((entry) => mergedEventIds.add(entry.id));
    }
    return { event, fertilizers };
  }).filter(({ event }) => !mergedEventIds.has(event.id));
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
            const kinds = new Set(eventsByDate.get(date)?.map((event) => event.type));
            const isSelected = selectedDate === date;
            return (
              <button key={date} type="button" onClick={() => setSelectedDate(date)} className={`relative mx-auto grid aspect-square w-full max-w-10 place-items-center rounded-lg text-xs font-medium transition ${isSelected ? "bg-[#4263EB] text-white" : date === today ? "bg-[#EEF2FF] text-[#4263EB]" : "text-[#626B76]"}`}>
                <span>{day}</span>
                {kinds.size ? <span className={`calendar-markers absolute bottom-1 flex gap-0.5 ${isSelected ? "rounded-full bg-white px-1 py-0.5" : ""}`}>{calendarKinds.filter(({ type }) => kinds.has(type)).map(({ type, label, color }) => <span key={type} aria-label={`${label} 기록`} className={`calendar-dot ${color}`} />)}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">{calendarKinds.map(({ type, label, color, icon: Icon }) => <span key={type}><Icon size={13} aria-hidden="true" /><i className={`calendar-dot ${color}`} />{label}</span>)}</div>
      </section>

      {selectedPlant ? <PlantCareSummary key={selectedPlant.id} plant={selectedPlant} /> : null}

      <section className="section-divider">
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">{formatSelectedDate(selectedDate)}</h2><span className="text-xs text-[#909090]">{calendarCards.length}개</span></div>
        <div className="calendar-filters" role="tablist" aria-label="관리 기록 종류">
          {calendarFilters.map(({ type, label }, index) => <button key={type} id={`calendar-filter-${type}`} type="button" role="tab" aria-selected={eventFilter === type} aria-controls="calendar-records" tabIndex={eventFilter === type ? 0 : -1} onClick={() => setEventFilter(type)} onKeyDown={(event) => {
            const count = calendarFilters.length;
            const next = event.key === "ArrowRight" ? (index + 1) % count : event.key === "ArrowLeft" ? (index + count - 1) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : -1;
            if (next >= 0) { event.preventDefault(); const target = calendarFilters[next].type; setEventFilter(target); document.getElementById(`calendar-filter-${target}`)?.focus(); }
          }}>{label}</button>)}
        </div>
        <div id="calendar-records" role="tabpanel" aria-labelledby={`calendar-filter-${eventFilter}`}>
        {isLoading ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">기록을 불러오는 중...</div> : null}
        {!isLoading && error ? <div className="rounded-[22px] bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div> : null}
        {!isLoading && !error && !filteredEvents.length ? <div className="rounded-[22px] bg-white px-4 py-7 text-center text-sm text-[#909090]">{eventFilter === "all" ? "이날의 관리 기록이 없어요." : "선택한 종류의 기록이 없어요."}</div> : null}
        {!isLoading && !error && calendarCards.length ? <div className="plant-icon-grid">{calendarCards.map(({ event, fertilizers }) => {
          const plant = (event.plantId ? plantLookup.byId.get(event.plantId) : undefined) ?? plantLookup.byName.get(event.plantName);
          const label = fertilizers.length ? "물주기 및 비료" : calendarKinds.find(({ type }) => type === event.type)?.label;
          const detail = event.note?.trim() || (event.type === "watering" ? "물줌" : "");
          return <button key={event.id} type="button" disabled={!plant} onClick={() => { if (plant) onSelectPlant(plant); }} className="plant-icon-tile calendar-event-tile" data-event-type={event.type} aria-label={`${plant?.name ?? event.plantName} ${label} 기록`}><PlantCoverThumbnail key={plant?.coverPhotoUrl ?? "no-cover"} src={plant?.coverPhotoUrl} /><span className="tile-name">{plant?.name ?? event.plantName}</span>{detail ? <span className="tile-detail tile-note">{detail}</span> : null}{fertilizers.map(({ id, note }) => <span key={id} className="tile-detail tile-note calendar-fertilizer-detail">{note}</span>)}</button>;
        })}</div> : null}
        </div>
      </section>
    </>
  );
}
