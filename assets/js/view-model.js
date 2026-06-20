export function normalizeGpu(raw, price) {
  const archText = `${raw.architecture} ${raw.model}`;
  const isBlackwell = /Blackwell/i.test(archText);
  const isAda = /Ada/i.test(archText);
  const isAmpere = /Ampere/i.test(archText);
  const hevcText = [raw.codecs?.hevc?.title, raw.codecs?.hevc?.detail, raw.codecs?.hevc?.note].filter(Boolean).join(" ");
  const av1Text = [raw.codecs?.av1?.title, raw.codecs?.av1?.detail, raw.codecs?.av1?.note].filter(Boolean).join(" ");
  const supports422 = /4:2:2/.test(hevcText) && !/不支持/.test(hevcText);
  const av1Encode = /AV1 输出：支持/.test(av1Text) || (/硬件编码/.test(av1Text) && !/不支持/.test(av1Text));
  const lowPower = raw.power.watts > 0 && raw.power.watts <= 75;
  const compact = /SFF|半高|单槽/i.test(`${raw.model} ${raw.formFactor}`);
  const weakMain = /不建议做主力|A1000|A400|A2000/i.test(`${raw.positioning} ${raw.model}`);
  const year = parseYear(`${raw.generation?.text || ""} ${raw.generation?.label || ""}`);
  const score = Math.round(
    (isBlackwell ? 28 : isAda ? 17 : 7) +
    raw.codecs.engine.nvenc * 9 +
    raw.codecs.engine.nvdec * 10 +
    (supports422 ? 18 : 0) +
    (av1Encode ? 12 : 0) +
    Math.min(raw.memory.gb, 96) * 0.35 +
    Math.min(raw.bandwidth.gbps, 1800) / 120 +
    (raw.codecs.engine.jpeg ? 2 : 0) +
    (lowPower ? 4 : 0) -
    (raw.power.watts >= 300 ? 4 : 0) -
    (weakMain ? 7 : 0)
  );
  return {
    ...raw,
    price: price || { text: "待补充", status: "quote", minCny: null, maxCny: null },
    arch: isBlackwell ? "Blackwell" : isAda ? "Ada" : isAmpere ? "Ampere" : "其他",
    supports422,
    av1Encode,
    lowPower,
    compact,
    weakMain,
    year,
    score,
    externalResults: [],
  };
}

export function parseYear(text) {
  const years = (text.match(/20\d{2}/g) || []).map(Number);
  return years.length ? Math.max(...years) : 0;
}

export function priceValue(gpu) {
  return Number.isFinite(gpu.price?.minCny) ? gpu.price.minCny : 999999;
}

export function generationText(gpu) {
  return [gpu.generation?.label, gpu.generation?.text].filter(Boolean).join("\n");
}

export function externalSummary(gpu) {
  return gpu.externalResults
    .slice(0, 2)
    .map((item) => `${item["测试项"] || "测试"}：${item["结论"] || "有测试记录"}`)
    .join("；");
}
