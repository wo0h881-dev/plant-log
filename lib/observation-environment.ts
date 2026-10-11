export function readEnvironmentNote(form: FormData, enabled: boolean) {
  if (!enabled) return "";
  const temperature = String(form.get("temperature") ?? "").trim();
  const humidity = String(form.get("humidity") ?? "").trim();
  if (!temperature && !humidity) throw new Error("온도 또는 습도를 입력하세요.");
  const parts: string[] = [];
  for (const [value, label, unit, min, max, above] of [
    [temperature, "온도", "°C", -50, 80, "temperatureAbove"],
    [humidity, "습도", "%", 0, 100, "humidityAbove"],
  ] as const) {
    if (!value) continue;
    if (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
      throw new Error(`${label}는 ${min}~${max} 범위의 숫자로 입력하세요.`);
    }
    parts.push(`${label}: ${Number(value)}${unit}${form.get(above) === "true" ? " 이상" : ""}`);
  }
  return parts.join("\n");
}
