function push(errors, message) {
  errors.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(errors, value, label) {
  if (typeof value !== "string" || !value.trim()) push(errors, `${label} 必须是非空字符串`);
}

function numberField(errors, value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) push(errors, `${label} 必须是有效数字`);
}

function httpUrlField(errors, value, label) {
  stringField(errors, value, label);
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) push(errors, `${label} 必须是 HTTP(S) URL`);
  } catch {
    push(errors, `${label} 必须是合法 URL`);
  }
}

function localAssetField(errors, value, label) {
  stringField(errors, value, label);
  if (typeof value !== "string") return;
  if (/^https?:\/\//i.test(value)) push(errors, `${label} 必须使用本地缓存资源路径`);
  if (value.includes("..") || value.startsWith("/") || value.startsWith("\\")) {
    push(errors, `${label} 必须是项目内相对路径`);
  }
}

function requireObject(errors, value, label) {
  if (!isObject(value)) push(errors, `${label} 必须是对象`);
  return isObject(value) ? value : {};
}

function failIfNeeded(errors, source) {
  if (!errors.length) return;
  const preview = errors.slice(0, 6).join("；");
  const suffix = errors.length > 6 ? `；另有 ${errors.length - 6} 个问题` : "";
  throw new Error(`${source} 校验失败：${preview}${suffix}`);
}

function validateGpu(errors, gpu, index) {
  const label = `gpus[${index}]`;
  requireObject(errors, gpu, label);
  stringField(errors, gpu.id, `${label}.id`);
  stringField(errors, gpu.level, `${label}.level`);
  stringField(errors, gpu.model, `${label}.model`);
  stringField(errors, gpu.architecture, `${label}.architecture`);
  localAssetField(errors, gpu.image?.src, `${label}.image.src`);
  stringField(errors, gpu.image?.alt, `${label}.image.alt`);
  if (gpu.image?.sourceUrl !== undefined) httpUrlField(errors, gpu.image.sourceUrl, `${label}.image.sourceUrl`);
  stringField(errors, gpu.generation?.label, `${label}.generation.label`);
  stringField(errors, gpu.generation?.text, `${label}.generation.text`);
  stringField(errors, gpu.compute?.text, `${label}.compute.text`);
  numberField(errors, gpu.compute?.cuda, `${label}.compute.cuda`);
  stringField(errors, gpu.memory?.text, `${label}.memory.text`);
  numberField(errors, gpu.memory?.gb, `${label}.memory.gb`);
  stringField(errors, gpu.bandwidth?.text, `${label}.bandwidth.text`);
  numberField(errors, gpu.bandwidth?.gbps, `${label}.bandwidth.gbps`);
  stringField(errors, gpu.power?.text, `${label}.power.text`);
  numberField(errors, gpu.power?.watts, `${label}.power.watts`);
  stringField(errors, gpu.codecs?.engine?.text, `${label}.codecs.engine.text`);
  numberField(errors, gpu.codecs?.engine?.nvenc, `${label}.codecs.engine.nvenc`);
  numberField(errors, gpu.codecs?.engine?.nvdec, `${label}.codecs.engine.nvdec`);
  stringField(errors, gpu.codecs?.hevc?.title, `${label}.codecs.hevc.title`);
  stringField(errors, gpu.codecs?.hevc?.detail, `${label}.codecs.hevc.detail`);
  stringField(errors, gpu.codecs?.av1?.title, `${label}.codecs.av1.title`);
  stringField(errors, gpu.codecs?.av1?.detail, `${label}.codecs.av1.detail`);
  stringField(errors, gpu.busAndDisplay, `${label}.busAndDisplay`);
  stringField(errors, gpu.formFactor, `${label}.formFactor`);
  stringField(errors, gpu.official?.label, `${label}.official.label`);
  httpUrlField(errors, gpu.official?.url, `${label}.official.url`);
  stringField(errors, gpu.positioning, `${label}.positioning`);
}

export function validateCatalog(payload) {
  const errors = [];
  if (!Array.isArray(payload?.gpus)) {
    throw new Error("data/gpu-catalog.json 校验失败：gpus 必须是数组");
  }
  const ids = new Set();
  payload.gpus.forEach((gpu, index) => {
    validateGpu(errors, gpu, index);
    if (!gpu?.id) return;
    if (ids.has(gpu.id)) push(errors, `GPU id 重复：${gpu.id}`);
    ids.add(gpu.id);
  });
  failIfNeeded(errors, "data/gpu-catalog.json");
  return payload;
}

export function validateMarketPrices(payload, gpuIds) {
  const errors = [];
  if (!Array.isArray(payload?.prices)) {
    throw new Error("data/market-prices.json 校验失败：prices 必须是数组");
  }
  const priceIds = new Set();
  payload.prices.forEach((price, index) => {
    const label = `prices[${index}]`;
    stringField(errors, price?.gpuId, `${label}.gpuId`);
    stringField(errors, price?.text, `${label}.text`);
    if (price?.gpuId && !gpuIds.has(price.gpuId)) push(errors, `价格引用未知 GPU id：${price.gpuId}`);
    if (price?.gpuId && priceIds.has(price.gpuId)) push(errors, `价格 gpuId 重复：${price.gpuId}`);
    if (price?.gpuId) priceIds.add(price.gpuId);
    if (price?.minCny !== null && !Number.isFinite(price?.minCny)) push(errors, `${label}.minCny 必须是数字或 null`);
    if (price?.maxCny !== null && !Number.isFinite(price?.maxCny)) push(errors, `${label}.maxCny 必须是数字或 null`);
  });
  for (const id of gpuIds) {
    if (!priceIds.has(id)) push(errors, `缺少价格记录：${id}`);
  }
  failIfNeeded(errors, "data/market-prices.json");
  return new Map(payload.prices.map((price) => [price.gpuId, price]));
}
