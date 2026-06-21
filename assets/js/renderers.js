import { generationText } from "./view-model.js";

const compareColumns = [
  { label: "代际/时间", render: (gpu) => generationFragment(gpu) },
  { label: "架构", render: (gpu) => textNode(gpu.architecture) },
  { label: "CUDA / Tensor / RT", render: (gpu) => textNode(gpu.compute.text) },
  { label: "显存", render: (gpu) => memoryNode(gpu) },
  { label: "位宽 / 带宽", render: (gpu) => bandwidthNode(gpu) },
  { label: "功耗", render: (gpu) => powerNode(gpu) },
  { label: "NVENC / NVDEC", render: (gpu) => engineNode(gpu) },
  { label: "H.265 硬解规格", render: (gpu) => codecNode(gpu.codecs.hevc, "codec-hevc") },
  { label: "AV1 输出能力", render: (gpu) => codecNode(gpu.codecs.av1, "codec-av1") },
  { label: "总线 / 显示接口", render: (gpu) => interfaceNode(gpu) },
  { label: "外形规格", render: (gpu) => formNode(gpu) },
  { label: "市场参考价", render: (gpu) => textNode(gpu.price.text) },
  { label: "定位建议", render: (gpu) => textNode(gpu.positioning) },
];

function el(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(name, String(value));
    }
  }
  append(node, children);
  return node;
}

