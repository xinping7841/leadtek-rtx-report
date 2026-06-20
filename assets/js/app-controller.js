import { collectElements } from "./elements.js";
import { validateCatalog, validateExternalResults, validateMarketPrices } from "./schema.js";
import { loadJson, normalizeModelName } from "./utils.js";
import { externalSummary, normalizeGpu, priceValue } from "./view-model.js";
import { renderComparison, renderHevcShelf, renderLoadError, renderTable } from "./renderers.js";

const catalogUrl = "data/gpu-catalog.json";
const pricesUrl = "data/market-prices.json";
const externalResultsUrl = "data/gpu-test-results.json";

function setSyncStatus(elements, type, text, meta) {
  elements.syncPanel.classList.toggle("is-ok", type === "ok");
  elements.syncPanel.classList.toggle("is-warn", type === "warn");
  elements.syncPanel.classList.toggle("is-error", type === "error");
  elements.syncStatusText.textContent = text;
  elements.syncStatusMeta.textContent = meta;
}

function selectedGpus(state) {
  return state.gpus.filter((gpu) => state.selectedGpuIds.has(gpu.id));
}

function hevcState(elements) {
  return {
    q: elements.hevcSearch.value.trim().toLowerCase(),
    sort: elements.hevcSort.value,
    level: elements.hevcLevel.value,
    arch: elements.hevcArch.value,
    minNvdec: Number(elements.hevcMinNvdec.value),
    minMemory: Number(elements.hevcMinMemory.value),
    maxPower: Number(elements.hevcMaxPower.value),
    need422: elements.hevcNeed422.checked,
    needAv1: elements.hevcNeedAv1.checked,
    lowPower: elements.hevcLowPower.checked,
    hideWeak: elements.hevcHideWeak.checked,
  };
}

function filteredHevcItems(elements, gpus) {
  const state = hevcState(elements);
  const items = gpus.filter((gpu) => {
    const haystack = [
      gpu.model,
      gpu.architecture,
      gpu.memory.text,
      gpu.codecs.engine.text,
      gpu.codecs.hevc.title,
      gpu.codecs.hevc.detail,
      gpu.codecs.av1.title,
      gpu.codecs.av1.detail,
      gpu.price.text,
      gpu.positioning,
      externalSummary(gpu),
    ].join(" ").toLowerCase();
    if (state.q && !haystack.includes(state.q)) return false;
    if (state.level !== "all" && gpu.level !== state.level) return false;
    if (state.arch !== "all" && gpu.arch !== state.arch) return false;
    if (gpu.codecs.engine.nvdec < state.minNvdec) return false;
    if (gpu.memory.gb < state.minMemory) return false;
    if (gpu.power.watts && gpu.power.watts > state.maxPower) return false;
    if (state.need422 && !gpu.supports422) return false;
    if (state.needAv1 && !gpu.av1Encode) return false;
    if (state.lowPower && !(gpu.lowPower || gpu.compact)) return false;
    if (state.hideWeak && gpu.weakMain) return false;
    return true;
  });
  const sorters = {
    score: (a, b) => b.score - a.score || b.codecs.engine.nvdec - a.codecs.engine.nvdec || b.codecs.engine.nvenc - a.codecs.engine.nvenc || b.memory.gb - a.memory.gb,
    nvdec: (a, b) => b.codecs.engine.nvdec - a.codecs.engine.nvdec || b.score - a.score,
    nvenc: (a, b) => b.codecs.engine.nvenc - a.codecs.engine.nvenc || b.score - a.score,
    memory: (a, b) => b.memory.gb - a.memory.gb || b.score - a.score,
    power: (a, b) => (a.power.watts || 999) - (b.power.watts || 999) || b.score - a.score,
    price: (a, b) => priceValue(a) - priceValue(b) || b.score - a.score,
    year: (a, b) => b.year - a.year || b.score - a.score,
  };
  return items.sort(sorters[state.sort] || sorters.score);
}

