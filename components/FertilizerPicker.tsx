"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { PlantDialog } from "@/components/PlantDialog";
import { fertilizerBatchName, fertilizerBatchNameLimit, formatFertilizerBatches, formatFertilizerMix, type FertilizerBatch } from "@/lib/fertilizer";
import { clearFertilizerDraft, emptyBatch, newFertilizerDraft, readFertilizerDraft, writeFertilizerDraft, type DraftBatch } from "@/lib/fertilizer-draft";

const hiddenKey = "plant-log:hidden-fertilizers";
const tagKey = (name: string) => name.trim().toLowerCase();

export function FertilizerPicker({ selected, selectedIndex = 0, onSelect, onClose }: { selected: FertilizerBatch[]; selectedIndex?: number; onSelect: (batches: FertilizerBatch[], index: number) => Promise<void>; onClose: () => void }) {
  const [initial] = useState(() => { const cached = readFertilizerDraft(); return { state: cached ?? newFertilizerDraft(selected, selectedIndex), restored: Boolean(cached) }; });
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]"); return Array.isArray(data) ? data.filter((item) => typeof item === "string") : []; }
    catch { return []; }
  });
  const [options, setOptions] = useState(initial.state.options);
  const [draft, setDraft] = useState(initial.state.name);
  const [batches, setBatches] = useState<DraftBatch[]>(initial.state.batches);
  const [activeIndex, setActiveIndex] = useState(initial.state.activeIndex);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const submitting = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/watering-logs?options=fertilizer", { signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.options)) throw new Error();
      setOptions((current) => [...new Set([...current, ...payload.options])]);
      setStatus("ready");
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const saved = writeFertilizerDraft({ version: 1, batches, activeIndex, options, name: draft });
    if (!saved) void Promise.resolve().then(() => setStorageError(true));
  }, [batches, activeIndex, options, draft]);

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
  const activeBatch = batches[activeIndex];
  const invalidMix = batches.some((batch) => {
    if (!batch.fertilizers.length) return Boolean(batch.water);
    if (!batch.water && batch.fertilizers.every((item) => !item.amount)) return false;
    return batch.fertilizers.some((item) => !formatFertilizerMix({ water: batch.water, fertilizer: item.amount }));
  });

  async function save() {
    if (submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      await onSelect(activeBatches.map(({ name, water, fertilizers }) => ({ ...(name?.trim() ? { name: name.trim() } : {}), water, fertilizers })), Math.max(0, activeBatches.indexOf(activeBatch)));
      clearFertilizerDraft(); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "물통을 저장하지 못했어요."); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <PlantDialog title="비료 선택" onClose={() => { if (!saving) onClose(); }} closeDisabled={saving}>
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      {initial.restored ? <p role="status" className="text-xs text-[#4263EB]">작성 중인 내용이 복원됐어요.</p> : null}
      {storageError ? <p role="alert" className="text-xs text-red-700">기기의 저장 공간을 사용할 수 없어 새로고침하면 작성 중인 내용이 사라질 수 있어요.</p> : null}
      <div className="status-chips" aria-label={`${fertilizerBatchName(activeBatch, activeIndex)} 비료 종류`} role="group">
        <button type="button" className="status-chip" onClick={() => { setBatches([emptyBatch()]); setActiveIndex(0); }}>물통 전체 비우기</button>
        <button type="button" className="status-chip" disabled={batches.length >= 5} onClick={() => { setBatches((current) => [...current, emptyBatch()]); setActiveIndex(batches.length); }}><Plus size={15} aria-hidden="true" />물통 추가</button>
        {tags.map((tag) => {
          const chosen = activeBatch.fertilizers.some((item) => item.name === tag);
          return <div className="fertilizer-tag" key={tag} data-active={chosen}>
            <button type="button" aria-pressed={chosen} disabled={!chosen && names.length >= 20} onClick={() => updateBatch(activeBatch.id, (current) => ({ ...current, fertilizers: chosen ? current.fertilizers.filter((item) => item.name !== tag) : [...current.fertilizers, { name: tag, amount: current.amounts[tag] ?? "" }] }))}>{tag}</button>
            <button type="button" aria-label={`${tag} 목록에서 숨기기`} title="이 브라우저의 목록에서 숨기기" onClick={() => { updateHidden([...hidden, tagKey(tag)]); setBatches((current) => current.map((item) => { const fertilizers = item.fertilizers.filter((value) => value.name !== tag); return { ...item, fertilizers, water: fertilizers.length ? item.water : "" }; })); }}><X size={15} aria-hidden="true" /></button>
          </div>;
        })}
      </div>
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
        <label className="min-w-0 flex-1 text-xs font-semibold">비료 추가<input aria-label="새 비료 이름" value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} className="field mt-2" maxLength={100} /></label>
        <button type="submit" disabled={!draft.trim()} aria-label="새 비료 선택" title="새 비료 선택" className="icon-button shrink-0"><Plus size={20} /></button>
      </form>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
      <h3 className="text-sm font-semibold">비율 만들기</h3>
      <div role="tablist" aria-label="편집할 물통" className="flex gap-2 overflow-x-auto pb-1">
        {batches.map((batch, index) => <button key={batch.id} type="button" role="tab" aria-selected={activeIndex === index} aria-controls={`fertilizer-batch-${batch.id}`} className="status-chip max-w-44 shrink-0" title={fertilizerBatchName(batch, index)} data-active={activeIndex === index} onClick={() => setActiveIndex(index)}><span className="truncate">{fertilizerBatchName(batch, index)}</span></button>)}
      </div>
      {batches.map((batch, index) => <fieldset id={`fertilizer-batch-${batch.id}`} key={batch.id} hidden={activeIndex !== index} className="min-w-0 space-y-3 border-t border-[#ECEEF2] pt-4">
        <legend className="max-w-full break-all text-sm font-semibold">{fertilizerBatchName(batch, index)}</legend>
        <label className="block text-xs">물통 이름<input className="field mt-2" maxLength={fertilizerBatchNameLimit} placeholder={`물통 ${index + 1}`} value={batch.name ?? ""} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, name: event.target.value }))} /></label>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">물 (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={batch.water} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, water: event.target.value }))} /></label>
          <button type="button" className="icon-button shrink-0" aria-label={`${fertilizerBatchName(batch, index)} 삭제`} title="이 물통 지우기" onClick={() => { setBatches((current) => current.length === 1 ? [emptyBatch()] : current.filter((item) => item.id !== batch.id)); setActiveIndex(Math.max(0, index - 1)); }}><X size={18} /></button>
        </div>
        {batch.fertilizers.map((item) => <label key={item.name} className="block min-w-0 break-words text-xs">{item.name} (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={item.amount} onChange={(event) => updateBatch(batch.id, (current) => ({ ...current, amounts: { ...current.amounts, [item.name]: event.target.value }, fertilizers: current.fertilizers.map((value) => value.name === item.name ? { ...value, amount: event.target.value } : value) }))} /></label>)}
      </fieldset>)}
      {activeBatch?.fertilizers.length ? <output className="block break-words text-xs font-semibold text-[#4263EB]">{formatFertilizerBatches([activeBatch], activeIndex)}</output> : null}
      {invalidMix ? <p className="text-xs text-red-700">물통마다 비료를 선택하고 물과 각 비료의 양을 모두 0보다 큰 숫자로 입력해주세요. 양을 기록하지 않으려면 해당 물통의 숫자를 모두 비워주세요.</p> : null}
      <button type="button" className="primary-button" disabled={saving || Boolean(draft.trim()) || invalidMix || summary.length > 4000 || Boolean(names.length && !activeBatch?.fertilizers.length)} onClick={() => { void save(); }}>{saving ? "저장 중..." : "물통 저장"}</button>
    </fieldset>
  </PlantDialog>;
}
