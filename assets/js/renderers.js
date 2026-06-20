import { escapeHtml, htmlLines, pill } from "./utils.js";
import { externalSummary, generationText } from "./view-model.js";

const compareColumns = [
  { label: "代际/时间", render: (gpu) => generationText(gpu) },
  { label: "架构", render: (gpu) => gpu.architecture },
  { label: "CUDA / Tensor / RT", render: (gpu) => gpu.compute.text },
  { label: "显存", render: (gpu) => memoryHtml(gpu) },
  { label: "位宽 / 带宽", render: (gpu) => bandwidthHtml(gpu) },
  { label: "功耗", render: (gpu) => powerHtml(gpu) },
  { label: "NVENC / NVDEC", render: (gpu) => engineHtml(gpu) },
  { label: "H.265 硬解规格", render: (gpu) => codecHtml(gpu.codecs.hevc, "codec-hevc") },
  { label: "AV1 输出能力", render: (gpu) => codecHtml(gpu.codecs.av1, "codec-av1") },
  { label: "总线 / 显示接口", render: (gpu) => interfaceHtml(gpu) },
  { label: "外形规格", render: (gpu) => formHtml(gpu) },
  { label: "市场参考价", render: (gpu) => gpu.price.text },
  { label: "定位建议", render: (gpu) => adviceHtml(gpu) },
];

function generationHtml(gpu) {
  const label = gpu.generation?.label ? `<span class="tag">${escapeHtml(gpu.generation.label)}</span>` : "";
  const year = gpu.generation?.text ? `<br>${escapeHtml(gpu.generation.text)}` : "";
  return `${label}${year}`;
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
  return tags.slice(0, 5).join("");
}

function modelHtml(gpu) {
  const notes = [];
  if (/\bSFF\b/i.test(gpu.model)) notes.push("SFF：小机箱版");
  if (/Max-Q/i.test(gpu.model)) notes.push("Max-Q：低功耗版本");
  if (/Workstation/i.test(gpu.model)) notes.push("Workstation：工作站版");
  if (/Generation/i.test(gpu.model)) notes.push("Generation：这一代型号命名");
  return `
    ${escapeHtml(gpu.model)}
    ${notes.length ? `<div class="term-cn model-term-note">${escapeHtml(notes.join("；"))}</div>` : ""}
    ${modelTags(gpu) ? `<div class="feature-strip">${modelTags(gpu)}</div>` : ""}
  `;
}

function memoryHtml(gpu) {
  const tags = [];
  if (gpu.memory.gb >= 72) tags.push(pill("超大显存", "memory"));
  else if (gpu.memory.gb >= 48) tags.push(pill("大显存", "memory"));
  else if (gpu.memory.gb >= 24) tags.push(pill("视频服务器主流", "memory"));
  else if (gpu.memory.gb <= 8) tags.push(pill("轻量/多屏", "warn"));
  if (gpu.memory.ecc) tags.push(pill("ECC", "memory"));
  if (/GDDR7/i.test(gpu.memory.text)) tags.push(pill("GDDR7", "memory"));
  const cls = gpu.memory.gb >= 48 ? "memory-xl" : gpu.memory.gb >= 24 ? "memory-lg" : "memory-mid";
  return `
    <div class="memory-cell">
      <span class="memory-main ${cls}">${escapeHtml(gpu.memory.text)}</span>
      ${tags.length ? `<div class="term-cn">${/GDDR7/i.test(gpu.memory.text) ? "GDDR7：新一代显存" : "GDDR6：专业卡常见显存"}</div>` : ""}
      ${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}
    </div>
  `;
}

function bandwidthHtml(gpu) {
  const tags = [];
  if (gpu.bandwidth.gbps >= 1000) tags.push(pill("高带宽", "memory"));
  else if (gpu.bandwidth.gbps >= 600) tags.push(pill("主流带宽", "memory"));
  return `<div class="bandwidth-cell"><span class="bandwidth-main">${escapeHtml(gpu.bandwidth.text)}</span>${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}</div>`;
}

