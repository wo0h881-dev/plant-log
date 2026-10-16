"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { PlantPhotoUploader } from "@/components/PlantPhotoUploader";
import type { Plant } from "@/types/plant";

type Props = {
  categories: string[]; purchaseSources: string[];
  onClose: () => void; onCreated: (plant: Plant) => void;
};

export function AddPlantForm({ categories, purchaseSources, onClose, onCreated }: Props) {
  const [values, setValues] = useState({ name: "", purchaseSource: "", adoptedAt: "", price: "", category: "", wateringCycleDays: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const hasContent = photos.length > 0 || Object.values(values).some((value) => value.trim());
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
        </section>
      </fieldset>
      {error ? <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={!hasContent || saving || isCompressing} className="primary-button">{saving ? "등록 중..." : isCompressing ? "사진 처리 중..." : <><Plus size={18} />식물 등록</>}</button>
    </form>
  );
}
