export type FertilizerMix = { water: string; fertilizer: string };

export function formatFertilizerMix(mix: FertilizerMix) {
  const toUnits = (value: string) => {
    if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return 0;
    const units = Math.round(Number(value) * 1000);
    return Number.isSafeInteger(units) && units > 0 && units <= 1e10 ? units : 0;
  };
  const water = toUnits(mix.water), fertilizer = toUnits(mix.fertilizer);
  if (!water || !fertilizer) return "";
  let a = water, b = fertilizer;
  while (b) [a, b] = [b, a % b];
  return `물:비료 ${water / 1000}mL : ${fertilizer / 1000}mL (비료:물 ${fertilizer / a}:${water / a})`;
}