function powerHtml(gpu) {
  const tags = [];
  if (gpu.power.watts <= 75) tags.push(pill("低功耗", "power"));
  else if (gpu.power.watts <= 150) tags.push(pill("易部署", "power"));
  else if (gpu.power.watts >= 300) tags.push(pill("高供电/散热", "warn"));
  return `<div class="power-cell"><span class="power-main">${escapeHtml(gpu.power.text)}</span>${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}</div>`;
}

function architectureHtml(gpu) {
  const labels = { Blackwell: "布莱克韦尔架构", Ada: "艾达 Lovelace 架构", Ampere: "安培架构" };
  return `<div class="term-cell"><div class="term-main">${escapeHtml(gpu.architecture)}</div>${labels[gpu.arch] ? `<div class="term-cn">${escapeHtml(labels[gpu.arch])}</div>` : ""}</div>`;
}

function computeHtml(gpu) {
  return `<div class="term-cell"><div class="term-main">${escapeHtml(gpu.compute.text)}</div><div class="term-cn">CUDA：通用计算核心 / Tensor：AI 矩阵核心 / RT：光追核心</div></div>`;
}

function engineHtml(gpu) {
  const tags = [];
  if (gpu.codecs.engine.nvenc >= 4) tags.push(pill("编码并发强", "engine"));
  else if (gpu.codecs.engine.nvenc >= 2) tags.push(pill("多路转码", "engine"));
  else tags.push(pill("单路/轻量", "warn"));
  if (gpu.codecs.engine.nvdec >= 2) tags.push(pill("多路解码", "engine"));
  if (/JPEG/i.test(gpu.codecs.engine.text)) tags.push(pill("JPEG 引擎", "engine"));
  return `<div class="engine-cell"><div class="engine-main">${escapeHtml(gpu.codecs.engine.text)}</div><div class="term-cn">NVENC：硬件编码 / NVDEC：硬件解码 / JPEG：图片编解码引擎</div><div class="cell-highlights">${tags.join("")}</div></div>`;
}

function codecHtml(codec, cls) {
  const limited = codec.limited ? " codec-limited" : "";
  return `<div class="codec-block ${cls}${limited}"><span class="codec-title">${escapeHtml(codec.title)}</span><span class="codec-detail">${escapeHtml(codec.detail)}</span><span class="codec-note">${escapeHtml(codec.note)}</span></div>`;
}

function interfaceHtml(gpu) {
  const notes = [];
  if (/PCIe/i.test(gpu.busAndDisplay)) notes.push("PCIe：主板扩展总线");
  if (/\bmDP\b/i.test(gpu.busAndDisplay)) notes.push("mDP：Mini DisplayPort 小口显示接口");
  else if (/\bDP\b/i.test(gpu.busAndDisplay)) notes.push("DP：DisplayPort 显示接口");
  return `<div class="term-cell"><div>${htmlLines(gpu.busAndDisplay)}</div>${notes.length ? `<div class="term-cn">${escapeHtml(notes.join("；"))}</div>` : ""}</div>`;
}

function formHtml(gpu) {
  const tags = [];
  const notes = [];
  if (/\bH\s*x\b/i.test(gpu.formFactor) || /\bL\b/i.test(gpu.formFactor)) notes.push("H：高度 / L：长度");
  if (/XHFL/i.test(gpu.formFactor)) notes.push("XHFL：超高全长");
  if (/\bSFF\b/i.test(gpu.formFactor)) notes.push("SFF：小机箱版");
  if (/单槽/.test(gpu.formFactor)) tags.push(pill("单槽", "form"));
  if (/半高|SFF/i.test(gpu.formFactor)) tags.push(pill("小机箱", "form"));
  if (/双槽|双宽/.test(gpu.formFactor)) tags.push(pill("注意槽位", "form"));
  return `<div class="form-cell"><span>${escapeHtml(gpu.formFactor)}</span>${notes.length ? `<div class="term-cn">${escapeHtml(notes.join("；"))}</div>` : ""}${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}</div>`;
}

