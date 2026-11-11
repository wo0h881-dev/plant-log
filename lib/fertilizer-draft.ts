import { fertilizerBatchNameLimit, type FertilizerBatch } from "@/lib/fertilizer";
import { recipeDraftKey } from "@/lib/fertilizer-recipes";

export type DraftBatch = FertilizerBatch & { id: string; amounts: Record<string, string> };
export type FertilizerDraft = { version: 1; batches: DraftBatch[]; activeIndex: number; options: string[]; name: string };
export const emptyBatch = (): DraftBatch => ({ id: crypto.randomUUID(), water: "", fertilizers: [], amounts: {} });
export function newFertilizerDraft(selected: FertilizerBatch[], index: number): FertilizerDraft {
  return { version: 1, name: "", options: [], activeIndex: Math.min(index, Math.max(0, selected.length - 1)), batches: selected.length ? selected.map((batch) => ({ ...batch, id: crypto.randomUUID(), amounts: Object.fromEntries(batch.fertilizers.map((item) => [item.name, item.amount])) })) : [emptyBatch()] };
}

export function readFertilizerDraft(): FertilizerDraft | null {
  try {
    const data = JSON.parse(localStorage.getItem(recipeDraftKey) ?? "null") as FertilizerDraft;
    const name = (value: unknown): value is string => typeof value === "string" && value.length <= 100;
    const amount = (value: unknown): value is string => typeof value === "string" && value.length <= 12;
    if (!data || data.version !== 1 || !Array.isArray(data.batches) || !data.batches.length || data.batches.length > 5 || !Number.isInteger(data.activeIndex) || data.activeIndex < 0 || data.activeIndex >= data.batches.length || !name(data.name) || !Array.isArray(data.options) || data.options.length > 200 || !data.options.every(name)) return null;
    if (data.batches.some((batch) => !batch || !name(batch.id) || !amount(batch.water) || !Array.isArray(batch.fertilizers) || batch.fertilizers.length > 20 || batch.fertilizers.some((item) => !item || !name(item.name) || !amount(item.amount)) || !batch.amounts || typeof batch.amounts !== "object" || Object.entries(batch.amounts).some(([key, value]) => !name(key) || !amount(value)))) return null;
    if (data.batches.some((batch) => batch.name !== undefined && (!name(batch.name) || batch.name.length > fertilizerBatchNameLimit || /[\r\n]/.test(batch.name)))) return null;
    if (data.batches.reduce((sum, batch) => sum + batch.fertilizers.length, 0) > 20) return null;
    if (new Set(data.batches.map((batch) => batch.id)).size !== data.batches.length) return null;
    return data;
  } catch { return null; }
}

export function writeFertilizerDraft(draft: FertilizerDraft) {
  try { localStorage.setItem(recipeDraftKey, JSON.stringify({ ...draft, options: draft.options.slice(0, 200) })); return true; }
  catch { return false; }
}

export function clearFertilizerDraft() {
  try { localStorage.removeItem(recipeDraftKey); } catch { /* A saved recipe remains on the server. */ }
}
