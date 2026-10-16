"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { Plant } from "@/types/plant";

export function PlantNameEditor({ plant, onSaved }: { plant: Plant; onSaved: (plant: Plant) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plant.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/plants", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: plant.id, name: name.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "이름 변경에 실패했습니다.");
      if (!payload.plant) throw new Error("변경한 식물 정보를 불러오지 못했습니다.");
      onSaved(payload.plant as Plant);
      setEditing(false);
      setMessage("이름을 변경했습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이름 변경에 실패했습니다.");
    } finally { submitting.current = false; setSaving(false); }
  }

  return <section aria-label="식물 이름 변경">
    {editing ? <form onSubmit={save} className="flex items-end gap-2">
      <label className="min-w-0 flex-1"><span className="mb-2 block text-xs font-medium text-[#8B929B]">새 식물명</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} disabled={saving} className="field" /></label>
      <button type="submit" disabled={saving || !name.trim() || name.trim() === plant.name} aria-label="이름 변경 저장" title="이름 변경 저장" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#4263EB] text-white disabled:opacity-40"><Check size={19} aria-hidden="true" /></button>
      <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }} aria-label="이름 변경 취소" title="이름 변경 취소" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#777B74]"><X size={19} aria-hidden="true" /></button>
    </form> : <div className="flex items-center justify-between border-t border-[#ECEEF1] pt-3"><span className="text-xs text-[#8B929B]">식물 이름</span><button type="button" onClick={() => { setName(plant.name); setEditing(true); setMessage(""); setError(""); }} className="flex min-h-10 items-center gap-2 px-2 text-xs font-medium text-[#4263EB]"><Pencil size={14} aria-hidden="true" />이름 변경</button></div>}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-2 text-right text-xs text-[#4263EB]">{message}</p> : null}
  </section>;
}