function resultSummary(item) {
  const parts = [];
  if (item["测试项"]) parts.push(item["测试项"]);
  if (item["测试结果"]) parts.push(`结果：${item["测试结果"]}`);
  if (item["结论"]) parts.push(`结论：${item["结论"]}`);
  if (item["备注"]) parts.push(`备注：${item["备注"]}`);
  if (item["维护人"]) parts.push(`维护人：${item["维护人"]}`);
  if (item["更新时间"]) parts.push(`更新时间：${item["更新时间"]}`);
  return parts;
}

function externalResultHtml(gpu) {
  if (!gpu.externalResults?.length) return "";
  const blocks = gpu.externalResults.map((item) => {
    const summary = resultSummary(item).map(escapeHtml).join("<br>");
    return `<div><strong>企业文档测试结果</strong><br>${summary}</div>`;
  }).join("");
  return `<div class="external-test-result">${blocks}</div>`;
}

function adviceHtml(gpu) {
  return `${escapeHtml(gpu.positioning)}${externalResultHtml(gpu)}`;
}

export function renderTable(tableBody, gpus, selectedGpuIds) {
  tableBody.innerHTML = gpus.map((gpu) => `
    <tr data-gpu-id="${escapeHtml(gpu.id)}" data-level="${escapeHtml(gpu.level)}" class="${selectedGpuIds.has(gpu.id) ? "is-selected" : ""}">
      <td class="select-cell"><input class="compare-check" type="checkbox" aria-label="选择 ${escapeHtml(gpu.model)}" ${selectedGpuIds.has(gpu.id) ? "checked" : ""}></td>
      <td><img class="product-img" src="${escapeHtml(gpu.image.src)}" alt="${escapeHtml(gpu.image.alt)}"></td>
      <td class="model">${modelHtml(gpu)}</td>
      <td>${generationHtml(gpu)}</td>
      <td>${architectureHtml(gpu)}</td>
      <td>${computeHtml(gpu)}</td>
      <td>${memoryHtml(gpu)}</td>
      <td>${bandwidthHtml(gpu)}</td>
      <td>${powerHtml(gpu)}</td>
      <td class="codec-engine">${engineHtml(gpu)}</td>
      <td class="codec-hevc">${codecHtml(gpu.codecs.hevc, "codec-hevc")}</td>
      <td class="codec-av1">${codecHtml(gpu.codecs.av1, "codec-av1")}</td>
      <td>${interfaceHtml(gpu)}</td>
      <td>${formHtml(gpu)}</td>
      <td><a href="${escapeHtml(gpu.official.url)}" target="_blank" rel="noopener">${escapeHtml(gpu.official.label || "官网页")}</a></td>
      <td class="price">${escapeHtml(gpu.price.text)}</td>
      <td>${adviceHtml(gpu)}</td>
    </tr>
  `).join("");
}

export function renderLoadError(elements, error) {
  elements.tableBody.innerHTML = `<tr class="data-loading-row"><td colspan="17">GPU 数据加载失败：${escapeHtml(error.message)}</td></tr>`;
  elements.hevcShelf.innerHTML = `<div class="hevc-empty">GPU 数据加载失败，请检查 data/gpu-catalog.json 和 data/market-prices.json。</div>`;
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
  return tags.join("");
}

function cardAdviceHtml(gpu) {
  const pieces = [`<p class="cell-note hevc-card-advice">${escapeHtml(gpu.positioning)}</p>`];
  if (gpu.externalResults.length) {
    pieces.push(`<p class="hevc-card-test-summary">企业测试：${gpu.externalResults.length} 条；${escapeHtml(externalSummary(gpu))}</p>`);
  }
  return pieces.join("");
}

