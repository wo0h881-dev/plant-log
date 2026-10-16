"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useId, useMemo, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
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
  const previews = useMemo(
    () => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setError("");

    if (!selected.length) {
      onChange([]);
      onCaptureDateChange(null);
      return;
    }

    const imageFiles = selected.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== selected.length) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    setIsCompressing(true);
    onBusyChange?.(true);
    try {
      const captureDate = await readCaptureDate(imageFiles[0]).catch(() => null);
      const compressedFiles = await Promise.all(imageFiles.map((file) => compressImage(file)));
      onChange(compressedFiles);
      onCaptureDateChange(captureDate);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "사진 처리에 실패했습니다.");
    } finally {
      setIsCompressing(false);
      onBusyChange?.(false);
      event.target.value = "";
    }
  }

  return (
    <section className="overflow-hidden rounded-lg bg-[#F5F6F8]">
      <label
        htmlFor={inputId}
        className="relative flex min-h-[190px] cursor-pointer flex-col items-center justify-center text-center transition active:opacity-90"
      >
        {previews.length ? (
          <div className="grid min-h-[224px] w-full grid-cols-2 gap-1">
            {previews.slice(0, 4).map((preview, index) => (
              <div key={preview.url} className={`relative overflow-hidden bg-white ${previews.length === 1 ? "col-span-2 min-h-[224px]" : "min-h-28"}`}>
                <Image
                  src={preview.url}
                  alt={preview.name}
                  width={180}
                  height={180}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                {index === 3 && previews.length > 4 ? (
                  <div className="absolute inset-0 grid place-items-center bg-stone-950/50 text-lg font-bold text-white">
                    +{previews.length - 4}
                  </div>
                ) : null}
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
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-lg bg-[#191F28] text-white">
          <Camera size={19} aria-hidden="true" />
        </span>
        {previews.length ? (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-2 text-xs font-black text-stone-800 backdrop-blur">
            {isCompressing ? "사진 압축 중..." : `${files.length}장 선택됨`}
          </span>
        ) : null}
      </label>
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
