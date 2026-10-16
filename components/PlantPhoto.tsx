"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export function PlantPhoto({ src, alt, contain = false, priority = false }: { src: string; alt: string; contain?: boolean; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <>
    {!loaded && !failed ? <span role="status" aria-label="사진 불러오는 중" className="photo-skeleton"><span className="photo-skeleton-shine" /></span> : null}
    {failed ? <span role="status" className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-[#F5F6F8] text-xs text-[#8B929B]"><ImageOff size={24} aria-hidden="true" /><span>사진을 불러오지 못했어요.</span></span> : null}
    <Image src={src} alt={alt} fill sizes="(max-width: 440px) 100vw, 440px" unoptimized priority={priority} className={`${contain ? "object-contain" : "object-cover object-center"} transition-opacity duration-200 ${loaded && !failed ? "opacity-100" : "opacity-0"}`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
  </>;
}
