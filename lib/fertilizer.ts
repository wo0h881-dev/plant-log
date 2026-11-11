export type FertilizerMix = { water: string; fertilizer: string };
export type FertilizerBatch = { name?: string; water: string; fertilizers: Array<{ name: string; amount: string }> };
export const fertilizerBatchNameLimit = 32;

export function fertilizerBatchName(batch: FertilizerBatch, index: number) {
  return batch.name?.trim() || `물통 ${index + 1}`;
}

export function formatFertilizerBatches(batches: FertilizerBatch[], startIndex = 0) {
  return batches.filter((batch) => batch.fertilizers.length).map((batch, index) => {
    const ingredients = batch.fertilizers.map(({ name, amount }) => `${name}${amount ? ` ${amount}mL` : ""}`).join(" + ");
    const ratios = batch.fertilizers.flatMap(({ name, amount }) => {
      const values = fertilizerMixValues({ water: batch.water, fertilizer: amount });
      return values ? [`${name} 비료:물 ${values.fertilizer / values.divisor}:${values.water / values.divisor}`] : [];
    });
    return `${fertilizerBatchName(batch, startIndex + index)} · ${batch.water ? `물 ${batch.water}mL + ` : ""}${ingredients}${ratios.length ? ` (${ratios.join(" / ")})` : ""}`;
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
export function formatFertilizerRecord(names: string[], ratio?: string) {
  return [names.join(", "), ratio?.trim()].filter(Boolean).join("\n");
}

type FertilizerProperties = Record<string, {
  select?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
}>;

export function readFertilizerRecord(properties: FertilizerProperties) {
  const names = [...new Set(properties["사용 비료"]?.multi_select?.map(({ name }) => name?.trim() ?? "").filter(Boolean) ?? [])];
  const legacyName = properties["비료"]?.select?.name?.trim();
  if (!names.length && legacyName) names.push(legacyName);
  const readText = (key: string) => properties[key]?.rich_text?.map(({ plain_text }) => plain_text ?? "").join("").trim() ?? "";
  const ratio = readText("비료 비율");
  const note = readText("비료 내용") || (names.length ? formatFertilizerRecord(names, ratio) : "");
  return note ? { names, ratio, note } : null;
}

export function isFertilizerMirror(note: string, tags: string[], record: { names: string[]; ratio: string }) {
  if (!tags.length || !tags.every((tag) => record.names.includes(tag))) return false;
  if (note === "비료 사용") return true;
  const ratio = note.startsWith("비료 비율: ") ? note.slice("비료 비율: ".length) : "";
  return Boolean(ratio && `\n${record.ratio}\n`.includes(`\n${ratio}\n`));
}
