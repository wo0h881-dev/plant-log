"use client";

import { useRef, useState } from "react";
import { PlantDialog } from "@/components/PlantDialog";
import { formatLocationEnvironment, type LocationEnvironment } from "@/lib/location-environment";
import { seoulDate } from "@/lib/watering";
import { canSelectPlant, matchesPlantSearch } from "@/lib/plant-search";
import type { Plant } from "@/types/plant";

export type RoomRecordInput = { kind: "environment" | "common"; date: string; operationId: string; locationId: string; environment?: LocationEnvironment; title?: string; note: string; excludedPlantIds?: string[] };

export function RoomRecordDialog({ kind, locationId, locationName, current, onSave, onClose, plants = [], initialDate }: {
  kind: "environment" | "common"; locationId: string; locationName: string; current?: LocationEnvironment;
  plants?: Plant[]; initialDate?: string;
  onSave: (input: RoomRecordInput) => Promise<void>; onClose: () => void;
}) {
  const [date, setDate] = useState(() => initialDate ?? seoulDate());
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const submitting = useRef(false);
  return <PlantDialog title={kind === "environment" ? "공간 온습도 기록" : "전체 공지"} closeDisabled={busy} onClose={onClose}>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (submitting.current) return;
      if (kind === "environment" && !temperature.trim() && !humidity.trim()) { setError("온도 또는 습도를 입력해주세요."); return; }
      submitting.current = true; setBusy(true); setError("");
      const values = { kind, date, locationId, note, ...(kind === "environment" ? { environment: { ...(temperature.trim() ? { temperature: Number(temperature) } : {}), ...(humidity.trim() ? { humidity: Number(humidity) } : {}) } } : { title: title.trim(), excludedPlantIds: excludedIds }) };
      const signature = JSON.stringify(values);
      if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
      try { await onSave({ ...values, operationId: operation.current.id }); onClose(); }
      catch { setError("저장을 확인하지 못했어요. 입력 내용은 유지했으니 다시 시도해주세요."); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <fieldset disabled={busy} className="space-y-4">
        {kind === "environment" ? <>
          <p className="text-sm font-semibold">{locationName}</p>
          <p className="text-xs text-[#8B929B]">현재 {formatLocationEnvironment(current)}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-xs">온도 (℃)<input className="field mt-2" aria-label="공간 온도" type="number" step="any" min={-50} max={80} value={temperature} onChange={(event) => setTemperature(event.target.value)} placeholder={current?.temperature !== undefined ? String(current.temperature) : "26"} /></label>
            <label className="min-w-0 text-xs">습도 (%)<input className="field mt-2" aria-label="공간 습도" type="number" step="any" min={0} max={100} value={humidity} onChange={(event) => setHumidity(event.target.value)} placeholder={current?.humidity !== undefined ? String(current.humidity) : "85"} /></label>
          </div>
        </> : <>
          <label className="block text-xs">공지 제목<input className="field mt-2" required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="뿌리깍지벌레 발견 · 코니도 입제 처리" /></label>
          <details className="rounded-2xl border border-[#ECEEF1] p-3">
            <summary className="cursor-pointer text-sm font-semibold">공지 제외 식물 · {excludedIds.length}개</summary>
            <input type="search" className="field mt-3" aria-label="공지 제외 식물 검색" placeholder="식물 이름 또는 초성" value={query} onChange={(event) => setQuery(event.target.value)} />
            {excludedIds.length ? <div className="my-2 flex flex-wrap gap-1">{plants.filter((plant) => excludedIds.includes(plant.id)).map((plant) => <button key={plant.id} type="button" className="rounded-full bg-[#EEF2FF] px-3 py-2 text-xs text-[#4263EB]" aria-label={`${plant.name} 공지 제외 해제`} onClick={() => setExcludedIds((ids) => ids.filter((id) => id !== plant.id))}>{plant.name} ×</button>)}</div> : null}
            <div className="mt-2 max-h-48 overflow-y-auto">{plants.filter((plant) => canSelectPlant(plant) && matchesPlantSearch(plant, query)).map((plant) => <label key={plant.id} className="flex min-h-11 items-center gap-3 py-2 text-sm"><input type="checkbox" aria-label={`${plant.name} 공지 제외`} checked={excludedIds.includes(plant.id)} onChange={() => setExcludedIds((ids) => ids.includes(plant.id) ? ids.filter((id) => id !== plant.id) : [...ids, plant.id])} className="h-5 w-5 shrink-0 accent-[#4263EB]" /><span className="min-w-0 break-words">{plant.name}</span></label>)}</div>
          </details>
        </>}
        <label className="block text-xs">기록 날짜<input className="field mt-2" type="date" required max={seoulDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="block text-xs">메모<textarea className="field mt-2" maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
        <button type="submit" className="primary-button">{busy ? "저장 중..." : "기록 저장"}</button>
      </fieldset>
    </form>
  </PlantDialog>;
}
