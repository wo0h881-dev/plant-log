"use client";

import { useRef, useState } from "react";
import { PlantDialog } from "@/components/PlantDialog";
import { formatLocationEnvironment, type LocationEnvironment } from "@/lib/location-environment";
import { seoulDate } from "@/lib/watering";

export type RoomRecordInput = { kind: "environment" | "common"; date: string; operationId: string; locationId: string; environment?: LocationEnvironment; title?: string; note: string };

export function RoomRecordDialog({ kind, locationId, locationName, current, onSave, onClose }: {
  kind: "environment" | "common"; locationId: string; locationName: string; current?: LocationEnvironment;
  onSave: (input: RoomRecordInput) => Promise<void>; onClose: () => void;
}) {
  const [date, setDate] = useState(seoulDate);
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const submitting = useRef(false);
  return <PlantDialog title={kind === "environment" ? "공간 온습도 기록" : "전체 공통 기록"} closeDisabled={busy} onClose={onClose}>
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (submitting.current) return;
      if (kind === "environment" && !temperature.trim() && !humidity.trim()) { setError("온도 또는 습도를 입력해주세요."); return; }
      submitting.current = true; setBusy(true); setError("");
      const values = { kind, date, locationId, note, ...(kind === "environment" ? { environment: { ...(temperature.trim() ? { temperature: Number(temperature) } : {}), ...(humidity.trim() ? { humidity: Number(humidity) } : {}) } } : { title: title.trim() }) };
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
        </> : <label className="block text-xs">공통 기록 제목<input className="field mt-2" required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="뿌리깍지벌레 발견 · 코니도 입제 처리" /></label>}
        <label className="block text-xs">기록 날짜<input className="field mt-2" type="date" required max={seoulDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="block text-xs">메모<textarea className="field mt-2" maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
        <button type="submit" className="primary-button">{busy ? "저장 중..." : "기록 저장"}</button>
      </fieldset>
    </form>
  </PlantDialog>;
}
