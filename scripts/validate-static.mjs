import fs from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "assets/app.css",
  "assets/app.js",
  "data/gpu-catalog.json",
  "data/market-prices.json",
  "data/gpu-test-results.json",
];

const errors = [];

function fail(message) {
  errors.push(message);
}

function readText(path) {
  if (!fs.existsSync(path)) {
    fail(`Missing required file: ${path}`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    fail(`Invalid JSON in ${path}: ${error.message}`);
    return null;
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
}

function assertNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be a finite number`);
}

function assertHttpUrl(value, label) {
  assertString(value, label);
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) fail(`${label} must be an HTTP(S) URL`);
  } catch {
    fail(`${label} must be a valid URL`);
  }
}

function assertLocalAsset(value, label) {
  assertString(value, label);
  if (typeof value !== "string" || !value.trim()) return;
  if (/^https?:\/\//i.test(value)) fail(`${label} must use a local cached asset path`);
  if (value.includes("..") || value.startsWith("/") || value.startsWith("\\")) {
    fail(`${label} must be a relative path inside the project`);
    return;
  }
  if (!fs.existsSync(value)) {
    fail(`${label} references missing file: ${value}`);
    return;
  }
  const stats = fs.statSync(value);
  if (!stats.isFile() || stats.size === 0) fail(`${label} references an empty or invalid file: ${value}`);
}

for (const file of requiredFiles) readText(file);

const html = readText("index.html");
if (!html.includes('href="assets/app.css"')) fail("index.html must reference assets/app.css");
if (!/<script\s+type="module"\s+src="assets\/app\.js"><\/script>/i.test(html)) {
  fail("index.html must reference assets/app.js as a module script");
}
if (/<style[\s>]/i.test(html)) fail("index.html should not contain inline <style> blocks");
if (!/<table id="gpuTable">[\s\S]*<tbody>[\s\S]*data-loading-row[\s\S]*<\/tbody>/i.test(html)) {
  fail("index.html should keep only the gpuTable skeleton/loading row");
}
if (/<tr data-level="/i.test(html)) fail("GPU catalog rows must live in data/gpu-catalog.json, not index.html");

const catalog = readJson("data/gpu-catalog.json");
const prices = readJson("data/market-prices.json");
readJson("data/gpu-test-results.json");

const gpuIds = new Set();
if (!Array.isArray(catalog?.gpus)) {
  fail("data/gpu-catalog.json must contain a gpus array");
} else {
  catalog.gpus.forEach((gpu, index) => {
    const label = `gpu[${index}]`;
    assertString(gpu.id, `${label}.id`);
    assertString(gpu.level, `${label}.level`);
    assertString(gpu.model, `${label}.model`);
    assertString(gpu.architecture, `${label}.architecture`);
    assertLocalAsset(gpu.image?.src, `${label}.image.src`);
    assertString(gpu.image?.alt, `${label}.image.alt`);
    if (gpu.image?.sourceUrl !== undefined) assertHttpUrl(gpu.image.sourceUrl, `${label}.image.sourceUrl`);
    assertString(gpu.compute?.text, `${label}.compute.text`);
    assertNumber(gpu.compute?.cuda, `${label}.compute.cuda`);
    assertString(gpu.memory?.text, `${label}.memory.text`);
    assertNumber(gpu.memory?.gb, `${label}.memory.gb`);
    assertString(gpu.bandwidth?.text, `${label}.bandwidth.text`);
    assertNumber(gpu.bandwidth?.gbps, `${label}.bandwidth.gbps`);
    assertString(gpu.power?.text, `${label}.power.text`);
    assertNumber(gpu.power?.watts, `${label}.power.watts`);
    assertString(gpu.codecs?.engine?.text, `${label}.codecs.engine.text`);
    assertNumber(gpu.codecs?.engine?.nvenc, `${label}.codecs.engine.nvenc`);
    assertNumber(gpu.codecs?.engine?.nvdec, `${label}.codecs.engine.nvdec`);
    assertString(gpu.codecs?.hevc?.title, `${label}.codecs.hevc.title`);
    assertString(gpu.codecs?.av1?.title, `${label}.codecs.av1.title`);
    assertString(gpu.busAndDisplay, `${label}.busAndDisplay`);
    assertString(gpu.formFactor, `${label}.formFactor`);
    assertString(gpu.official?.url, `${label}.official.url`);
    assertString(gpu.positioning, `${label}.positioning`);

    if (gpuIds.has(gpu.id)) fail(`Duplicate GPU id: ${gpu.id}`);
    gpuIds.add(gpu.id);
  });
}

const priceIds = new Set();
if (!Array.isArray(prices?.prices)) {
  fail("data/market-prices.json must contain a prices array");
} else {
  prices.prices.forEach((price, index) => {
    const label = `price[${index}]`;
    assertString(price.gpuId, `${label}.gpuId`);
    assertString(price.text, `${label}.text`);
    if (!gpuIds.has(price.gpuId)) fail(`Price references unknown gpuId: ${price.gpuId}`);
    if (priceIds.has(price.gpuId)) fail(`Duplicate price gpuId: ${price.gpuId}`);
    priceIds.add(price.gpuId);
    if (price.minCny !== null && !Number.isFinite(price.minCny)) fail(`${label}.minCny must be a number or null`);
    if (price.maxCny !== null && !Number.isFinite(price.maxCny)) fail(`${label}.maxCny must be a number or null`);
  });
}
for (const id of gpuIds) {
  if (!priceIds.has(id)) fail(`Missing market price for gpuId: ${id}`);
}

const scriptFiles = ["assets/app.js", ...fs.readdirSync("assets/js").filter((file) => file.endsWith(".js")).map((file) => `assets/js/${file}`)];
for (const scriptFile of scriptFiles) {
  const syntax = spawnSync(process.execPath, ["--check", scriptFile], { encoding: "utf8" });
  if (syntax.status !== 0) fail(`${scriptFile} syntax check failed:\n${syntax.stderr || syntax.stdout}`);
}

if (errors.length) {
  console.error("Static validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Static validation passed: ${gpuIds.size} GPUs, ${priceIds.size} prices.`);
