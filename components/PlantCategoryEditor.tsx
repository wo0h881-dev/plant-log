"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { Plant } from "@/types/plant";

export function PlantCategoryEditor({ plant, categories, onSaved, initiallyEditing = false }: { plant: Plant; categories: string[]; onSaved: (plant: Plant) => void; initiallyEditing?: boolean }) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [value, setValue] = useState(plant.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const inputId = useId();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !value.trim()) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/plants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: plant.id, category: value.trim() }) });
      const payload = await response.json();
      if (!response.ok || !payload.plant) throw new Error(payload.message ?? "대분류 변경에 실패했습니다.");
      onSaved(payload.plant as Plant); setEditing(false); setMessage("대분류를 변경했습니다.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "대분류 변경에 실패했습니다."); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <section aria-label="대분류 변경" className="border-t border-[#ECEEF1] pt-3">
    {editing ? <form onSubmit={save} className="flex items-end gap-2"><label htmlFor={inputId} className="min-w-0 flex-1"><span className="mb-2 block text-xs font-medium text-[#8B929B]">대분류</span><select autoFocus id={inputId} aria-label="대분류" value={value} onChange={(event) => setValue(event.target.value)} disabled={saving} className="field">{[...new Set([plant.category, ...categories])].filter(Boolean).map((category) => <option key={category} value={category}>{category}</option>)}</select></label><button type="submit" disabled={saving || !value.trim()} aria-label="대분류 저장" title="대분류 저장" className="grid h-12 w-11 shrink-0 place-items-center rounded-lg bg-[#4263EB] text-white disabled:opacity-40"><Check size={19} /></button><button type="button" disabled={saving} onClick={() => { setEditing(false); setError(""); }} aria-label="대분류 변경 취소" title="대분류 변경 취소" className="icon-button"><X size={19} /></button></form> : <div className="flex items-center justify-between gap-3"><p className="text-sm"><span className="mr-3 text-[#8B929B]">대분류</span><span className="font-semibold">{plant.category}</span></p><button type="button" onClick={() => { setValue(plant.category); setMessage(""); setEditing(true); }} aria-label="대분류 변경" title="대분류 변경" className="icon-button"><Pencil size={17} /></button></div>}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : message ? <p role="status" className="mt-2 text-xs text-[#4263EB]">{message}</p> : null}
  </section>;
}
