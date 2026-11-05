"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { PlantDialog } from "@/components/PlantDialog";
import { formatFertilizerBatches, formatFertilizerMix, type FertilizerBatch } from "@/lib/fertilizer";

const hiddenKey = "plant-log:hidden-fertilizers";
const tagKey = (name: string) => name.trim().toLowerCase();

type DraftBatch = FertilizerBatch & { id: string; amounts: Record<string, string> };
const emptyBatch = (): DraftBatch => ({ id: crypto.randomUUID(), water: "", fertilizers: [], amounts: {} });

export function FertilizerPicker({ selected, onSelect, onRemove, onClose }: { selected: FertilizerBatch[]; onSelect: (batches: FertilizerBatch[]) => void; onRemove: (name: string) => void; onClose: () => void }) {
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]"); return Array.isArray(data) ? data.filter((item) => typeof item === "string") : []; }
    catch { return []; }
  });
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [batches, setBatches] = useState<DraftBatch[]>(() => selected.length ? selected.map((batch) => ({ ...batch, id: crypto.randomUUID(), amounts: Object.fromEntries(batch.fertilizers.map((item) => [item.name, item.amount])) })) : [emptyBatch()]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/watering-logs?options=fertilizer", { signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.options)) throw new Error();
      setOptions(payload.options);
      setStatus("ready");
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  function updateBatch(id: string, update: (batch: DraftBatch) => DraftBatch) {
    setBatches((current) => current.map((batch) => batch.id === id ? update(batch) : batch));
  }
  function updateHidden(next: string[]) {
    setHidden(next);
    try { localStorage.setItem(hiddenKey, JSON.stringify(next)); } catch { /* Keep the current picker usable. */ }
  }
  const names = batches.flatMap((batch) => batch.fertilizers.map((item) => item.name));
  const allTags = [...new Set([...options, ...selected.flatMap((batch) => batch.fertilizers.map((item) => item.name)), ...names])];
  const tags = allTags.filter((tag) => !hidden.includes(tagKey(tag)));
  const activeBatches = batches.filter((batch) => batch.fertilizers.length);
  const summary = formatFertilizerBatches(activeBatches);
  const invalidMix = batches.some((batch) => {
    if (!batch.fertilizers.length) return Boolean(batch.water);
    if (!batch.water && batch.fertilizers.every((item) => !item.amount)) return false;
    return batch.fertilizers.some((item) => !formatFertilizerMix({ water: batch.water, fertilizer: item.amount }));
  });

  return <PlantDialog title="비료 선택" onClose={onClose}>
    <div className="space-y-4">
      <button type="button" className="status-chip" aria-pressed={!names.length} onClick={() => setBatches([emptyBatch()])}>비료 없음</button>
      {status === "loading" ? <p role="status" className="text-xs text-[#8B929B]">비료 목록을 불러오는 중이에요.</p> : null}
      {status === "error" ? <p role="alert" className="text-xs text-red-700">저장된 비료 목록을 불러오지 못했어요.</p> : null}
      <form className="flex items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (!name || /[,\r\n]/.test(name)) { setError("쉼표 없이 비료 이름을 입력해주세요."); return; }
        if (hidden.includes(tagKey(name))) updateHidden(hidden.filter((key) => key !== tagKey(name)));
        const value = allTags.find((tag) => tagKey(tag) === tagKey(name)) ?? name;
        setOptions((current) => [...new Set([...current, value])]);
        setDraft("");
      }}>
        <label className="min-w-0 flex-1 text-xs font-semibold">새 비료 이름<input value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} className="field mt-2" maxLength={100} /></label>
        <button type="submit" disabled={!draft.trim()} aria-label="새 비료 선택" title="새 비료 선택" className="icon-button shrink-0"><Plus size={20} /></button>
      </form>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
      {batches.map((batch, index) => <fieldset key={batch.id} className="min-w-0 space-y-3 border-t border-[#ECEEF2] pt-4">
        <legend className="text-sm font-semibold">물통 {index + 1}</legend>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">물 (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={batch.water} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, water: event.target.value }))} /></label>
          {batches.length > 1 ? <button type="button" className="icon-button shrink-0" aria-label={`물통 ${index + 1} 삭제`} title="이 물통 지우기" onClick={() => setBatches((current) => current.filter((item) => item.id !== batch.id))}><X size={18} /></button> : null}
        </div>
        <div className="status-chips" aria-label={`물통 ${index + 1} 비료 종류`} role="group">
          {tags.map((tag) => {
            const chosen = batch.fertilizers.some((item) => item.name === tag);
            return <div className="fertilizer-tag" key={tag} data-active={chosen}>
              <button type="button" aria-pressed={chosen} disabled={!chosen && names.length >= 20} onClick={() => updateBatch(batch.id, (current) => ({ ...current, fertilizers: chosen ? current.fertilizers.filter((item) => item.name !== tag) : [...current.fertilizers, { name: tag, amount: current.amounts[tag] ?? "" }] }))}>{tag}</button>
              <button type="button" aria-label={`${tag} 목록에서 숨기기`} title="이 브라우저의 목록에서 숨기기" onClick={() => { updateHidden([...hidden, tagKey(tag)]); setBatches((current) => current.map((item) => { const fertilizers = item.fertilizers.filter((value) => value.name !== tag); return { ...item, fertilizers, water: fertilizers.length ? item.water : "" }; })); onRemove(tag); }}><X size={15} aria-hidden="true" /></button>
            </div>;
          })}
        </div>
        {batch.fertilizers.map((item) => <label key={item.name} className="block min-w-0 break-words text-xs">{item.name} (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={item.amount} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, amounts: { ...current.amounts, [item.name]: event.target.value }, fertilizers: current.fertilizers.map((value) => value.name === item.name ? { ...value, amount: event.target.value } : value) }))} /></label>)}
      </fieldset>)}
      <button type="button" className="status-chip" disabled={batches.length >= 5} onClick={() => setBatches((current) => [...current, emptyBatch()])}><Plus size={15} aria-hidden="true" />물통 추가</button>
      {summary ? <output className="block whitespace-pre-line break-words text-sm font-semibold text-[#4263EB]">{summary}</output> : null}
      {invalidMix ? <p className="text-xs text-red-700">물통마다 비료를 선택하고 물과 각 비료의 양을 모두 0보다 큰 숫자로 입력해주세요. 양을 기록하지 않으려면 해당 물통의 숫자를 모두 비워주세요.</p> : null}
      <button type="button" className="primary-button" disabled={Boolean(draft.trim()) || invalidMix || summary.length > 4000} onClick={() => { onSelect(activeBatches.map(({ water, fertilizers }) => ({ water, fertilizers }))); onClose(); }}>적용</button>
    </div>
  </PlantDialog>;
}
