    (() => {
      const table = document.getElementById("gpuTable");
      const checks = Array.from(table.querySelectorAll(".compare-check"));
      const compareCount = document.getElementById("compareCount");
      const buildCompare = document.getElementById("buildCompare");
      const clearCompare = document.getElementById("clearCompare");
      const toggleSelectedOnly = document.getElementById("toggleSelectedOnly");
      const comparePanel = document.getElementById("comparePanel");
      const compareOutput = document.getElementById("compareOutput");
      const levelButtons = Array.from(document.querySelectorAll(".level-btn"));
      const fullViewBtn = document.getElementById("fullViewBtn");
      const compactViewBtn = document.getElementById("compactViewBtn");
      const hevcShelf = document.getElementById("hevcShelf");
      const hevcResultCount = document.getElementById("hevcResultCount");
      const hevcSearch = document.getElementById("hevcSearch");
      const hevcSort = document.getElementById("hevcSort");
      const hevcLevel = document.getElementById("hevcLevel");
      const hevcArch = document.getElementById("hevcArch");
      const hevcMinNvdec = document.getElementById("hevcMinNvdec");
      const hevcMinMemory = document.getElementById("hevcMinMemory");
      const hevcMaxPower = document.getElementById("hevcMaxPower");
      const hevcNeed422 = document.getElementById("hevcNeed422");
      const hevcNeedAv1 = document.getElementById("hevcNeedAv1");
      const hevcLowPower = document.getElementById("hevcLowPower");
      const hevcHideWeak = document.getElementById("hevcHideWeak");
      const hevcReset = document.getElementById("hevcReset");
      const hevcSortNote = document.getElementById("hevcSortNote");
      const syncPanel = document.getElementById("syncPanel");
      const syncStatusText = document.getElementById("syncStatusText");
      const syncStatusMeta = document.getElementById("syncStatusMeta");
      const externalResultsUrl = "data/gpu-test-results.json";
      let selectedOnly = false;
      let activeLevel = "all";
      let lastExternalSyncAt = "";

      const columns = [
        { label: "型号", index: 2 },
        { label: "代际/时间", index: 3 },
        { label: "架构", index: 4 },
        { label: "CUDA / Tensor / RT", index: 5 },
        { label: "显存", index: 6 },
        { label: "位宽 / 带宽", index: 7 },
        { label: "功耗", index: 8 },
        { label: "NVENC / NVDEC", index: 9 },
        { label: "H.265 硬解规格", index: 10 },
        { label: "AV1 输出能力", index: 11 },
        { label: "总线 / 显示接口", index: 12 },
        { label: "外形规格", index: 13 },
        { label: "市场参考价", index: 15 },
        { label: "定位建议", index: 16 }
      ];

      function selectedRows() {
        return checks
          .filter((check) => check.checked)
          .map((check) => check.closest("tr"));
      }

      function textFromCell(row, index) {
        const cell = row.cells[index];
        if (!cell) return "";
        return cell.innerText.replace(/\s+/g, " ").trim();
      }

      function htmlFromCell(row, index) {
        const cell = row.cells[index];
        if (!cell) return "";
        return cell.innerHTML.trim();
      }

      function pill(text, type = "") {
        return `<span class="feature-pill ${type}">${text}</span>`;
      }

      function baseText(cell) {
        if (!cell) return "";
        if (!cell.dataset.baseText) {
          cell.dataset.baseText = cell.innerText.replace(/\s+/g, " ").trim();
        }
        return cell.dataset.baseText;
      }

      function baseHtml(cell) {
        if (!cell) return "";
        if (!cell.dataset.baseHtml) {
          cell.dataset.baseHtml = cell.innerHTML.trim();
        }
        return cell.dataset.baseHtml;
      }

      function escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function normalizeModelName(value) {
        return String(value ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[™®]/g, "")
          .trim();
      }

      function setSyncStatus(type, text, meta) {
        if (!syncPanel) return;
        syncPanel.classList.toggle("is-ok", type === "ok");
        syncPanel.classList.toggle("is-warn", type === "warn");
        syncPanel.classList.toggle("is-error", type === "error");
        syncStatusText.textContent = text;
        syncStatusMeta.textContent = meta;
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

      function clearExternalResults() {
        table.querySelectorAll(".external-test-result").forEach((node) => node.remove());
        table.querySelectorAll("tbody tr").forEach((row) => {
          delete row.dataset.externalResultCount;
          delete row.dataset.externalResultSummary;
        });
      }

      function applyExternalResults(payload) {
        const rows = Array.from(table.querySelectorAll("tbody tr"));
        const resultMap = new Map();
        (payload.rows || []).forEach((item) => {
          const model = item["型号"] || item.model || item.gpu || "";
          const key = normalizeModelName(model);
          if (!key) return;
          if (!resultMap.has(key)) resultMap.set(key, []);
          resultMap.get(key).push(item);
        });

        clearExternalResults();

        let matched = 0;
        rows.forEach((row) => {
          const model = normalizeModelName(baseText(row.cells[2]));
          const items = resultMap.get(model);
          if (!items?.length) return;
          matched += 1;
          const adviceCell = row.cells[16];
          row.dataset.externalResultCount = String(items.length);
          row.dataset.externalResultSummary = items
            .slice(0, 2)
            .map((item) => `${item["测试项"] || "测试"}：${item["结论"] || "有测试记录"}`)
            .join("；");
          const blocks = items.map((item) => {
            const summary = resultSummary(item).map(escapeHtml).join("<br>");
            return `<div><strong>企业文档测试结果</strong><br>${summary}</div>`;
          }).join("");
          adviceCell.insertAdjacentHTML("beforeend", `<div class="external-test-result">${blocks}</div>`);
        });

        return matched;
      }

      async function loadExternalResults() {
        try {
          const response = await fetch(`${externalResultsUrl}?t=${Date.now()}`, { cache: "no-store" });
          if (response.status === 404) {
            setSyncStatus("warn", "企业文档同步未连接", "未找到 data/gpu-test-results.json，当前显示内置静态数据。");
            return;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (payload.syncedAt && payload.syncedAt === lastExternalSyncAt) return;
          lastExternalSyncAt = payload.syncedAt || new Date().toISOString();
          const matched = applyExternalResults(payload);
          setSyncStatus("ok", "企业文档同步已连接", `最后同步：${lastExternalSyncAt}，匹配 ${matched} 款型号。`);
          renderHevcShelf();
        } catch (error) {
          setSyncStatus("error", "企业文档同步读取失败", `${error.message}。当前显示内置静态数据。`);
        }
      }

      function parseYear(text) {
        const years = (text.match(/20\d{2}/g) || []).map(Number);
        return years.length ? Math.max(...years) : 0;
      }

      function parsePriceValue(text) {
        if (/询价|公开价少|库存差异/.test(text)) return 999999;
        const values = [];
        const wanMatches = text.matchAll(/([\d.]+)\s*万/g);
        for (const match of wanMatches) values.push(Number(match[1]) * 10000);
        const yuanMatches = text.matchAll(/￥\s*([\d.]+)/g);
        for (const match of yuanMatches) {
          const value = Number(match[1]);
          if (Number.isFinite(value)) values.push(value);
        }
        const plainMatches = text.matchAll(/(?:约|￥|-|到|\s)(\d{4,6})(?=\D|$)/g);
        for (const match of plainMatches) values.push(Number(match[1]));
        return values.length ? Math.min(...values) : 999999;
      }

      function parseGpu(row, index) {
        const model = baseText(row.cells[2]).split(/\n/)[0].trim();
        const generationText = textFromCell(row, 3);
        const archText = textFromCell(row, 4);
        const computeText = textFromCell(row, 5);
        const memoryText = textFromCell(row, 6);
        const bandwidthText = textFromCell(row, 7);
        const powerText = textFromCell(row, 8);
        const engineText = textFromCell(row, 9);
        const hevcText = textFromCell(row, 10);
        const av1Text = textFromCell(row, 11);
        const formText = textFromCell(row, 13);
        const priceText = textFromCell(row, 15);
        const advice = textFromCell(row, 16);
        const baseAdvice = advice.split(" 企业文档测试结果 ")[0].trim() || advice;
        const externalResultCount = Number(row.dataset.externalResultCount || 0);
        const externalResultSummary = row.dataset.externalResultSummary || "";
        const image = row.cells[1]?.querySelector("img")?.getAttribute("src") || "";
        const link = row.cells[14]?.querySelector("a")?.getAttribute("href") || "#";
        const enc = Number((engineText.match(/(\d+)x\s*NVENC/i) || [])[1]) || 0;
        const dec = Number((engineText.match(/(\d+)x\s*NVDEC/i) || [])[1]) || 0;
        const jpeg = Number((engineText.match(/(\d+)x\s*JPEG/i) || [])[1]) || 0;
        const memory = Number((memoryText.match(/(\d+)\s*GB/i) || [])[1]) || 0;
        const bandwidth = Number((bandwidthText.match(/(\d+)\s*GB\/s/i) || [])[1]) || 0;
        const power = Number((powerText.match(/(\d+)W/i) || [])[1]) || 0;
        const cuda = Number((computeText.match(/(\d+)/) || [])[1]) || 0;
        const supports422 = /4:2:2/.test(hevcText) && !/不支持/.test(hevcText);
        const av1Encode = /AV1 输出：支持/.test(av1Text);
        const isBlackwell = /Blackwell/i.test(archText + " " + model);
        const isAda = /Ada/i.test(archText + " " + model);
        const isAmpere = /Ampere/i.test(archText + " " + model);
        const lowPower = power > 0 && power <= 75;
        const compact = /SFF|半高|单槽/i.test(model + " " + formText);
        const weakMain = /不建议做主力|A1000|A400|A2000/i.test(advice + " " + model);
        const priceValue = parsePriceValue(priceText);
        const year = parseYear(generationText);
        const score = Math.round(
          (isBlackwell ? 28 : isAda ? 17 : 7) +
          enc * 9 +
          dec * 10 +
          (supports422 ? 18 : 0) +
          (av1Encode ? 12 : 0) +
          Math.min(memory, 96) * 0.35 +
          Math.min(bandwidth, 1800) / 120 +
          (jpeg ? 2 : 0) +
          (lowPower ? 4 : 0) -
          (power >= 300 ? 4 : 0) -
          (weakMain ? 7 : 0)
        );
        return {
          row,
          index,
          model,
          generationText,
          level: row.dataset.level || "",
          arch: isBlackwell ? "Blackwell" : isAda ? "Ada" : isAmpere ? "Ampere" : "其他",
          archText,
          computeText,
          memoryText,
          memory,
          bandwidthText,
          bandwidth,
          powerText,
          power,
          engineText,
          enc,
          dec,
          jpeg,
          hevcText,
          av1Text,
          formText,
          priceText,
          priceValue,
          advice,
          baseAdvice,
          externalResultCount,
          externalResultSummary,
          image,
          link,
          supports422,
          av1Encode,
          lowPower,
          compact,
          weakMain,
          year,
          cuda,
          score
        };
      }

      function hevcData() {
        return Array.from(table.querySelectorAll("tbody tr")).map(parseGpu);
      }

      function hevcState() {
        return {
          q: hevcSearch.value.trim().toLowerCase(),
          sort: hevcSort.value,
          level: hevcLevel.value,
          arch: hevcArch.value,
          minNvdec: Number(hevcMinNvdec.value),
          minMemory: Number(hevcMinMemory.value),
          maxPower: Number(hevcMaxPower.value),
          need422: hevcNeed422.checked,
          needAv1: hevcNeedAv1.checked,
          lowPower: hevcLowPower.checked,
          hideWeak: hevcHideWeak.checked
        };
      }

      function filteredHevcItems() {
        const state = hevcState();
        const items = hevcData().filter((item) => {
          const haystack = [
            item.model,
            item.archText,
            item.memoryText,
            item.engineText,
            item.hevcText,
            item.av1Text,
            item.priceText,
            item.advice
          ].join(" ").toLowerCase();
          if (state.q && !haystack.includes(state.q)) return false;
          if (state.level !== "all" && item.level !== state.level) return false;
          if (state.arch !== "all" && item.arch !== state.arch) return false;
          if (item.dec < state.minNvdec) return false;
          if (item.memory < state.minMemory) return false;
          if (item.power && item.power > state.maxPower) return false;
          if (state.need422 && !item.supports422) return false;
          if (state.needAv1 && !item.av1Encode) return false;
          if (state.lowPower && !(item.lowPower || item.compact)) return false;
          if (state.hideWeak && item.weakMain) return false;
          return true;
        });
        const sorters = {
          score: (a, b) => b.score - a.score || b.dec - a.dec || b.enc - a.enc || b.memory - a.memory,
          nvdec: (a, b) => b.dec - a.dec || b.score - a.score,
          nvenc: (a, b) => b.enc - a.enc || b.score - a.score,
          memory: (a, b) => b.memory - a.memory || b.score - a.score,
          power: (a, b) => (a.power || 999) - (b.power || 999) || b.score - a.score,
          price: (a, b) => a.priceValue - b.priceValue || b.score - a.score,
          year: (a, b) => b.year - a.year || b.score - a.score
        };
        return items.sort(sorters[state.sort] || sorters.score);
      }

      function sortNote() {
        const labels = {
          score: "当前按视频服务器综合能力排序：4:2:2、AV1、NVENC/NVDEC、显存、带宽、功耗共同计分。",
          nvdec: "当前按 NVDEC 解码引擎数量排序，适合多路拉流、解码和转码入口评估。",
          nvenc: "当前按 NVENC 编码引擎数量排序，适合多路输出和转码并发评估。",
          memory: "当前按显存容量排序，适合本地大模型、超大场景和多任务余量评估。",
          power: "当前按低功耗排序，适合小机箱、边缘节点和多卡密度评估。",
          price: "当前按预算价低优先排序，询价/公开价少的型号会排在后面。",
          year: "当前按发布时间新优先排序，适合新采购和生命周期评估。"
        };
        return labels[hevcSort.value] || labels.score;
      }

      function cardTags(item) {
        const tags = [];
        if (item.supports422) tags.push(pill("H.265 4:2:2", "codec"));
        if (item.av1Encode) tags.push(pill("AV1 输出", "codec"));
        if (item.dec >= 3) tags.push(pill(`${item.dec}x NVDEC`, "engine"));
        if (item.enc >= 3) tags.push(pill(`${item.enc}x NVENC`, "engine"));
        if (item.memory >= 48) tags.push(pill(`${item.memory}GB 显存`, "memory"));
        if (item.lowPower) tags.push(pill(`${item.power}W 低功耗`, "power"));
        if (item.compact) tags.push(pill("部署友好", "form"));
        if (item.weakMain) tags.push(pill("非主力", "warn"));
        return tags.join("");
      }

      function cardAdviceHtml(item) {
        const pieces = [
          `<p class="cell-note hevc-card-advice">${escapeHtml(item.baseAdvice || item.advice)}</p>`
        ];
        if (item.externalResultCount) {
          pieces.push(
            `<p class="hevc-card-test-summary">企业测试：${item.externalResultCount} 条；${escapeHtml(item.externalResultSummary)}</p>`
          );
        }
        return pieces.join("");
      }

      function renderHevcShelf() {
        const items = filteredHevcItems();
        hevcResultCount.textContent = items.length;
        hevcSortNote.textContent = sortNote();
        if (!items.length) {
          hevcShelf.innerHTML = '<div class="hevc-empty">没有符合当前条件的型号。可以放宽 NVDEC、显存、功耗或 4:2:2 / AV1 条件。</div>';
          return;
        }
        const maxScore = Math.max(...hevcData().map((item) => item.score), 1);
        hevcShelf.innerHTML = items.map((item, idx) => {
          const checked = item.row.querySelector(".compare-check")?.checked;
          const scoreWidth = Math.max(8, Math.min(100, Math.round(item.score / maxScore * 100)));
          const decodeText = item.supports422 ? "4:2:0 / 4:2:2 / 4:4:4" : "4:2:0 / 4:4:4";
          const av1Text = item.av1Encode ? "编码+解码" : "仅解码/播放";
          return `
            <article class="hevc-card ${checked ? "is-compared" : ""}" data-row-index="${item.index}">
              <span class="hevc-rank">#${idx + 1}</span>
              <div>
                <div class="hevc-media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.model)}"></div>
                <div class="hevc-card-tags">${cardTags(item)}</div>
              </div>
              <div>
                <div class="hevc-title">${escapeHtml(item.model)}</div>
                <div class="term-cn">${escapeHtml(item.arch)} · ${escapeHtml(item.generationText)}</div>
                <div class="hevc-price">${escapeHtml(item.priceText)}</div>
                <div class="hevc-score">
                  <div class="hevc-score-top"><span>综合能力</span><strong>${item.score}</strong></div>
                  <div class="hevc-score-bar"><span style="width:${scoreWidth}%"></span></div>
                </div>
                <div class="hevc-spec-grid">
                  <div class="hevc-spec"><span>编解码引擎</span><strong>${item.enc}x NVENC / ${item.dec}x NVDEC</strong></div>
                  <div class="hevc-spec"><span>H.265 硬解</span><strong>${decodeText}</strong></div>
                  <div class="hevc-spec"><span>AV1</span><strong>${av1Text}</strong></div>
                  <div class="hevc-spec"><span>显存 / 功耗</span><strong>${item.memory}GB / ${item.power || "-"}W</strong></div>
                </div>
                ${cardAdviceHtml(item)}
                <div class="hevc-card-actions">
                  <button type="button" class="hevc-compare-btn" data-row-index="${item.index}">${checked ? "取消对比" : "加入对比"}</button>
                  <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">丽台官网</a>
                </div>
              </div>
            </article>
          `;
        }).join("");
      }

      function highlightMemory(cell) {
        const text = baseText(cell);
        const match = text.match(/(\d+)\s*GB/i);
        if (!match) return;

        const gb = Number(match[1]);
        const memoryClass = gb >= 48 ? "memory-xl" : gb >= 24 ? "memory-lg" : "memory-mid";
        const tags = [];
        if (gb >= 72) tags.push(pill("超大显存", "memory"));
        else if (gb >= 48) tags.push(pill("大显存", "memory"));
        else if (gb >= 24) tags.push(pill("视频服务器主流", "memory"));
        else if (gb <= 8) tags.push(pill("轻量/多屏", "warn"));
        if (/ECC/i.test(text)) tags.push(pill("ECC", "memory"));
        if (/GDDR7/i.test(text)) tags.push(pill("GDDR7", "memory"));

        cell.innerHTML = `
          <div class="memory-cell">
            <span class="memory-main ${memoryClass}">${text}</span>
            ${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}
          </div>
        `;
      }

      function highlightBandwidth(cell) {
        const text = baseText(cell);
        const match = text.match(/(\d+)\s*GB\/s/i);
        if (!match) return;
        const bandwidth = Number(match[1]);
        const tags = [];
        if (bandwidth >= 1000) tags.push(pill("高带宽", "memory"));
        else if (bandwidth >= 600) tags.push(pill("主流带宽", "memory"));
        cell.innerHTML = `
          <div class="bandwidth-cell">
            <span class="bandwidth-main">${text}</span>
            ${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}
          </div>
        `;
      }

      function highlightPower(cell) {
        const text = baseText(cell);
        const watts = Number((text.match(/(\d+)W/i) || [])[1]);
        if (!watts) return;
        const tags = [];
        if (watts <= 75) tags.push(pill("低功耗", "power"));
        else if (watts <= 150) tags.push(pill("易部署", "power"));
        else if (watts >= 300) tags.push(pill("高供电/散热", "warn"));
        cell.innerHTML = `
          <div class="power-cell">
            <span class="power-main">${text}</span>
            ${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}
          </div>
        `;
      }

      function highlightArchitecture(cell) {
        const text = baseText(cell);
        const map = [
          { re: /Blackwell/i, cn: "布莱克韦尔架构" },
          { re: /Ada Lovelace/i, cn: "艾达·洛夫莱斯架构" },
          { re: /Ampere/i, cn: "安培架构" }
        ];
        const hit = map.find((item) => item.re.test(text));
        if (!hit) return;
        cell.innerHTML = `<div class="term-cell"><div class="term-main">${text}</div><div class="term-cn">${hit.cn}</div></div>`;
      }

      function highlightCompute(cell) {
        const text = baseText(cell);
        if (!text) return;
        cell.innerHTML = `
          <div class="term-cell">
            <div class="term-main">${text}</div>
            <div class="term-cn">CUDA：通用计算核心 / Tensor：AI 矩阵核心 / RT：光追核心</div>
          </div>
        `;
      }

      function highlightEngine(cell) {
        const text = baseText(cell);
        const enc = Number((text.match(/(\d+)x\s*NVENC/i) || [])[1]);
        const dec = Number((text.match(/(\d+)x\s*NVDEC/i) || [])[1]);
        const tags = [];
        if (enc >= 4) tags.push(pill("编码并发强", "engine"));
        else if (enc >= 2) tags.push(pill("多路转码", "engine"));
        else tags.push(pill("单路/轻量", "warn"));
        if (dec >= 2) tags.push(pill("多路解码", "engine"));
        if (/JPEG/i.test(text)) tags.push(pill("JPEG 引擎", "engine"));
        cell.innerHTML = `
          <div class="engine-cell">
            <div class="engine-main">${text}</div>
            <div class="term-cn">NVENC：硬件编码 / NVDEC：硬件解码 / JPEG：图片编解码引擎</div>
            <div class="cell-highlights">${tags.join("")}</div>
          </div>
        `;
      }

      function highlightInterface(cell) {
        const html = baseHtml(cell);
        const text = baseText(cell);
        const notes = [];
        if (/PCIe/i.test(text)) notes.push("PCIe：主板扩展总线");
        if (/\bmDP\b/i.test(text)) notes.push("mDP：Mini DisplayPort 小口显示接口");
        else if (/\bDP\b/i.test(text)) notes.push("DP：DisplayPort 显示接口");
        if (!notes.length) return;
        cell.innerHTML = `<div class="term-cell"><div>${html}</div><div class="term-cn">${notes.join("；")}</div></div>`;
      }

      function highlightMemoryTerms(cell) {
        const existing = cell.querySelector(".cell-highlights");
        if (!existing) return;
        const text = baseText(cell);
        const notes = [];
        if (/GDDR7/i.test(text)) notes.push("GDDR7：新一代显存");
        else if (/GDDR6/i.test(text)) notes.push("GDDR6：专业卡常见显存");
        if (!notes.length) return;
        existing.insertAdjacentHTML("beforebegin", `<div class="term-cn">${notes.join("；")}</div>`);
      }

      function highlightModelTerms(cell) {
        if (!cell || cell.querySelector(".model-term-note")) return;
        const text = baseText(cell);
        const notes = [];
        if (/\bSFF\b/i.test(text)) notes.push("SFF：小机箱版");
        if (/Max-Q/i.test(text)) notes.push("Max-Q：低功耗版本");
        if (/Workstation/i.test(text)) notes.push("Workstation：工作站版");
        if (/Generation/i.test(text)) notes.push("Generation：这一代型号命名");
        if (!notes.length) return;
        cell.insertAdjacentHTML("beforeend", `<div class="term-cn model-term-note">${notes.join("；")}</div>`);
      }

      function highlightForm(cell) {
        if (!cell || cell.querySelector(".form-cell")) return;
        const text = baseText(cell);
        const tags = [];
        const notes = [];
        if (/\bH\s*x\b/i.test(text) || /\bL\b/i.test(text)) notes.push("H：高度 / L：长度");
        if (/XHFL/i.test(text)) notes.push("XHFL：超高全长");
        if (/\bSFF\b/i.test(text)) notes.push("SFF：小机箱版");
        if (/单槽/.test(text)) tags.push(pill("单槽", "form"));
        if (/半高|SFF/i.test(text)) tags.push(pill("小机箱", "form"));
        if (/双槽|双宽/.test(text)) tags.push(pill("注意槽位", "form"));
        if (!tags.length && !notes.length) return;
        cell.innerHTML = `
          <div class="form-cell">
            <span>${baseHtml(cell)}</span>
            ${notes.length ? `<div class="term-cn">${notes.join("；")}</div>` : ""}
            ${tags.length ? `<div class="cell-highlights">${tags.join("")}</div>` : ""}
          </div>
        `;
      }

      function addModelHighlights(row) {
        const modelCell = row.cells[2];
        if (!modelCell || modelCell.querySelector(".feature-strip")) return;
        const modelText = baseText(modelCell);
        const rowText = row.innerText.replace(/\s+/g, " ");
        const tags = [];
        const memoryText = textFromCell(row, 6);
        const memoryMatch = memoryText.match(/(\d+)\s*GB/i);
        if (memoryMatch) {
          const gb = Number(memoryMatch[1]);
          if (/RTX PRO 5000|RTX A2000/.test(modelText)) tags.push(pill("显存版本", "memory"));
          if (gb >= 48) tags.push(pill(`${gb}GB 大显存`, "memory"));
          else if (gb >= 24) tags.push(pill(`${gb}GB 显存`, "memory"));
        }
        const engineText = textFromCell(row, 9);
        const enc = Number((engineText.match(/(\d+)x\s*NVENC/i) || [])[1]);
        if (enc >= 2) tags.push(pill(`${enc}x NVENC`, "engine"));
        const hevcText = textFromCell(row, 10);
        if (/4:2:2/.test(hevcText) && !/不支持/.test(hevcText)) tags.push(pill("H.265 4:2:2 硬解", "codec"));
        if (/AV1 输出：支持/.test(rowText)) tags.push(pill("AV1 输出", "codec"));
        const powerText = textFromCell(row, 8);
        const watts = Number((powerText.match(/(\d+)W/i) || [])[1]);
        if (watts && watts <= 75) tags.push(pill(`${watts}W 低功耗`, "power"));
        const formText = textFromCell(row, 13);
        if (/单槽|半高|SFF/i.test(formText)) tags.push(pill("部署友好", "form"));

        if (tags.length) {
          modelCell.insertAdjacentHTML("beforeend", `<div class="feature-strip">${tags.slice(0, 5).join("")}</div>`);
        }
      }

      function applyHighlights(scope = table) {
        const rows = Array.from(scope.querySelectorAll("tbody tr"));
        rows.forEach((row) => {
          addModelHighlights(row);
          highlightModelTerms(row.cells[2]);
          highlightMemory(row.cells[6]);
          highlightMemoryTerms(row.cells[6]);
          highlightBandwidth(row.cells[7]);
          highlightPower(row.cells[8]);
          highlightArchitecture(row.cells[4]);
          highlightCompute(row.cells[5]);
          highlightEngine(row.cells[9]);
          highlightInterface(row.cells[12]);
          highlightForm(row.cells[13]);
        });
      }

      function updateState() {
        const rows = selectedRows();
        compareCount.textContent = `已选 ${rows.length} 款`;
        buildCompare.disabled = rows.length < 2;
        clearCompare.disabled = rows.length === 0;
        toggleSelectedOnly.disabled = rows.length === 0;
        checks.forEach((check) => {
          const row = check.closest("tr");
          const levelMatched = activeLevel === "all" || row.dataset.level === activeLevel;
          row.classList.toggle("is-selected", check.checked);
          row.classList.toggle("is-hidden-by-compare", selectedOnly && !check.checked);
          row.classList.toggle("is-hidden-by-level", !levelMatched);
        });
        if (selectedOnly && rows.length === 0) {
          selectedOnly = false;
          toggleSelectedOnly.textContent = "仅显示已选";
        }
        if (hevcShelf) renderHevcShelf();
      }

      function buildComparisonTable() {
        const rows = selectedRows();
        if (rows.length < 2) {
          comparePanel.classList.add("is-visible");
          compareOutput.innerHTML = '<div class="empty-compare">请至少勾选 2 款型号后再生成对比。</div>';
          return;
        }

        const header = rows.map((row) => `<th>${htmlFromCell(row, 2)}</th>`).join("");
        const body = columns.slice(1).map((column) => {
          const values = rows.map((row) => `<td>${htmlFromCell(row, column.index)}</td>`).join("");
          return `<tr><th>${column.label}</th>${values}</tr>`;
        }).join("");

        compareOutput.innerHTML = `
          <div class="table-wrap">
            <table>
              <thead><tr><th>项目</th>${header}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        `;
        comparePanel.classList.add("is-visible");
        comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      checks.forEach((check) => {
        check.addEventListener("change", updateState);
      });

      buildCompare.addEventListener("click", buildComparisonTable);

      clearCompare.addEventListener("click", () => {
        checks.forEach((check) => { check.checked = false; });
        selectedOnly = false;
        toggleSelectedOnly.textContent = "仅显示已选";
        comparePanel.classList.remove("is-visible");
        compareOutput.innerHTML = "";
        updateState();
      });

      toggleSelectedOnly.addEventListener("click", () => {
        selectedOnly = !selectedOnly;
        toggleSelectedOnly.textContent = selectedOnly ? "显示全部" : "仅显示已选";
        updateState();
      });

      levelButtons.forEach((button) => {
        button.addEventListener("click", () => {
          activeLevel = button.dataset.levelFilter;
          levelButtons.forEach((item) => {
            item.classList.toggle("is-active", item === button);
          });
          updateState();
        });
      });

      [
        hevcSearch,
        hevcSort,
        hevcLevel,
        hevcArch,
        hevcMinNvdec,
        hevcMinMemory,
        hevcMaxPower,
        hevcNeed422,
        hevcNeedAv1,
        hevcLowPower,
        hevcHideWeak
      ].forEach((control) => {
        control?.addEventListener("input", renderHevcShelf);
        control?.addEventListener("change", renderHevcShelf);
      });

      hevcReset?.addEventListener("click", () => {
        hevcSearch.value = "";
        hevcSort.value = "score";
        hevcLevel.value = "all";
        hevcArch.value = "all";
        hevcMinNvdec.value = "0";
        hevcMinMemory.value = "0";
        hevcMaxPower.value = "999";
        hevcNeed422.checked = false;
        hevcNeedAv1.checked = false;
        hevcLowPower.checked = false;
        hevcHideWeak.checked = false;
        renderHevcShelf();
      });

      hevcShelf?.addEventListener("click", (event) => {
        const button = event.target.closest(".hevc-compare-btn");
        if (!button) return;
        const row = table.querySelectorAll("tbody tr")[Number(button.dataset.rowIndex)];
        const check = row?.querySelector(".compare-check");
        if (!check) return;
        check.checked = !check.checked;
        updateState();
      });

      function setViewMode(mode) {
        document.body.classList.toggle("compact-view", mode === "compact");
        document.body.classList.toggle("full-view", mode === "full");
        fullViewBtn.classList.toggle("is-active", mode === "full");
        compactViewBtn.classList.toggle("is-active", mode === "compact");
      }

      fullViewBtn.addEventListener("click", () => setViewMode("full"));
      compactViewBtn.addEventListener("click", () => setViewMode("compact"));

      if (window.innerWidth < 1500) {
        setViewMode("compact");
      } else {
        setViewMode("full");
      }

      table.addEventListener("click", (event) => {
        const row = event.target.closest("tbody tr");
        if (!row || event.target.closest("a, button, input")) return;
        const check = row.querySelector(".compare-check");
        if (!check) return;
        check.checked = !check.checked;
        updateState();
      });

      applyHighlights();
      updateState();
      renderHevcShelf();
      loadExternalResults();
      window.setInterval(loadExternalResults, 60000);
    })();