export function renderHevcShelf({ elements, gpus, items, selectedGpuIds, sortNoteText }) {
  elements.hevcResultCount.textContent = items.length;
  elements.hevcSortNote.textContent = sortNoteText;
  if (!items.length) {
    elements.hevcShelf.innerHTML = '<div class="hevc-empty">没有符合当前条件的型号。可以放宽 NVDEC、显存、功耗或 4:2:2 / AV1 条件。</div>';
    return;
  }
  const maxScore = Math.max(...gpus.map((gpu) => gpu.score), 1);
  elements.hevcShelf.innerHTML = items.map((gpu, idx) => {
    const checked = selectedGpuIds.has(gpu.id);
    const scoreWidth = Math.max(8, Math.min(100, Math.round(gpu.score / maxScore * 100)));
    const decodeText = gpu.supports422 ? "4:2:0 / 4:2:2 / 4:4:4" : "4:2:0 / 4:4:4";
    const av1Text = gpu.av1Encode ? "编码+解码" : "仅解码/播放";
    return `
      <article class="hevc-card ${checked ? "is-compared" : ""}" data-gpu-id="${escapeHtml(gpu.id)}">
        <span class="hevc-rank">#${idx + 1}</span>
        <div>
          <div class="hevc-media"><img src="${escapeHtml(gpu.image.src)}" alt="${escapeHtml(gpu.image.alt)}"></div>
          <div class="hevc-card-tags">${cardTags(gpu)}</div>
        </div>
        <div>
          <div class="hevc-title">${escapeHtml(gpu.model)}</div>
          <div class="term-cn">${escapeHtml(gpu.arch)} / ${escapeHtml(generationText(gpu))}</div>
          <div class="hevc-price">${escapeHtml(gpu.price.text)}</div>
          <div class="hevc-score">
            <div class="hevc-score-top"><span>综合能力</span><strong>${gpu.score}</strong></div>
            <div class="hevc-score-bar"><span style="width:${scoreWidth}%"></span></div>
          </div>
          <div class="hevc-spec-grid">
            <div class="hevc-spec"><span>编解码引擎</span><strong>${gpu.codecs.engine.nvenc}x NVENC / ${gpu.codecs.engine.nvdec}x NVDEC</strong></div>
            <div class="hevc-spec"><span>H.265 硬解</span><strong>${decodeText}</strong></div>
            <div class="hevc-spec"><span>AV1</span><strong>${av1Text}</strong></div>
            <div class="hevc-spec"><span>显存 / 功耗</span><strong>${gpu.memory.gb}GB / ${gpu.power.watts || "-"}W</strong></div>
          </div>
          ${cardAdviceHtml(gpu)}
          <div class="hevc-card-actions">
            <button type="button" class="hevc-compare-btn" data-gpu-id="${escapeHtml(gpu.id)}">${checked ? "取消对比" : "加入对比"}</button>
            <a href="${escapeHtml(gpu.official.url)}" target="_blank" rel="noopener">丽台官网</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

export function renderComparison(elements, selected) {
  if (selected.length < 2) {
    elements.comparePanel.classList.add("is-visible");
    elements.compareOutput.innerHTML = '<div class="empty-compare">请至少勾选 2 款型号后再生成对比。</div>';
    return;
  }
  const header = selected.map((gpu) => `<th>${modelHtml(gpu)}</th>`).join("");
  const body = compareColumns.map((column) => {
    const values = selected.map((gpu) => `<td>${column.render(gpu)}</td>`).join("");
    return `<tr><th>${escapeHtml(column.label)}</th>${values}</tr>`;
  }).join("");
  elements.compareOutput.innerHTML = `<div class="table-wrap"><table><thead><tr><th>项目</th>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
  elements.comparePanel.classList.add("is-visible");
  elements.comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}
