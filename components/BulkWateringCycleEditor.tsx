"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { PlantDialog } from "@/components/PlantDialog";
import type { Plant } from "@/types/plant";

type Target = { id: string; name: string; previous?: number; next: number };
export function BulkWateringCycleEditor({ plants, onSaved, onClose }: { plants: Plant[]; onSaved: (plant: Plant) => void; onClose: () => void }) {
  const [targets] = useState(() => plants.map((plant) => ({ id: plant.id, name: plant.name, previous: plant.wateringCycleDays })));
  const [amount, setAmount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Target[] | null>(null);
  const busy = useRef(false);
  const delta = Number(amount);
  const preview = plan ?? targets.map((plant) => ({ ...plant, next: (plant.previous ?? 0) + delta }));
  const valid = amount.trim() && Number.isSafeInteger(delta) && delta !== 0 && preview.every((plant) => Number.isFinite(plant.next) && plant.next >= 1);
  const pending = preview.filter((plant) => results[plant.id] !== true);
  const finished = preview.length > 0 && pending.length === 0;

  async function save() {
    if (busy.current || !valid || !pending.length) return;
    busy.current = true; setSaving(true); setError("");
    // Retry the same absolute targets, never add the delta a second time.
    if (!plan) setPlan(preview);
    for (const target of pending) {
      try {
        const response = await fetch("/api/plants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantId: target.id, wateringCycleDays: target.next }) });
        const payload = await response.json();
        if (!response.ok || !payload.plant) throw new Error("save failed");
        onSaved(payload.plant as Plant);
        setResults((current) => ({ ...current, [target.id]: true }));
      } catch {
        setResults((current) => ({ ...current, [target.id]: false }));
        setError("저장하지 못한 식물이 있어요. 실패한 식물만 다시 저장할 수 있어요.");
      }
    }
    busy.current = false; setSaving(false);
  }

  return <PlantDialog title="관수 주기 편집" closeDisabled={saving} onClose={() => { if (!busy.current) onClose(); }}>
    {!targets.length ? <p className="text-sm leading-6 text-[#8B929B]">물주기 목록에서 편집할 식물의 체크박스를 먼저 선택해주세요.</p> : <>
      <p className="text-sm text-[#8B929B]">선택한 {targets.length}개 식물의 기존 주기에 일수를 더해요.</p>
      <div className="cycle-stepper" aria-label="관수 주기 추가 일수">
        <button type="button" disabled={saving || Boolean(plan)} onClick={() => setAmount(String((Number.isFinite(delta) ? delta : 0) - 1))} aria-label="1일 줄이기" title="1일 줄이기"><Minus size={20} /></button>
        <label><input aria-label="추가할 일수" type="number" step="1" value={amount} disabled={saving || Boolean(plan)} onChange={(event) => setAmount(event.target.value)} /><span>일</span></label>
        <button type="button" disabled={saving || Boolean(plan)} onClick={() => setAmount(String((Number.isFinite(delta) ? delta : 0) + 1))} aria-label="1일 늘리기" title="1일 늘리기"><Plus size={20} /></button>
      </div>
      {!valid ? <p className="mb-3 text-xs text-red-700">0이 아닌 정수를 입력하고, 변경 후 주기가 1일 이상이 되게 해주세요.</p> : null}
      <ul className="cycle-preview">{preview.map((plant) => <li key={plant.id}><span>{plant.name}</span><span>{plant.previous === undefined ? "미설정" : `${plant.previous}일`} → {Number.isFinite(plant.next) ? `${plant.next}일` : "—"}<small>{results[plant.id] === true ? "저장 완료" : results[plant.id] === false ? "저장 실패" : ""}</small></span></li>)}</ul>
      {error && !finished ? <p role="alert" className="mb-3 text-xs leading-5 text-red-700">{error}</p> : null}
      {finished ? <p role="status" className="mb-3 text-sm text-[#4263EB]">선택한 식물의 관수 주기를 변경했어요.</p> : null}
      <button type="button" disabled={saving || (!finished && !valid)} onClick={() => { if (finished) onClose(); else void save(); }} className="primary-button">{saving ? "저장 중..." : finished ? "완료" : plan ? "실패한 식물 다시 저장" : "변경 저장"}</button>
    </>}
  </PlantDialog>;
}
