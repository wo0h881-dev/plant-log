"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { Plant } from "@/types/plant";

export function PlantWateringCycleEditor({ plant, onSaved, initiallyEditing = false }: { plant: Plant; onSaved: (plant: Plant) => void; initiallyEditing?: boolean }) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [value, setValue] = useState(String(plant.wateringCycleDays ?? ""));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const cycle = value.trim() ? Number(value) : null;
    if (cycle !== null && (!Number.isFinite(cycle) || cycle < 1)) { setError("관수 주기는 1일 이상으로 입력하세요."); return; }
    submitting.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/plants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: plant.id, wateringCycleDays: cycle }) });
      const payload = await response.json();
      if (!response.ok || !payload.plant) throw new Error(payload.message ?? "관수 주기 변경에 실패했습니다.");
      onSaved(payload.plant as Plant); setEditing(false); setMessage("관수 주기를 변경했습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "관수 주기 변경에 실패했습니다."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <section aria-label="관수 주기 변경" className="border-t border-[#ECEEF1] pt-3">
    {editing ? <form onSubmit={save} className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-2 block text-xs font-medium text-[#8B929B]">관수 주기 (일)</span><input autoFocus type="number" min={1} step="any" value={value} onChange={(event) => setValue(event.target.value)} disabled={saving} placeholder="미설정" className="field" /></label><button type="submit" disabled={saving} aria-label="관수 주기 저장" title="관수 주기 저장" className="grid h-12 w-11 shrink-0 place-items-center rounded-lg bg-[#4263EB] text-white disabled:opacity-40"><Check size={19} /></button><button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }} aria-label="관수 주기 변경 취소" title="취소" className="icon-button"><X size={19} /></button></form> : <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#8B929B]">관수 주기</p><div className="flex items-center gap-2"><p className="text-sm font-semibold">{plant.wateringCycleDays !== undefined ? `${plant.wateringCycleDays}일` : "미설정"}</p><button type="button" onClick={() => { setValue(String(plant.wateringCycleDays ?? "")); setEditing(true); setError(""); setMessage(""); }} aria-label="관수 주기 변경" title="관수 주기 변경" className="icon-button"><Pencil size={15} /></button></div></div>}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : message ? <p role="status" className="mt-2 text-xs text-[#4263EB]">{message}</p> : null}
  </section>;
}
