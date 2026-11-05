export type FertilizerMix = { water: string; fertilizer: string };
export type FertilizerBatch = { water: string; fertilizers: Array<{ name: string; amount: string }> };

export function formatFertilizerBatches(batches: FertilizerBatch[], startIndex = 0) {
  return batches.filter((batch) => batch.fertilizers.length).map((batch, index) => {
    const ingredients = batch.fertilizers.map(({ name, amount }) => `${name}${amount ? ` ${amount}mL` : ""}`).join(" + ");
    const ratios = batch.fertilizers.flatMap(({ name, amount }) => {
      const values = fertilizerMixValues({ water: batch.water, fertilizer: amount });
      return values ? [`${name} 비료:물 ${values.fertilizer / values.divisor}:${values.water / values.divisor}`] : [];
    });
    return `물통 ${startIndex + index + 1} · ${batch.water ? `물 ${batch.water}mL + ` : ""}${ingredients}${ratios.length ? ` (${ratios.join(" / ")})` : ""}`;
  }).join("\n");
}

function fertilizerMixValues(mix: FertilizerMix) {
  const toUnits = (value: string) => {
    if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return 0;
    const units = Math.round(Number(value) * 1000);
    return Number.isSafeInteger(units) && units > 0 && units <= 1e10 ? units : 0;
  };
  const water = toUnits(mix.water), fertilizer = toUnits(mix.fertilizer);
  if (!water || !fertilizer) return null;
  let a = water, b = fertilizer;
  while (b) [a, b] = [b, a % b];
  return { water, fertilizer, divisor: a };
}

export function formatFertilizerMix(mix: FertilizerMix) {
  const values = fertilizerMixValues(mix);
  if (!values) return "";
  const { water, fertilizer, divisor } = values;
  return `물:비료 ${water / 1000}mL : ${fertilizer / 1000}mL (비료:물 ${fertilizer / divisor}:${water / divisor})`;
}
