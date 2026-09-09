"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useId, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { parse } from "exifr";
import { compressImage } from "@/lib/imageCompression";

type PlantPhotoUploaderProps = {
  files: File[];
  onChange: (files: File[]) => void;
  onCaptureDateChange: (date: string | null) => void;
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

export function PlantPhotoUploader({ files, onChange, onCaptureDateChange }: PlantPhotoUploaderProps) {
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
    try {
      const captureDate = await readCaptureDate(imageFiles[0]).catch(() => null);
      const compressedFiles = await Promise.all(imageFiles.map((file) => compressImage(file)));
      onChange(compressedFiles);
      onCaptureDateChange(captureDate);
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "사진 처리에 실패했습니다.");
    } finally {
      setIsCompressing(false);
      event.target.value = "";
    }
  }

  return (
    <section className="rounded-lg border border-dashed border-emerald-200 bg-[#edf8ef] p-3">
      <label
        htmlFor={inputId}
        className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-md bg-white/75 px-4 text-center transition active:bg-emerald-50"
      >
        {previews.length ? (
          <div className="grid w-full grid-cols-2 gap-2">
            {previews.slice(0, 4).map((preview, index) => (
              <div key={preview.url} className="relative h-28 overflow-hidden rounded-md bg-white">
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
          <div className="grid h-16 w-16 place-items-center rounded-full border border-amber-100 bg-[#fff1b8] text-emerald-800 shadow-sm">
            <ImagePlus size={28} aria-hidden="true" />
          </div>
        )}
        <span className="mt-4 text-base font-semibold text-stone-950">
          {files.length ? "사진 다시 고르기" : "오늘의 식물을 보여주세요"}
        </span>
        <span className="mt-1 text-sm text-stone-500">
          {isCompressing ? "사진 압축 중..." : files.length ? `${files.length}장 선택됨` : "여러 장을 한 번에 선택할 수 있어요"}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleChange}
      />
      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
