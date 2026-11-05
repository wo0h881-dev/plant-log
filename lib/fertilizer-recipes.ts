import { formatFertilizerBatches, formatFertilizerMix, type FertilizerBatch } from "@/lib/fertilizer";

export type FertilizerRecipes = { version: 1; batches: FertilizerBatch[]; index: number };
export const emptyFertilizerRecipes = (): FertilizerRecipes => ({ version: 1, batches: [], index: 0 });
export const recipeCacheKey = "plant-log:fertilizer-recipes:v1";
export const recipeDraftKey = "plant-log:fertilizer-draft:v1";

export function parseFertilizerRecipes(value: unknown): FertilizerRecipes | null {
  if (!value || typeof value !== "object") return null;
  const state = value as FertilizerRecipes;
  if (state.version !== 1 || !Array.isArray(state.batches) || state.batches.length > 5 || !Number.isInteger(state.index) || state.index < 0 || state.index >= Math.max(1, state.batches.length)) return null;
  let count = 0;
  for (const batch of state.batches) {
    if (!batch || typeof batch.water !== "string" || batch.water.length > 12 || !Array.isArray(batch.fertilizers)) return null;
    count += batch.fertilizers.length;
    if (count > 20) return null;
    const names = new Set<string>();
    for (const item of batch.fertilizers) {
      if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 100 || /[,\r\n]/.test(item.name) || typeof item.amount !== "string" || item.amount.length > 12 || names.has(item.name.toLowerCase())) return null;
      names.add(item.name.toLowerCase());
    }
    const hasAmount = Boolean(batch.water || batch.fertilizers.some((item) => item.amount));
    if (hasAmount && (!batch.fertilizers.length || batch.fertilizers.some((item) => !formatFertilizerMix({ water: batch.water, fertilizer: item.amount })))) return null;
  }
  if (formatFertilizerBatches(state.batches).length > 4000) return null;
  return { version: 1, index: state.index, batches: state.batches.map((batch) => ({ water: batch.water, fertilizers: batch.fertilizers.map(({ name, amount }) => ({ name, amount })) })) };
}

export function readRecipeCache(): FertilizerRecipes {
  try { return parseFertilizerRecipes(JSON.parse(localStorage.getItem(recipeCacheKey) ?? "null")) ?? emptyFertilizerRecipes(); }
  catch { return emptyFertilizerRecipes(); }
}

export function cacheRecipes(state: FertilizerRecipes) {
  try { localStorage.setItem(recipeCacheKey, JSON.stringify(state)); } catch { /* The server remains the source of saved recipes. */ }
}
