"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { PlantDialog } from "@/components/PlantDialog";
import { formatFertilizerMix, type FertilizerMix } from "@/lib/fertilizer";

const hiddenKey = "plant-log:hidden-fertilizers";
const tagKey = (name: string) => name.trim().toLowerCase();

export function FertilizerPicker({ selected, selectedMix, onSelect, onRemove, onClose }: { selected: string[]; selectedMix: Record<string, FertilizerMix>; onSelect: (names: string[], mixes: Record<string, FertilizerMix>) => void; onRemove: (name: string) => void; onClose: () => void }) {
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]"); return Array.isArray(data) ? data.filter((item) => typeof item === "string") : []; }
    catch { return []; }
  });
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [names, setNames] = useState(selected);
  const [mix, setMix] = useState(selectedMix);
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

  function choose(value: string) {
    if (!value) { setNames([]); setMix({}); return; }
    setNames((current) => current.includes(value) ? current.filter((name) => name !== value) : current.length < 20 ? [...current, value] : current);
  }
  function updateHidden(next: string[]) {
    setHidden(next);
    try { localStorage.setItem(hiddenKey, JSON.stringify(next)); } catch { /* Keep the current picker usable. */ }
  }
  const allTags = [...new Set([...options, ...selected, ...names])];
  const tags = allTags.filter((tag) => !hidden.includes(tagKey(tag)));
  const invalidMix = names.some((name) => { const value = mix[name]; return value && Boolean(value.water || value.fertilizer) && !formatFertilizerMix(value); });

  return <PlantDialog title="비료 선택" onClose={onClose}>
    <div className="space-y-4">
      <div className="status-chips" aria-label="비료 종류" role="group">
        <button type="button" className="status-chip" aria-pressed={!names.length} onClick={() => choose("")}>비료 없음</button>
        {tags.map((tag) => <div className="fertilizer-tag" key={tag} data-active={names.includes(tag)}>
          <button type="button" aria-pressed={names.includes(tag)} disabled={!names.includes(tag) && names.length >= 20} onClick={() => choose(tag)}>{tag}</button>
          <button type="button" aria-label={`${tag} 목록에서 숨기기`} title="이 브라우저의 목록에서 숨기기" onClick={() => { updateHidden([...hidden, tagKey(tag)]); setNames((current) => current.filter((name) => name !== tag)); onRemove(tag); }}><X size={15} aria-hidden="true" /></button>
        </div>)}
      </div>
      {status === "loading" ? <p role="status" className="text-xs text-[#8B929B]">비료 목록을 불러오는 중이에요.</p> : null}
      {status === "error" ? <p role="alert" className="text-xs text-red-700">저장된 비료 목록을 불러오지 못했어요.</p> : null}
      <form className="flex items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (!name || /[,\r\n]/.test(name)) { setError("쉼표 없이 비료 이름을 입력해주세요."); return; }
        if (hidden.includes(tagKey(name))) updateHidden(hidden.filter((key) => key !== tagKey(name)));
        const value = allTags.find((tag) => tagKey(tag) === tagKey(name)) ?? name;
        if (!names.includes(value)) { if (names.length >= 20) { setError("비료는 한 번에 20개까지 선택할 수 있어요."); return; } setNames([...names, value]); }
        setOptions((current) => [...new Set([...current, value])]);
        setDraft("");
      }}>
        <label className="min-w-0 flex-1 text-xs font-semibold">새 비료 이름<input value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} className="field mt-2" maxLength={100} /></label>
        <button type="submit" disabled={!draft.trim()} aria-label="새 비료 선택" title="새 비료 선택" className="icon-button shrink-0"><Plus size={20} /></button>
      </form>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
      {names.map((name) => {
        const value = mix[name] ?? { water: "", fertilizer: "" };
        const ratio = formatFertilizerMix(value);
        return <fieldset key={name} className="grid grid-cols-2 gap-2">
          <legend className="mb-2 break-words text-sm font-semibold">{names.length === 1 ? "비료 비율" : `${name} 비율`}</legend>
          <label className="min-w-0 text-xs">물 (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={value.water} onChange={(event) => setMix({ ...mix, [name]: { ...value, water: event.target.value } })} /></label>
          <label className="min-w-0 text-xs">비료 (mL)<input className="field mt-2" inputMode="decimal" maxLength={12} value={value.fertilizer} onChange={(event) => setMix({ ...mix, [name]: { ...value, fertilizer: event.target.value } })} /></label>
          {ratio ? <output className="col-span-2 break-words text-sm font-semibold text-[#4263EB]">{ratio}</output> : null}
        </fieldset>;
      })}
      {invalidMix ? <p className="text-xs text-red-700">입력한 비료의 물과 비료 양을 모두 0보다 큰 숫자로 입력해주세요. 소수점 아래 세 자리까지 쓸 수 있어요.</p> : null}
      <button type="button" className="primary-button" disabled={Boolean(draft.trim()) || invalidMix} onClick={() => { onSelect(names, Object.fromEntries(names.map((name) => [name, mix[name] ?? { water: "", fertilizer: "" }]))); onClose(); }}>적용</button>
    </div>
  </PlantDialog>;
}
