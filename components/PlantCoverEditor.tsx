"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { canOptimizePlantCover } from "@/lib/plant-cover";
import type { Plant, PlantPhotoSummary } from "@/types/plant";

export function PlantCoverEditor({ plant, onSaved, onClose }: { plant: Plant; onSaved: (plant: Plant) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [photos, setPhotos] = useState<PlantPhotoSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File>();
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const submitting = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden"; element?.showModal();
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/plant-photos?plantId=${encodeURIComponent(plant.id)}&all=true`, { signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message ?? "사진을 불러오지 못했습니다."); if (!controller.signal.aborted) setPhotos(payload.photos ?? []); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "사진을 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [plant.id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next) return;
    setError(""); setBusy(true);
    try { if (!next.type.startsWith("image/")) throw new Error("이미지 파일을 선택하세요."); setFile(await compressImage(next)); setSelectedId(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "사진 처리에 실패했습니다."); }
    finally { setBusy(false); event.target.value = ""; }
  }
  async function save() {
    if ((!file && !selectedId) || busy || submitting.current) return;
    submitting.current = true; setSaving(true); setError("");
    try {
      const form = new FormData(); form.set("plantId", plant.id);
      if (file) form.set("photo", file); else form.set("photoId", selectedId);
      const response = await fetch("/api/plant-cover", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.plant) throw new Error(payload.message ?? "커버 변경에 실패했습니다.");
      onSaved(payload.plant as Plant);
      if (payload.warning) setWarning(payload.warning); else onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "커버 변경에 실패했습니다."); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} onCancel={(event) => { if (busy || saving) event.preventDefault(); else onClose(); }} aria-label="커버사진 변경" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[400px] overflow-y-auto rounded-lg border-0 bg-white p-5 text-[#191F28] backdrop:bg-black/50">
    <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black">커버사진 변경</h2><button type="button" onClick={onClose} disabled={busy || saving} aria-label="커버 변경 닫기" title="닫기" className="grid h-10 w-10 place-items-center rounded-full bg-white"><X size={20} /></button></header>
    <fieldset disabled={busy || saving || Boolean(warning)} className="space-y-4 disabled:opacity-60">
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F5F6F8] text-sm font-semibold text-[#284F2A]"><ImagePlus size={19} />{busy ? "사진 압축 중..." : "새 사진 올리기"}<input type="file" accept="image/*" onChange={chooseFile} className="sr-only" /></label>
      {file && preview ? <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white"><Image src={preview} alt="새 커버사진 미리보기" fill unoptimized className="object-cover" /></div> : null}
      <h3 className="text-sm font-bold">등록된 사진</h3>
      {loading ? <p className="text-xs text-[#909090]">사진 목록을 불러오는 중...</p> : !photos.length ? <p className="text-xs text-[#909090]">등록된 사진이 없어요.</p> : <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1">{photos.map((photo) => <button key={photo.id} type="button" onClick={() => { setSelectedId(photo.id); setFile(undefined); }} aria-label={`${photo.name} 선택`} aria-pressed={selectedId === photo.id && !file} className={`relative aspect-square overflow-hidden rounded-xl bg-white ${selectedId === photo.id && !file ? "ring-2 ring-[#284F2A]" : ""}`}><Image src={photo.url} alt="" fill sizes="96px" unoptimized={!canOptimizePlantCover(photo.url)} className="object-cover" />{selectedId === photo.id && !file ? <span className="absolute right-1 top-1 rounded-full bg-[#284F2A] p-1 text-white"><Check size={14} /></span> : null}</button>)}</div>}
    </fieldset>
    {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
    {warning ? <p role="status" className="mt-3 text-xs text-[#82734C]">{warning}</p> : <button type="button" onClick={save} disabled={(!file && !selectedId) || busy || saving} className="primary-button mt-4">{saving ? "커버 변경 중..." : "커버로 지정"}</button>}
  </dialog>;
}
