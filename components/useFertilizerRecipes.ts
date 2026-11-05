"use client";

import { useEffect, useRef, useState } from "react";
import { cacheRecipes, emptyFertilizerRecipes, parseFertilizerRecipes, readRecipeCache, type FertilizerRecipes } from "@/lib/fertilizer-recipes";

export function useFertilizerRecipes() {
  const [state, setState] = useState(emptyFertilizerRecipes);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const revision = useRef<string | null>(null);
  const connected = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setState(readRecipeCache());
      try {
        const response = await fetch("/api/fertilizer-recipes", { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        const saved = parseFertilizerRecipes(payload.state);
        if (!response.ok || !saved) throw new Error();
        if (controller.signal.aborted) return;
        revision.current = payload.revision;
        connected.current = true;
        setState(saved); cacheRecipes(saved);
      } catch { if (!controller.signal.aborted) setMessage("저장된 물통 연결을 확인하지 못했어요. 작성 중인 비율은 이 기기에 임시 보관됩니다."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    });
    return () => controller.abort();
  }, []);

  async function save(next: FertilizerRecipes) {
    if (!connected.current) throw new Error("물통 연결을 확인하지 못했어요. 입력 내용은 임시 보관됩니다. 새로고침 후 다시 저장해주세요.");
    const response = await fetch("/api/fertilizer-recipes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: next, revision: revision.current }) });
    const payload = await response.json();
    const saved = parseFertilizerRecipes(payload.state);
    if (!response.ok || !saved) throw new Error(payload.message ?? "물통을 저장하지 못했어요.");
    revision.current = payload.revision;
    setState(saved); cacheRecipes(saved); setMessage("");
  }
  function select(index: number) { setState((current) => ({ ...current, index })); }
  return { state, loading, message, save, select };
}
