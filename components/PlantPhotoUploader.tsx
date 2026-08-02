"use client";

import Image from "next/image";
import { ChangeEvent, useId, useState } from "react";
import { compressImage } from "@/lib/imageCompression";

type PlantPhotoUploaderProps = {
  file: File | null;
  onChange: (file: File | null) => void;
};

export function PlantPhotoUploader({ file, onChange }: PlantPhotoUploaderProps) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError("");

    if (!selected) {
      onChange(null);
      setPreviewUrl(null);
      return;
    }

    if (!selected.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    setIsCompressing(true);
    try {
      const compressed = await compressImage(selected);
      onChange(compressed);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(compressed);
      });
    } catch (compressionError) {
      setError(compressionError instanceof Error ? compressionError.message : "사진 처리에 실패했습니다.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-white/80 p-4 shadow-sm shadow-emerald-950/5">
      <label
        htmlFor={inputId}
        className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-lime-50 px-4 text-center"
      >
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={file?.name ?? "업로드한 식물 사진"}
            width={320}
            height={320}
            className="h-48 w-full rounded-[1.25rem] object-cover"
            unoptimized
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-[1.75rem] bg-white text-4xl shadow-sm">
            🌿
          </div>
        )}
        <span className="mt-4 text-base font-semibold text-stone-950">
          {file ? "사진 다시 선택" : "식물 사진 선택"}
        </span>
        <span className="mt-1 text-sm text-stone-500">
          {isCompressing ? "사진 압축 중..." : "카메라 또는 갤러리에서 선택"}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
      />
      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
