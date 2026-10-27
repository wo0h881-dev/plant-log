"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import { canSelectPlant, matchesPlantSearch } from "@/lib/plant-search";
import type { Plant } from "@/types/plant";

type Props = {
  categories: string[]; purchaseSources: string[]; plants: Plant[];
  onClose: () => void; onCreated: (plant: Plant) => void;
};

export function AddPlantForm({ categories, purchaseSources, plants, onClose, onCreated }: Props) {
  const [values, setValues] = useState({ name: "", purchaseSource: "", adoptedAt: "", price: "", category: "", wateringCycleDays: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [motherPlantIds, setMotherPlantIds] = useState<string[]>([]);
  const [motherQuery, setMotherQuery] = useState("");
  const [mothersOpen, setMothersOpen] = useState(false);
  const submitting = useRef(false);
  const hasContent = photos.length > 0 || motherPlantIds.length > 0 || Object.values(values).some((value) => value.trim());
  const fieldClass = "field";

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!hasContent || isCompressing || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      if (photos.reduce((size, file) => size + file.size, 0) > 4_000_000 || photos.length > 20) throw new Error("사진은 압축 후 합계 4MB 이하, 20장 이내로 선택해주세요.");
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.append(key, value.trim()));
      form.append("motherPlantIds", JSON.stringify(motherPlantIds));
      photos.forEach((photo) => form.append("photos", photo));
      const response = await fetch("/api/plants", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "등록에 실패했습니다.");
      if (!payload.plant) throw new Error("등록은 완료했지만 식물 정보를 불러오지 못했습니다. 새로고침해주세요.");
      onCreated(payload.plant as Plant);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "등록에 실패했습니다.");
    } finally { submitting.current = false; setSaving(false); }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <header className="screen-header"><h1 className="screen-title">새 식물</h1><button type="button" onClick={onClose} disabled={saving} aria-label="식물 등록 닫기" title="식물 등록 닫기" className="icon-button"><ArrowLeft size={20} /></button></header>
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        <PlantPhotoUploader files={photos} onChange={setPhotos} onCaptureDateChange={() => undefined} onBusyChange={setIsCompressing} title="새 식물 사진" />
        {photos.length ? <p className="text-xs text-[#777B74]">첫 번째 사진이 커버사진이 됩니다.</p> : null}
        <section className="space-y-5">
          {([
            ["name", "식물명", "text", undefined],
            ["purchaseSource", "구매처", "text", "purchase-sources"],
            ["adoptedAt", "입양날짜", "date", undefined],
            ["price", "가격 (원)", "number", undefined],
            ["category", "대분류", "text", "plant-categories"],
            ["wateringCycleDays", "관수 주기 (일)", "number", undefined],
          ] as const).map(([key, label, type, list]) => <label key={key} className="block"><span className="mb-2 block text-sm font-bold">{label}</span><input type={type} list={list} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} maxLength={100} min={key === "wateringCycleDays" ? 1 : 0} step={key === "price" ? "1" : "any"} className={fieldClass} /></label>)}
          <datalist id="plant-categories">{categories.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="purchase-sources">{purchaseSources.map((value) => <option key={value} value={value} />)}</datalist>
          <section aria-label="모주 선택">
            <button type="button" onClick={() => setMothersOpen((open) => !open)} aria-expanded={mothersOpen} className="flex min-h-12 w-full items-center justify-between text-left text-sm font-bold"><span>모주</span><span className="text-xs font-medium text-[#8B929B]">{motherPlantIds.length ? `${motherPlantIds.length}개 선택` : "선택 안 함"}</span></button>
            {motherPlantIds.length ? <div className="mb-2 flex flex-wrap gap-2">{plants.filter((plant) => motherPlantIds.includes(plant.id)).map((plant) => <button key={plant.id} type="button" onClick={() => setMotherPlantIds((ids) => ids.filter((id) => id !== plant.id))} aria-label={`${plant.name} 모주 선택 해제`} className="rounded-md bg-[#EEF2FF] px-3 py-2 text-xs text-[#4263EB]">{plant.name} ×</button>)}</div> : null}
            {mothersOpen ? <div><input type="search" value={motherQuery} onChange={(event) => setMotherQuery(event.target.value)} aria-label="모주 검색" placeholder="모주 검색" className="field" /><div className="mt-2 max-h-56 overflow-y-auto">{plants.filter((plant) => canSelectPlant(plant) && matchesPlantSearch(plant, motherQuery)).map((plant) => <label key={plant.id} className="flex min-h-12 items-center gap-3 border-b border-[#ECEEF1] py-2 text-sm"><input type="checkbox" checked={motherPlantIds.includes(plant.id)} onChange={() => setMotherPlantIds((ids) => ids.includes(plant.id) ? ids.filter((id) => id !== plant.id) : [...ids, plant.id])} className="h-5 w-5 shrink-0 accent-[#4263EB]" /><span className="min-w-0 flex-1 break-words">{plant.name}</span><span className="text-[11px] text-[#909090]">{plant.category}</span></label>)}</div></div> : null}
          </section>
        </section>
      </fieldset>
      {error ? <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={!hasContent || saving || isCompressing} className="primary-button">{saving ? "등록 중..." : isCompressing ? "사진 처리 중..." : <><Plus size={18} />식물 등록</>}</button>
    </form>
  );
}
