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
    <section className="overflow-hidden rounded-[30px] bg-[#DCE7D5]">
      <label
        htmlFor={inputId}
        className="relative flex min-h-[258px] cursor-pointer flex-col items-center justify-center text-center transition active:opacity-90"
      >
        {previews.length ? (
          <div className="grid min-h-[258px] w-full grid-cols-2 gap-1">
            {previews.slice(0, 4).map((preview, index) => (
              <div key={preview.url} className={`relative overflow-hidden bg-white ${previews.length === 1 ? "col-span-2 min-h-[258px]" : "min-h-32"}`}>
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
            <ImagePlus size={58} strokeWidth={1} className="text-[#284F2A]/25" aria-hidden="true" />
            <div className="mt-4">
              <span className="block text-lg font-black text-[#284F2A]">오늘의 식물을 보여주세요</span>
              <span className="mt-1 block text-sm font-medium text-[#687565]">여러 장을 한 번에 선택할 수 있어요</span>
            </div>
          </>
        )}
        <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-[#151515] text-white shadow-lg shadow-black/20">
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
        className="sr-only"
        onChange={handleChange}
      />
      {error ? <p className="bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
