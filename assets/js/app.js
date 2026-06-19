(() => {
  const state = {
    cards: [],
    filtered: [],
    prices: {},
    externalResults: new Map(),
    selected: new Set(),
    selectedOnly: false,
    tableHidden: false,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    schemaVersion: $("schemaVersion"),
    catalogUpdatedAt: $("catalogUpdatedAt"),
    cardTotal: $("cardTotal"),
    policyChips: $("policyChips"),
    summaryGrid: $("summaryGrid"),
    syncPanel: $("syncPanel"),
    syncStatusText: $("syncStatusText"),
    syncStatusMeta: $("syncStatusMeta"),
    resultCount: $("resultCount"),
    searchInput: $("searchInput"),
    brandFilter: $("brandFilter"),
    archFilter: $("archFilter"),
    levelFilter: $("levelFilter"),
    memoryFilter: $("memoryFilter"),
    powerFilter: $("powerFilter"),
    sortSelect: $("sortSelect"),
    need422: $("need422"),
    needAv1: $("needAv1"),
    hideLegacy: $("hideLegacy"),
    resetFilters: $("resetFilters"),
    cardGrid: $("cardGrid"),
    tableBody: $("tableBody"),
    compareCount: $("compareCount"),
    buildCompare: $("buildCompare"),
    selectedOnly: $("selectedOnly"),
    clearCompare: $("clearCompare"),
    comparePanel: $("comparePanel"),
    compareOutput: $("compareOutput"),
    toggleTable: $("toggleTable"),
    tableWrap: $("tableWrap"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function lines(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function numberFromPrice(text) {
    const raw = String(text || "");
    if (!raw || /待补充|询价|公开价少/.test(raw)) return Number.POSITIVE_INFINITY;
    const normalized = raw.replace(/,/g, "");
    const matches = [...normalized.matchAll(/([0-9]+(?:\.[0-9]+)?)(\s*万)?/g)];
    if (!matches.length) return Number.POSITIVE_INFINITY;
    const values = matches.map((match) => Number(match[1]) * (match[2] ? 10000 : 1));
    return Math.min(...values);
  }

  function lifecycleRank(card) {
    const map = { current: 5, active: 4, mature: 3, legacy: 1 };
    return map[card.lifecycle] || 2;
  }

  function supports422(card) {
    const text = `${card.h265?.title || ""} ${card.h265?.detail || ""}`;
    return /4:2:2/.test(text) && !/不支持/.test(text);
  }

  function supportsAv1Encode(card) {
    const text = `${card.av1?.title || ""} ${card.av1?.detail || ""}`;
    return /AV1 输出：支持|AV1 Encode|编码/.test(text) && !/不支持/.test(text);
  }

  function isLegacy(card) {
    return card.lifecycle === "legacy" || /存量|上一代|历史|不建议/.test(card.recommendationType + card.recommendation);
  }

  function scoreCard(card) {
    const engine = card.engine || {};
    const brandBonus = card.brand === "NVIDIA" ? 4 : 0;
    const av1 = supportsAv1Encode(card) ? 12 : 0;
    const hevc422 = supports422(card) ? 16 : 0;
    const memory = Math.min(card.memoryGb || 0, 96) * 0.35;
    const bandwidth = Math.min(card.bandwidthGBs || 0, 1800) / 130;
    const video = (engine.encode || 0) * 8 + (engine.decode || 0) * 9 + (engine.jpeg || 0) * 1.5;
    const powerPenalty = card.powerW >= 300 ? 4 : card.powerW <= 75 && card.powerW > 0 ? -4 : 0;
    const legacyPenalty = isLegacy(card) ? 12 : 0;
    return Math.round(lifecycleRank(card) * 7 + brandBonus + av1 + hevc422 + memory + bandwidth + video - powerPenalty - legacyPenalty);
  }

  function priceFor(card) {
    const override = state.prices[card.id] || {};
    return { ...(card.price || {}), ...override };
  }

  function hydrateCards(cards) {
    state.cards = cards.map((card) => ({
      ...card,
      score: scoreCard(card),
      searchText: [
        card.brand,
        card.model,
        card.architecture,
        card.generation,
        card.tier,
        card.memory,
        card.videoEngine,
        card.h265?.raw,
        card.av1?.raw,
        card.recommendation,
      ].join(" ").toLowerCase(),
    }));
  }

  function setOptions(select, values, labeler = (value) => value) {
    const current = select.value;
    select.querySelectorAll("option:not([value='all'])").forEach((option) => option.remove());
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labeler(value);
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }

  function populateFilters() {
    setOptions(els.brandFilter, unique(state.cards.map((card) => card.brand)).sort());
    setOptions(els.archFilter, unique(state.cards.map((card) => card.architecture)).sort());
    const levels = unique(state.cards.map((card) => card.level));
    setOptions(els.levelFilter, levels, (level) => {
      const card = state.cards.find((item) => item.level === level);
      return card?.tier || level;
    });
  }

  function renderPolicy(catalog) {
    els.schemaVersion.textContent = catalog.schemaVersion || "-";
    els.catalogUpdatedAt.textContent = catalog.updatedAt || "-";
    els.cardTotal.textContent = state.cards.length;
    els.policyChips.innerHTML = [
      "规格来源：厂商公开资料",
      "价格：后台计算参考区间",
      "美国市场价：结构已预留",
      "企业实测：自动合并到型号",
    ].map((text) => `<span class="chip">${escapeHtml(text)}</span>`).join("");
  }

  function renderSummary() {
    const total = state.cards.length;
    const nvidia = state.cards.filter((card) => card.brand === "NVIDIA").length;
    const amd = state.cards.filter((card) => card.brand === "AMD").length;
    const av1 = state.cards.filter(supportsAv1Encode).length;
    const legacy = state.cards.filter(isLegacy).length;
    const items = [
      [total, "总型号数量"],
      [nvidia, "NVIDIA 专业卡"],
      [amd, "AMD Radeon PRO"],
      [av1, "支持 AV1 编码"],
      [legacy, "存量/上一代参考"],
    ];
    els.summaryGrid.innerHTML = items.map(([value, label]) => `
      <article class="summary-card"><strong>${value}</strong><span>${escapeHtml(label)}</span></article>
    `).join("");
  }

  function stateFromControls() {
    return {
      query: els.searchInput.value.trim().toLowerCase(),
      brand: els.brandFilter.value,
      arch: els.archFilter.value,
      level: els.levelFilter.value,
      memory: Number(els.memoryFilter.value),
      power: Number(els.powerFilter.value),
      sort: els.sortSelect.value,
      need422: els.need422.checked,
      needAv1: els.needAv1.checked,
      hideLegacy: els.hideLegacy.checked,
    };
  }

  function filterCards() {
    const filter = stateFromControls();
    const items = state.cards.filter((card) => {
      if (state.selectedOnly && !state.selected.has(card.id)) return false;
      if (filter.query && !card.searchText.includes(filter.query)) return false;
      if (filter.brand !== "all" && card.brand !== filter.brand) return false;
      if (filter.arch !== "all" && card.architecture !== filter.arch) return false;
      if (filter.level !== "all" && card.level !== filter.level) return false;
      if ((card.memoryGb || 0) < filter.memory) return false;
      if (card.powerW && card.powerW > filter.power) return false;
      if (filter.need422 && !supports422(card)) return false;
      if (filter.needAv1 && !supportsAv1Encode(card)) return false;
      if (filter.hideLegacy && isLegacy(card)) return false;
      return true;
    });

    const sorters = {
      score: (a, b) => b.score - a.score || b.memoryGb - a.memoryGb,
      price: (a, b) => numberFromPrice(priceFor(a).reference) - numberFromPrice(priceFor(b).reference) || b.score - a.score,
      memory: (a, b) => b.memoryGb - a.memoryGb || b.score - a.score,
      power: (a, b) => (a.powerW || 999) - (b.powerW || 999) || b.score - a.score,
      newest: (a, b) => lifecycleRank(b) - lifecycleRank(a) || b.score - a.score,
    };
    items.sort(sorters[filter.sort] || sorters.score);
    state.filtered = items;
  }

  function brandClass(card) {
    if (card.brand === "AMD") return "warn";
    if (isLegacy(card)) return "legacy";
    return "good";
  }

  function mediaHtml(card) {
    if (card.image) {
      return `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.imageAlt || card.model)}" loading="lazy">`;
    }
    return `<div class="product-placeholder">${escapeHtml(card.brand)}</div>`;
  }

  function testSummary(card) {
    const rows = state.externalResults.get(card.model) || [];
    if (!rows.length) return "";
    const sample = rows.slice(0, 2).map((row) => row["结论"] || row["测试结果"] || row["测试项"]).filter(Boolean).join("；");
    return `<div class="external-test">企业实测：${rows.length} 条${sample ? `；${escapeHtml(sample)}` : ""}</div>`;
  }

  function priceHtml(card) {
    const price = priceFor(card);
    return `
      <div class="price-box">
        <div><span>国内</span><strong>${escapeHtml(price.domestic || "待补充")}</strong></div>
        <div><span>美国</span><strong>${escapeHtml(price.us || "待补充")}</strong></div>
        <div><span>综合</span><strong>${escapeHtml(price.reference || "待补充")}</strong></div>
        <small>${escapeHtml(price.status || "待补充价格样本")}</small>
      </div>
    `;
  }

  function cardHtml(card, maxScore) {
    const checked = state.selected.has(card.id);
    const scoreWidth = Math.max(8, Math.min(100, Math.round(card.score / maxScore * 100)));
    return `
      <article class="gpu-card ${checked ? "is-selected" : ""}" data-id="${escapeHtml(card.id)}">
        <div class="card-top">
          <div class="product-media">${mediaHtml(card)}</div>
          <div>
            <div class="card-title">
              <h3>${escapeHtml(card.model)}</h3>
              <label class="compare-toggle"><input class="compare-check" type="checkbox" data-id="${escapeHtml(card.id)}" ${checked ? "checked" : ""}> 对比</label>
            </div>
            <div class="card-meta">${escapeHtml(card.brand)} · ${escapeHtml(card.architecture)} · ${escapeHtml(card.release)}</div>
            <div class="card-tags">
              <span class="status-tag ${brandClass(card)}">${escapeHtml(card.recommendationType)}</span>
              <span class="tag">${escapeHtml(card.tier)}</span>
              ${supportsAv1Encode(card) ? '<span class="tag">AV1 编码</span>' : ""}
              ${supports422(card) ? '<span class="tag">HEVC 4:2:2</span>' : ""}
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class="score-row"><span><b>综合能力</b><strong>${card.score}</strong></span><div class="score-bar"><i style="width:${scoreWidth}%"></i></div></div>
          <div class="spec-grid">
            <div class="spec"><span>显存</span><strong>${escapeHtml(card.memory)}</strong></div>
            <div class="spec"><span>功耗</span><strong>${escapeHtml(card.power || "待确认")}</strong></div>
            <div class="spec"><span>带宽</span><strong>${escapeHtml(card.busBandwidth || "待确认")}</strong></div>
            <div class="spec"><span>视频引擎</span><strong>${escapeHtml(card.videoEngine || "按厂商资料确认")}</strong></div>
          </div>
          <div class="codec-box"><strong>${escapeHtml(card.h265?.title || "H.265/HEVC 能力待确认")}</strong><p>${escapeHtml(card.h265?.detail || "")}</p></div>
          <div class="codec-box"><strong>${escapeHtml(card.av1?.title || "AV1 能力待确认")}</strong><p>${escapeHtml(card.av1?.detail || "")}</p></div>
          ${priceHtml(card)}
          <p class="card-advice">${escapeHtml(card.recommendation)}</p>
          ${testSummary(card)}
          <div class="card-actions">
            <a href="${escapeHtml(card.officialUrl || "#")}" target="_blank" rel="noreferrer">产品资料</a>
            <button type="button" class="quick-compare" data-id="${escapeHtml(card.id)}">${checked ? "取消对比" : "加入对比"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCards() {
    els.resultCount.textContent = state.filtered.length;
    if (!state.filtered.length) {
      els.cardGrid.innerHTML = '<div class="empty-state">没有符合当前条件的型号。可以放宽品牌、架构、显存、功耗或视频能力筛选。</div>';
      return;
    }
    const maxScore = Math.max(...state.cards.map((card) => card.score), 1);
    els.cardGrid.innerHTML = state.filtered.map((card) => cardHtml(card, maxScore)).join("");
  }

  function tableRow(card) {
    const checked = state.selected.has(card.id);
    return `
      <tr data-id="${escapeHtml(card.id)}">
        <td><input class="compare-check" type="checkbox" data-id="${escapeHtml(card.id)}" ${checked ? "checked" : ""}></td>
        <td class="model-cell"><strong>${escapeHtml(card.model)}</strong><span class="subtle">${escapeHtml(card.tier)} · ${escapeHtml(card.release)}</span></td>
        <td>${escapeHtml(card.brand)}<br><span class="subtle">${escapeHtml(card.architecture)}</span></td>
        <td>${escapeHtml(card.memory)}<br><span class="subtle">${escapeHtml(card.busBandwidth)}</span></td>
        <td>${escapeHtml(card.power || "待确认")}</td>
        <td>${escapeHtml(card.videoEngine || "按厂商资料确认")}</td>
        <td>${escapeHtml(card.h265?.title || "待确认")}<br><span class="subtle">${escapeHtml(card.h265?.note || "")}</span></td>
        <td>${escapeHtml(card.av1?.title || "待确认")}</td>
        <td>${priceHtml(card)}</td>
        <td>${escapeHtml(card.recommendation)}</td>
      </tr>
    `;
  }

  function renderTable() {
    els.tableBody.innerHTML = state.filtered.map(tableRow).join("");
  }

  function renderSelectionState() {
    const count = state.selected.size;
    els.compareCount.textContent = `已选 ${count} 款`;
    els.buildCompare.disabled = count < 2;
    els.selectedOnly.disabled = count === 0;
    els.clearCompare.disabled = count === 0;
    els.selectedOnly.textContent = state.selectedOnly ? "显示全部" : "仅显示已选";
  }

  function renderAll() {
    filterCards();
    renderCards();
    renderTable();
    renderSelectionState();
  }

  function toggleSelected(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    renderAll();
  }

  function buildCompare() {
    const cards = state.cards.filter((card) => state.selected.has(card.id));
    if (cards.length < 2) {
      els.compareOutput.className = "empty-state";
      els.compareOutput.textContent = "请至少选择 2 款型号。";
      els.comparePanel.classList.add("is-visible");
      return;
    }
    const rows = [
      ["品牌/架构", (card) => `${card.brand} / ${card.architecture}`],
      ["显存", (card) => card.memory],
      ["功耗", (card) => card.power],
      ["带宽", (card) => card.busBandwidth],
      ["视频引擎", (card) => card.videoEngine || "按厂商资料确认"],
      ["H.265/HEVC", (card) => card.h265?.title || "待确认"],
      ["AV1", (card) => card.av1?.title || "待确认"],
      ["综合参考价", (card) => priceFor(card).reference || "待补充"],
      ["建议", (card) => card.recommendation],
    ];
    els.compareOutput.className = "table-wrap";
    els.compareOutput.innerHTML = `
      <table class="compare-table">
        <thead><tr><th>维度</th>${cards.map((card) => `<th>${escapeHtml(card.model)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(([label, getter]) => `<tr><th>${escapeHtml(label)}</th>${cards.map((card) => `<td>${lines(getter(card))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    `;
    els.comparePanel.classList.add("is-visible");
    els.comparePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetFilters() {
    els.searchInput.value = "";
    els.brandFilter.value = "all";
    els.archFilter.value = "all";
    els.levelFilter.value = "all";
    els.memoryFilter.value = "0";
    els.powerFilter.value = "999";
    els.sortSelect.value = "score";
    els.need422.checked = false;
    els.needAv1.checked = false;
    els.hideLegacy.checked = false;
    state.selectedOnly = false;
    renderAll();
  }

  function attachEvents() {
    [els.searchInput, els.brandFilter, els.archFilter, els.levelFilter, els.memoryFilter, els.powerFilter, els.sortSelect, els.need422, els.needAv1, els.hideLegacy]
      .forEach((el) => el.addEventListener("input", renderAll));
    els.resetFilters.addEventListener("click", resetFilters);
    els.buildCompare.addEventListener("click", buildCompare);
    els.clearCompare.addEventListener("click", () => {
      state.selected.clear();
      state.selectedOnly = false;
      els.comparePanel.classList.remove("is-visible");
      renderAll();
    });
    els.selectedOnly.addEventListener("click", () => {
      state.selectedOnly = !state.selectedOnly;
      renderAll();
    });
    els.toggleTable.addEventListener("click", () => {
      state.tableHidden = !state.tableHidden;
      els.tableWrap.classList.toggle("hidden", state.tableHidden);
      els.toggleTable.textContent = state.tableHidden ? "显示表格" : "隐藏表格";
    });
    document.addEventListener("change", (event) => {
      const input = event.target.closest(".compare-check");
      if (!input) return;
      const id = input.dataset.id;
      if (!id) return;
      if (input.checked) state.selected.add(id);
      else state.selected.delete(id);
      renderAll();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".quick-compare");
      if (!button) return;
      toggleSelected(button.dataset.id);
    });
  }

  async function loadJson(url, fallback = null) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      return fallback;
    }
  }

  function ingestExternalResults(payload) {
    const rows = payload?.rows || [];
    state.externalResults = rows.reduce((map, row) => {
      const model = row["型号"] || row.model || "";
      if (!model) return map;
      if (!map.has(model)) map.set(model, []);
      map.get(model).push(row);
      return map;
    }, new Map());
    if (rows.length) {
      els.syncPanel.classList.add("is-ok");
      els.syncPanel.classList.remove("is-warn");
      els.syncStatusText.textContent = "企业实测数据已合并";
      els.syncStatusMeta.textContent = `已读取 ${rows.length} 条测试记录，覆盖 ${state.externalResults.size} 个型号。`;
    } else {
      els.syncPanel.classList.add("is-warn");
      els.syncStatusText.textContent = "企业实测数据未连接";
      els.syncStatusMeta.textContent = "未读取到 data/gpu-test-results.json，当前仅显示规格与价格结构。";
    }
  }

  async function init() {
    const [catalog, pricePayload, external] = await Promise.all([
      loadJson("data/gpu-catalog.json"),
      loadJson("data/market-prices.json", { items: {} }),
      loadJson("data/gpu-test-results.json", { rows: [] }),
    ]);
    if (!catalog?.cards?.length) {
      els.cardGrid.innerHTML = '<div class="empty-state">未能加载 data/gpu-catalog.json。</div>';
      return;
    }
    state.prices = pricePayload?.items || {};
    hydrateCards(catalog.cards);
    ingestExternalResults(external);
    renderPolicy(catalog);
    renderSummary();
    populateFilters();
    attachEvents();
    renderAll();
  }

  init();
})();