function sortNote(value) {
  const labels = {
    score: "当前按视频服务器综合能力排序：4:2:2、AV1、NVENC/NVDEC、显存、带宽、功耗共同计分。",
    nvdec: "当前按 NVDEC 解码引擎数量排序，适合多路拉流、解码和转码入口评估。",
    nvenc: "当前按 NVENC 编码引擎数量排序，适合多路输出和转码并发评估。",
    memory: "当前按显存容量排序，适合本地大模型、超大场景和多任务余量评估。",
    power: "当前按低功耗排序，适合小机箱、边缘节点和多卡密度评估。",
    price: "当前按预算价低优先排序，询价/公开价少的型号会排在后面。",
    year: "当前按发布时间新优先排序，适合新采购和生命周期评估。",
  };
  return labels[value] || labels.score;
}

function updateState(elements, state) {
  const selected = selectedGpus(state);
  elements.compareCount.textContent = `已选 ${selected.length} 款`;
  elements.buildCompare.disabled = selected.length < 2;
  elements.clearCompare.disabled = selected.length === 0;
  elements.toggleSelectedOnly.disabled = selected.length === 0;
  elements.tableBody.querySelectorAll("tr").forEach((row) => {
    const gpuId = row.dataset.gpuId;
    if (!gpuId) return;
    const levelMatched = state.activeLevel === "all" || row.dataset.level === state.activeLevel;
    const checked = state.selectedGpuIds.has(gpuId);
    const input = row.querySelector(".compare-check");
    if (input) input.checked = checked;
    row.classList.toggle("is-selected", checked);
    row.classList.toggle("is-hidden-by-compare", state.selectedOnly && !checked);
    row.classList.toggle("is-hidden-by-level", !levelMatched);
  });
  if (state.selectedOnly && selected.length === 0) {
    state.selectedOnly = false;
    elements.toggleSelectedOnly.textContent = "仅显示已选";
  }
  renderHevcShelf({
    elements,
    gpus: state.gpus,
    items: filteredHevcItems(elements, state.gpus),
    selectedGpuIds: state.selectedGpuIds,
    sortNoteText: sortNote(elements.hevcSort.value),
  });
}

function mergeExternalResults(state, payload) {
  const resultMap = new Map();
  payload.rows.forEach((item) => {
    const model = item["型号"] || item.model || item.gpu || "";
    const key = normalizeModelName(model);
    if (!key) return;
    if (!resultMap.has(key)) resultMap.set(key, []);
    resultMap.get(key).push(item);
  });
  let matched = 0;
  state.gpus = state.gpus.map((gpu) => {
    const items = resultMap.get(normalizeModelName(gpu.model)) || [];
    if (items.length) matched += 1;
    return { ...gpu, externalResults: items };
  });
  return matched;
}

async function loadExternalResults(elements, state) {
  try {
    const payload = validateExternalResults(await loadJson(externalResultsUrl, { optional: true }));
    if (!payload) {
      setSyncStatus(elements, "warn", "企业文档同步未连接", "未找到 data/gpu-test-results.json，当前显示内置静态数据。");
      return;
    }
    if (payload.syncedAt && payload.syncedAt === state.lastExternalSyncAt) return;
    state.lastExternalSyncAt = payload.syncedAt || new Date().toISOString();
    const matched = mergeExternalResults(state, payload);
    setSyncStatus(elements, "ok", "企业文档同步已连接", `最后同步：${state.lastExternalSyncAt}，匹配 ${matched} 款型号。`);
    renderTable(elements.tableBody, state.gpus, state.selectedGpuIds);
    updateState(elements, state);
  } catch (error) {
    setSyncStatus(elements, "error", "企业文档同步读取失败", `${error.message}。当前显示内置静态数据。`);
  }
}

function toggleGpuSelection(elements, state, gpuId) {
  if (!gpuId) return;
  if (state.selectedGpuIds.has(gpuId)) state.selectedGpuIds.delete(gpuId);
  else state.selectedGpuIds.add(gpuId);
  updateState(elements, state);
}

function resetHevcFilters(elements) {
  elements.hevcSearch.value = "";
  elements.hevcSort.value = "score";
  elements.hevcLevel.value = "all";
  elements.hevcArch.value = "all";
  elements.hevcMinNvdec.value = "0";
  elements.hevcMinMemory.value = "0";
  elements.hevcMaxPower.value = "999";
  elements.hevcNeed422.checked = false;
  elements.hevcNeedAv1.checked = false;
  elements.hevcLowPower.checked = false;
  elements.hevcHideWeak.checked = false;
}

