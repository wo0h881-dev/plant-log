"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PlantDialog } from "@/components/PlantDialog";

export function FertilizerPicker({ selected, onSelect, onClose }: { selected: string; onSelect: (name: string) => void; onClose: () => void }) {
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
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

  function choose(name: string) { onSelect(name); onClose(); }
  const tags = [...new Set([...options, ...(selected ? [selected] : [])])];

  return <PlantDialog title="비료 선택" onClose={onClose}>
    <div className="space-y-4">
      <div className="status-chips" aria-label="비료 종류" role="group">
        <button type="button" className="status-chip" aria-pressed={!selected} onClick={() => choose("")}>비료 없음</button>
        {tags.map((name) => <button type="button" className="status-chip min-w-0 break-all" key={name} aria-pressed={selected === name} onClick={() => choose(name)}>{name}</button>)}
      </div>
      {status === "loading" ? <p role="status" className="text-xs text-[#8B929B]">비료 목록을 불러오는 중이에요.</p> : null}
      {status === "error" ? <p role="alert" className="text-xs text-red-700">저장된 비료 목록을 불러오지 못했어요.</p> : null}
      <form className="flex items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (!name || /[,\r\n]/.test(name)) { setError("쉼표 없이 비료 이름을 입력해주세요."); return; }
        choose(tags.find((tag) => tag.trim().toLowerCase() === name.toLowerCase()) ?? name);
      }}>
        <label className="min-w-0 flex-1 text-xs font-semibold">새 비료 이름<input value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} className="field mt-2" maxLength={100} /></label>
        <button type="submit" disabled={!draft.trim()} aria-label="새 비료 선택" title="새 비료 선택" className="icon-button shrink-0"><Plus size={20} /></button>
      </form>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </div>
  </PlantDialog>;
}