function append(parent, children) {
  for (const child of [children].flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function textNode(value) {
  return document.createTextNode(String(value ?? ""));
}

function br() {
  return document.createElement("br");
}

function fragment(children = []) {
  const node = document.createDocumentFragment();
  append(node, children);
  return node;
}

function linesFragment(value) {
  const parts = String(value ?? "").split("\n");
  return fragment(parts.flatMap((part, index) => (index === 0 ? [part] : [br(), part])));
}

function pill(text, type = "") {
  return el("span", { className: `feature-pill ${type}`.trim(), text });
}

function highlightGroup(items) {
  return items.length ? el("div", { className: "cell-highlights" }, items) : null;
}

function generationFragment(gpu) {
  const children = [];
  if (gpu.generation?.label) children.push(el("span", { className: "tag", text: gpu.generation.label }));
  if (gpu.generation?.text) children.push(br(), textNode(gpu.generation.text));
  return fragment(children);
}

function modelTags(gpu) {
  const tags = [];
  if (/RTX PRO 5000|RTX A2000/.test(gpu.model)) tags.push(pill("显存版本", "memory"));
  if (gpu.memory.gb >= 48) tags.push(pill(`${gpu.memory.gb}GB 大显存`, "memory"));
  else if (gpu.memory.gb >= 24) tags.push(pill(`${gpu.memory.gb}GB 显存`, "memory"));
  if (gpu.codecs.engine.nvenc >= 2) tags.push(pill(`${gpu.codecs.engine.nvenc}x NVENC`, "engine"));
  if (gpu.supports422) tags.push(pill("H.265 4:2:2 硬解", "codec"));
  if (gpu.av1Encode) tags.push(pill("AV1 输出", "codec"));
  if (gpu.lowPower) tags.push(pill(`${gpu.power.watts}W 低功耗`, "power"));
  if (gpu.compact) tags.push(pill("部署友好", "form"));
  return tags.slice(0, 5);
}

function modelNode(gpu) {
  const notes = [];
  if (/\bSFF\b/i.test(gpu.model)) notes.push("SFF：小机箱版");
  if (/Max-Q/i.test(gpu.model)) notes.push("Max-Q：低功耗版本");
  if (/Workstation/i.test(gpu.model)) notes.push("Workstation：工作站版");
  if (/Generation/i.test(gpu.model)) notes.push("Generation：这一代型号命名");

  const tags = modelTags(gpu);
  return fragment([
    textNode(gpu.model),
    notes.length ? el("div", { className: "term-cn model-term-note", text: notes.join("；") }) : null,
    tags.length ? el("div", { className: "feature-strip" }, tags) : null,
  ]);
}

function memoryNode(gpu) {
  const tags = [];
  if (gpu.memory.gb >= 72) tags.push(pill("超大显存", "memory"));
  else if (gpu.memory.gb >= 48) tags.push(pill("大显存", "memory"));
  else if (gpu.memory.gb >= 24) tags.push(pill("视频服务器主流", "memory"));
  else if (gpu.memory.gb <= 8) tags.push(pill("轻量/多屏", "warn"));
  if (gpu.memory.ecc) tags.push(pill("ECC", "memory"));
  if (/GDDR7/i.test(gpu.memory.text)) tags.push(pill("GDDR7", "memory"));
  const cls = gpu.memory.gb >= 48 ? "memory-xl" : gpu.memory.gb >= 24 ? "memory-lg" : "memory-mid";
  return el("div", { className: "memory-cell" }, [
    el("span", { className: `memory-main ${cls}`, text: gpu.memory.text }),
    tags.length ? el("div", { className: "term-cn", text: /GDDR7/i.test(gpu.memory.text) ? "GDDR7：新一代显存" : "GDDR6：专业卡常见显存" }) : null,
    highlightGroup(tags),
  ]);
}

function bandwidthNode(gpu) {
  const tags = [];
  if (gpu.bandwidth.gbps >= 1000) tags.push(pill("高带宽", "memory"));
  else if (gpu.bandwidth.gbps >= 600) tags.push(pill("主流带宽", "memory"));
  return el("div", { className: "bandwidth-cell" }, [
    el("span", { className: "bandwidth-main", text: gpu.bandwidth.text }),
    highlightGroup(tags),
  ]);
}

function powerNode(gpu) {
  const tags = [];
  if (gpu.power.watts <= 75) tags.push(pill("低功耗", "power"));
  else if (gpu.power.watts <= 150) tags.push(pill("易部署", "power"));
  else if (gpu.power.watts >= 300) tags.push(pill("高供电/散热", "warn"));
  return el("div", { className: "power-cell" }, [
    el("span", { className: "power-main", text: gpu.power.text }),
    highlightGroup(tags),
  ]);
}

function architectureNode(gpu) {
  const labels = {
    Blackwell: "布莱克韦尔架构",
    Ada: "艾达 Lovelace 架构",
    Ampere: "安培架构",
  };
  return el("div", { className: "term-cell" }, [
    el("div", { className: "term-main", text: gpu.architecture }),
    labels[gpu.arch] ? el("div", { className: "term-cn", text: labels[gpu.arch] }) : null,
  ]);
}

function computeNode(gpu) {
  return el("div", { className: "term-cell" }, [
    el("div", { className: "term-main", text: gpu.compute.text }),
    el("div", { className: "term-cn", text: "CUDA：通用计算核心 / Tensor：AI 矩阵核心 / RT：光追核心" }),
  ]);
}

function engineNode(gpu) {
  const tags = [];
  if (gpu.codecs.engine.nvenc >= 4) tags.push(pill("编码并发强", "engine"));
  else if (gpu.codecs.engine.nvenc >= 2) tags.push(pill("多路转码", "engine"));
  else tags.push(pill("单路/轻量", "warn"));
  if (gpu.codecs.engine.nvdec >= 2) tags.push(pill("多路解码", "engine"));
  if (/JPEG/i.test(gpu.codecs.engine.text)) tags.push(pill("JPEG 引擎", "engine"));
  return el("div", { className: "engine-cell" }, [
    el("div", { className: "engine-main", text: gpu.codecs.engine.text }),
    el("div", { className: "term-cn", text: "NVENC：硬件编码 / NVDEC：硬件解码 / JPEG：图片编解码引擎" }),
    highlightGroup(tags),
  ]);
}

function codecNode(codec, className) {
  return el("div", { className: `codec-block ${className}${codec.limited ? " codec-limited" : ""}` }, [
    el("span", { className: "codec-title", text: codec.title }),
    el("span", { className: "codec-detail", text: codec.detail }),
    el("span", { className: "codec-note", text: codec.note }),
  ]);
}

function interfaceNode(gpu) {
  const notes = [];
  if (/PCIe/i.test(gpu.busAndDisplay)) notes.push("PCIe：主板扩展总线");
  if (/\bmDP\b/i.test(gpu.busAndDisplay)) notes.push("mDP：Mini DisplayPort 小口显示接口");
  else if (/\bDP\b/i.test(gpu.busAndDisplay)) notes.push("DP：DisplayPort 显示接口");
  return el("div", { className: "term-cell" }, [
    el("div", {}, [linesFragment(gpu.busAndDisplay)]),
    notes.length ? el("div", { className: "term-cn", text: notes.join("；") }) : null,
  ]);
}

function formNode(gpu) {
  const tags = [];
  const notes = [];
  if (/\bH\s*x\b/i.test(gpu.formFactor) || /\bL\b/i.test(gpu.formFactor)) notes.push("H：高度 / L：长度");
  if (/XHFL/i.test(gpu.formFactor)) notes.push("XHFL：超高全长");
  if (/\bSFF\b/i.test(gpu.formFactor)) notes.push("SFF：小机箱版");
  if (/单槽/.test(gpu.formFactor)) tags.push(pill("单槽", "form"));
  if (/半高|SFF/i.test(gpu.formFactor)) tags.push(pill("小机箱", "form"));
  if (/双槽|双宽/.test(gpu.formFactor)) tags.push(pill("注意槽位", "form"));
  return el("div", { className: "form-cell" }, [
    el("span", { text: gpu.formFactor }),
    notes.length ? el("div", { className: "term-cn", text: notes.join("；") }) : null,
    highlightGroup(tags),
  ]);
}

function td(children, className = "") {
  return el("td", { className }, [children]);
}

function officialLink(gpu, label = gpu.official.label || "官网页") {
  return el("a", { text: label, attrs: { href: gpu.official.url, target: "_blank", rel: "noopener" } });
}

function compareInput(gpu, selectedGpuIds) {
  const input = el("input", { className: "compare-check", attrs: { type: "checkbox", "aria-label": `选择 ${gpu.model}` } });
  input.checked = selectedGpuIds.has(gpu.id);
  return input;
}

export function renderTable(tableBody, gpus, selectedGpuIds) {
  const rows = gpus.map((gpu) => {
    const row = el("tr", { className: selectedGpuIds.has(gpu.id) ? "is-selected" : "" });
    row.dataset.gpuId = gpu.id;
    row.dataset.level = gpu.level;
    append(row, [
      td(compareInput(gpu, selectedGpuIds), "select-cell"),
      td(el("img", { className: "product-img", attrs: { src: gpu.image.src, alt: gpu.image.alt } })),
      td(modelNode(gpu), "model"),
      td(generationFragment(gpu)),
      td(architectureNode(gpu)),
      td(computeNode(gpu)),
      td(memoryNode(gpu)),
      td(bandwidthNode(gpu)),
      td(powerNode(gpu)),
      td(engineNode(gpu), "codec-engine"),
      td(codecNode(gpu.codecs.hevc, "codec-hevc"), "codec-hevc"),
      td(codecNode(gpu.codecs.av1, "codec-av1"), "codec-av1"),
      td(interfaceNode(gpu)),
      td(formNode(gpu)),
      td(officialLink(gpu)),
      td(textNode(gpu.price.text), "price"),
      td(textNode(gpu.positioning)),
    ]);
    return row;
  });
  tableBody.replaceChildren(...rows);
}

export function renderLoadError(elements, error) {
  const row = el("tr", { className: "data-loading-row" }, [
    el("td", { text: `GPU 数据加载失败：${error.message}`, attrs: { colspan: "17" } }),
  ]);
  elements.tableBody.replaceChildren(row);
  elements.hevcShelf.replaceChildren(el("div", { className: "hevc-empty", text: "GPU 数据加载失败，请检查 data/gpu-catalog.json 和 data/market-prices.json。" }));
}

function cardTags(gpu) {
  const tags = [];
  if (gpu.supports422) tags.push(pill("H.265 4:2:2", "codec"));
  if (gpu.av1Encode) tags.push(pill("AV1 输出", "codec"));
  if (gpu.codecs.engine.nvdec >= 3) tags.push(pill(`${gpu.codecs.engine.nvdec}x NVDEC`, "engine"));
  if (gpu.codecs.engine.nvenc >= 3) tags.push(pill(`${gpu.codecs.engine.nvenc}x NVENC`, "engine"));
  if (gpu.memory.gb >= 48) tags.push(pill(`${gpu.memory.gb}GB 显存`, "memory"));
  if (gpu.lowPower) tags.push(pill(`${gpu.power.watts}W 低功耗`, "power"));
  if (gpu.compact) tags.push(pill("部署友好", "form"));
  if (gpu.weakMain) tags.push(pill("非主力", "warn"));
  return tags;
}

function hevcSpec(label, value) {
  return el("div", { className: "hevc-spec" }, [
    el("span", { text: label }),
    el("strong", { text: value }),
  ]);
}

function hevcCard(gpu, idx, maxScore, selectedGpuIds) {
  const checked = selectedGpuIds.has(gpu.id);
  const scoreWidth = Math.max(8, Math.min(100, Math.round((gpu.score / maxScore) * 100)));
  const decodeText = gpu.supports422 ? "4:2:0 / 4:2:2 / 4:4:4" : "4:2:0 / 4:4:4";
  const av1Text = gpu.av1Encode ? "编码+解码" : "仅解码/播放";
  const article = el("article", { className: `hevc-card ${checked ? "is-compared" : ""}`.trim() });
  article.dataset.gpuId = gpu.id;

  const scoreBar = el("span");
  scoreBar.style.width = `${scoreWidth}%`;

  const button = el("button", { className: "hevc-compare-btn", text: checked ? "取消对比" : "加入对比", attrs: { type: "button" } });
  button.dataset.gpuId = gpu.id;

  append(article, [
    el("span", { className: "hevc-rank", text: `#${idx + 1}` }),
    el("div", {}, [
      el("div", { className: "hevc-media" }, [el("img", { attrs: { src: gpu.image.src, alt: gpu.image.alt } })]),
      el("div", { className: "hevc-card-tags" }, cardTags(gpu)),
    ]),
    el("div", {}, [
      el("div", { className: "hevc-title", text: gpu.model }),
      el("div", { className: "term-cn", text: `${gpu.arch} / ${generationText(gpu)}` }),
      el("div", { className: "hevc-price", text: gpu.price.text }),
      el("div", { className: "hevc-score" }, [
        el("div", { className: "hevc-score-top" }, [el("span", { text: "综合能力" }), el("strong", { text: gpu.score })]),
        el("div", { className: "hevc-score-bar" }, [scoreBar]),
      ]),
      el("div", { className: "hevc-spec-grid" }, [
        hevcSpec("编解码引擎", `${gpu.codecs.engine.nvenc}x NVENC / ${gpu.codecs.engine.nvdec}x NVDEC`),
        hevcSpec("H.265 硬解", decodeText),
        hevcSpec("AV1", av1Text),
        hevcSpec("显存 / 功耗", `${gpu.memory.gb}GB / ${gpu.power.watts || "-"}W`),
      ]),
      el("p", { className: "cell-note hevc-card-advice", text: gpu.positioning }),
      el("div", { className: "hevc-card-actions" }, [button, officialLink(gpu, "丽台官网")]),
    ]),
  ]);
  return article;
}

export function renderHevcShelf({ elements, gpus, items, selectedGpuIds, sortNoteText }) {
  elements.hevcResultCount.textContent = String(items.length);
  elements.hevcSortNote.textContent = sortNoteText;
  if (!items.length) {
    elements.hevcShelf.replaceChildren(el("div", { className: "hevc-empty", text: "没有符合当前条件的型号。可以放宽 NVDEC、显存、功耗或 4:2:2 / AV1 条件。" }));
    return;
  }
  const maxScore = Math.max(...gpus.map((gpu) => gpu.score), 1);
  elements.hevcShelf.replaceChildren(...items.map((gpu, idx) => hevcCard(gpu, idx, maxScore, selectedGpuIds)));
}

export function renderComparison(elements, selected) {
  elements.comparePanel.classList.add("is-visible");
  if (selected.length < 2) {
    elements.compareOutput.replaceChildren(el("div", { className: "empty-compare", text: "请至少勾选 2 款型号后再生成对比。" }));
    return;
  }

  const table = el("table");
  const headerRow = el("tr", {}, [el("th", { text: "项目" }), ...selected.map((gpu) => el("th", {}, [modelNode(gpu)]))]);
  const bodyRows = compareColumns.map((column) => {
    const row = el("tr", {}, [el("th", { text: column.label })]);
    append(row, selected.map((gpu) => td(column.render(gpu))));
    return row;
  });
  append(table, [el("thead", {}, [headerRow]), el("tbody", {}, bodyRows)]);
  elements.compareOutput.replaceChildren(el("div", { className: "table-wrap" }, [table]));
  elements.comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}