function setViewMode(elements, mode) {
  document.body.classList.toggle("compact-view", mode === "compact");
  document.body.classList.toggle("full-view", mode === "full");
  elements.fullViewBtn.classList.toggle("is-active", mode === "full");
  elements.compactViewBtn.classList.toggle("is-active", mode === "compact");
}

function bindEvents(elements, state) {
  elements.table.addEventListener("change", (event) => {
    const input = event.target.closest(".compare-check");
    if (!input) return;
    const row = input.closest("tr");
    toggleGpuSelection(elements, state, row?.dataset.gpuId);
  });
  elements.table.addEventListener("click", (event) => {
    const row = event.target.closest("tbody tr");
    if (!row || event.target.closest("a, button, input")) return;
    toggleGpuSelection(elements, state, row.dataset.gpuId);
  });
  elements.buildCompare.addEventListener("click", () => renderComparison(elements, selectedGpus(state)));
  elements.clearCompare.addEventListener("click", () => {
    state.selectedGpuIds = new Set();
    state.selectedOnly = false;
    elements.toggleSelectedOnly.textContent = "仅显示已选";
    elements.comparePanel.classList.remove("is-visible");
    elements.compareOutput.innerHTML = "";
    updateState(elements, state);
  });
  elements.toggleSelectedOnly.addEventListener("click", () => {
    state.selectedOnly = !state.selectedOnly;
    elements.toggleSelectedOnly.textContent = state.selectedOnly ? "显示全部" : "仅显示已选";
    updateState(elements, state);
  });
  elements.levelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLevel = button.dataset.levelFilter;
      elements.levelButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      updateState(elements, state);
    });
  });
  [elements.hevcSearch, elements.hevcSort, elements.hevcLevel, elements.hevcArch, elements.hevcMinNvdec, elements.hevcMinMemory, elements.hevcMaxPower, elements.hevcNeed422, elements.hevcNeedAv1, elements.hevcLowPower, elements.hevcHideWeak].forEach((control) => {
    control.addEventListener("input", () => updateState(elements, state));
    control.addEventListener("change", () => updateState(elements, state));
  });
  elements.hevcReset.addEventListener("click", () => {
    resetHevcFilters(elements);
    updateState(elements, state);
  });
  elements.hevcShelf.addEventListener("click", (event) => {
    const button = event.target.closest(".hevc-compare-btn");
    if (!button) return;
    toggleGpuSelection(elements, state, button.dataset.gpuId);
  });
  elements.fullViewBtn.addEventListener("click", () => setViewMode(elements, "full"));
  elements.compactViewBtn.addEventListener("click", () => setViewMode(elements, "compact"));
}

async function initData(elements, state) {
  try {
    const [catalogPayload, pricesPayload] = await Promise.all([loadJson(catalogUrl), loadJson(pricesUrl)]);
    const catalog = validateCatalog(catalogPayload);
    const gpuIds = new Set(catalog.gpus.map((gpu) => gpu.id));
    const priceMap = validateMarketPrices(pricesPayload, gpuIds);
    state.gpus = catalog.gpus.map((gpu) => normalizeGpu(gpu, priceMap.get(gpu.id)));
    renderTable(elements.tableBody, state.gpus, state.selectedGpuIds);
    updateState(elements, state);
    await loadExternalResults(elements, state);
    window.setInterval(() => loadExternalResults(elements, state), 60000);
  } catch (error) {
    renderLoadError(elements, error);
    setSyncStatus(elements, "error", "GPU 数据加载失败", error.message);
  }
}

export function initLeadtekReport() {
  const elements = collectElements();
  const state = {
    gpus: [],
    selectedGpuIds: new Set(),
    selectedOnly: false,
    activeLevel: "all",
    lastExternalSyncAt: "",
  };
  bindEvents(elements, state);
  setViewMode(elements, window.innerWidth < 1500 ? "compact" : "full");
  initData(elements, state);
}
