"use client";

import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { Sprout } from "lucide-react";
import { canOptimizePlantCover, coverIconLoader } from "@/lib/plant-cover";

const visibilityCallbacks = new WeakMap<Element, () => void>();
let visibilityObserver: IntersectionObserver | undefined;

function observeVisibility(element: Element, onVisible: () => void) {
  if (!("IntersectionObserver" in window)) { onVisible(); return () => undefined; }
  // A single observer handles clipped scroll lists as well as the page viewport.
  visibilityObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      visibilityCallbacks.get(entry.target)?.();
      visibilityCallbacks.delete(entry.target);
      visibilityObserver?.unobserve(entry.target);
    }
  }, { rootMargin: "48px", threshold: 0.01 });
  visibilityCallbacks.set(element, onVisible);
  visibilityObserver.observe(element);
  return () => { visibilityCallbacks.delete(element); visibilityObserver?.unobserve(element); };
}

export const PlantCoverThumbnail = memo(function PlantCoverThumbnail({ src }: { src?: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element || !src) return;
    return observeVisibility(element, () => setVisible(true));
  }, [src]);

  return <span ref={container} className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#EEF3EB] text-[#6A8565]" aria-hidden="true">
    {!loaded ? <Sprout size={19} strokeWidth={1.5} /> : null}
    {src && visible && !failed ? <Image
      src={src} alt="" width={44} height={44} sizes="44px" loading="lazy" decoding="async" fetchPriority="low"
      loader={coverIconLoader}
      unoptimized={!canOptimizePlantCover(src)}
      onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
    /> : null}
  </span>;
});
