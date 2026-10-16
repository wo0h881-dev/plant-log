"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { parse } from "exifr";
import { compressImage } from "@/lib/imageCompression";

type PlantPhotoUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  onCaptureDateChange: (date: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  title?: string;
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readCaptureDate(file: File) {
  const metadata = await parse(file, ["DateTimeOriginal", "CreateDate"]);
  const value = metadata?.DateTimeOriginal ?? metadata?.CreateDate;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? formatLocalDate(date) : null;
}

export function PlantPhotoUploader({ files, onChange, onCaptureDateChange, onBusyChange, title = "사진 추가" }: PlantPhotoUploaderProps) {
  const inputId = useId();
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState("");
  const processing = useRef(false);
  const previews = useMemo(
    () => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);
    input.value = "";
    if (processing.current || !selected.length) return;
    setError("");
    if (files.length + selected.length > 20) { setError("사진은 총 20장까지 선택할 수 있어요."); return; }

    const imageFiles = selected.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== selected.length) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    processing.current = true;
    setIsCompressing(true);
    onBusyChange?.(true);
    try {
      const captureDate = !files.length ? await readCaptureDate(imageFiles[0]).catch(() => null) : null;
      const compressedFiles: File[] = [];
      for (const file of imageFiles) compressedFiles.push(await compressImage(file));
      const nextFiles = [...files, ...compressedFiles];
      if (nextFiles.reduce((size, file) => size + file.size, 0) > 4_000_000) throw new Error("사진은 압축 후 합계 4MB 이하로 선택해주세요.");
      onChange(nextFiles);
      if (!files.length) onCaptureDateChange(captureDate);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "사진 처리에 실패했습니다.");
    } finally {
      setIsCompressing(false);
      processing.current = false;
      onBusyChange?.(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg bg-[#F5F6F8]">
      <div
        className="relative flex min-h-[190px] flex-col items-center justify-center text-center"
      >
        {previews.length ? (
          <div className="grid min-h-[224px] w-full grid-cols-2 gap-1">
            {previews.map((preview, index) => (
              <div key={preview.url} className={`relative overflow-hidden bg-white ${previews.length === 1 ? "col-span-2 min-h-[224px]" : "min-h-28"}`}>
                <Image
                  src={preview.url}
                  alt={preview.name}
                  width={180}
                  height={180}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                <button type="button" disabled={isCompressing} onClick={() => { onChange(files.filter((_, position) => position !== index)); }} aria-label={`사진 ${index + 1} 삭제`} title="사진 삭제" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white"><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <ImagePlus size={29} strokeWidth={1.5} className="text-[#A7AFB8]" aria-hidden="true" />
            <div className="mt-3">
              <span className="block text-sm font-semibold text-[#626B76]">{isCompressing ? "사진 압축 중..." : title}</span>
              <span className="mt-1 block text-xs text-[#9AA1AA]">{files.length ? `${files.length}장` : "오늘의 식물 모습"}</span>
            </div>
          </>
        )}
        {previews.length ? (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-2 text-xs font-black text-stone-800 backdrop-blur">
            {isCompressing ? "사진 압축 중..." : `${files.length}장 선택됨`}
          </span>
        ) : null}
      </div>
      <label htmlFor={inputId} className={`flex min-h-12 items-center justify-center gap-2 border-t border-white px-4 text-sm font-semibold text-[#4263EB] ${isCompressing ? "pointer-events-none opacity-50" : "cursor-pointer"}`}><Camera size={19} aria-hidden="true" />{isCompressing ? "사진 처리 중..." : title}</label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={isCompressing}
        className="sr-only"
        onChange={handleChange}
      />
      {error ? <p className="bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
