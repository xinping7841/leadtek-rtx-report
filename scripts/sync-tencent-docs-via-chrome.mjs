import fs from "node:fs";
import path from "node:path";

const DEFAULT_CHROME_DEBUG_URL = "http://127.0.0.1:9222";
const DEFAULT_OUTPUT = "data/gpu-test-results.json";

function loadDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;

    const name = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (name && process.env[name] === undefined) process.env[name] = value;
  }
}

function option(name, fallback = "") {
  const cliPrefix = `--${name}=`;
  const cliValue = process.argv.find((arg) => arg.startsWith(cliPrefix));
  if (cliValue) return cliValue.slice(cliPrefix.length);

  const envName = name.replace(/-/g, "_").toUpperCase();
  return process.env[envName] || fallback;
}

async function getTencentDocsPage(debugUrl) {
  const targets = await (await fetch(`${debugUrl.replace(/\/$/, "")}/json/list`)).json();
  const pages = targets.filter((target) => {
    return target.type === "page" && target.url && target.url.includes("doc.weixin.qq.com/sheet/");
  });

  if (!pages.length) {
    throw new Error(`No Tencent Docs sheet page found in ${debugUrl}/json/list`);
  }

  const preferredSubId = process.env.TENCENT_DOC_SUB_ID || "";
  if (preferredSubId) {
    const matched = pages.find((page) => page.url.includes(`tab=${preferredSubId}`));
    if (matched) return matched;
  }

  return pages[0];
}

async function cdpEvaluate(page, expression) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) => {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };

  try {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  } finally {
    ws.close();
  }
}

function normalizeCellText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeGpuModel(model) {
  const value = normalizeCellText(model);
  if (/^rtx\s*pro\s*4000$/i.test(value)) return "RTX PRO 4000 Blackwell";
  if (/^rtx\s*pro\s*5000$/i.test(value)) return "RTX PRO 5000 Blackwell";
  if (/^rtx\s*pro\s*6000$/i.test(value)) return "RTX PRO 6000 Blackwell Workstation Edition";
  return value;
}

function excelSerialDateToIso(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 30000 || number > 80000) return "";
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + number * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function findValueByLabel(matrix, label) {
  for (const row of matrix) {
    const index = row.findIndex((cell) => cell === label);
    if (index < 0) continue;
    for (let col = index + 1; col < row.length; col += 1) {
      if (row[col]) return row[col];
    }
  }
  return "";
}

function inferConclusion(text) {
  if (/持续掉帧|卡顿|性能瓶颈|超过/.test(text)) return "达到当前测试路数上限，继续增加负载会不稳定";
  if (/掉帧/.test(text)) return "可稳定播放，但切换或峰值阶段存在短时掉帧";
  if (/稳定|正常|通过/.test(text)) return "通过";
  return "已记录实测结果";
}

function buildRows(matrix) {
  const rawModel = findValueByLabel(matrix, "显卡") || findValueByLabel(matrix, "GPU");
  const model = normalizeGpuModel(rawModel);
  const tester = findValueByLabel(matrix, "测试人员") || findValueByLabel(matrix, "维护人");
  const rawDate = findValueByLabel(matrix, "测试日期") || findValueByLabel(matrix, "更新时间");
  const updatedAt = excelSerialDateToIso(rawDate) || rawDate;

  const headerRowIndex = matrix.findIndex((row) => {
    return row.some((cell) => cell.includes("编码格式")) &&
      row.some((cell) => cell.includes("素材")) &&
      row.some((cell) => cell.includes("测试结果"));
  });

  if (!model || headerRowIndex < 0) return [];

  const rows = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const encoding = row[0] || "";
    const material = row[1] || "";
    const result = row[2] || "";

    if (!encoding && !material && !result) continue;
    if (!result) continue;

    const testItem = [encoding, material].filter(Boolean).join(" / ");
    rows.push({
      "型号": model,
      "测试项": testItem || "企业文档测试",
      "测试结果": result,
      "结论": inferConclusion(result),
      "备注": `来源行：${rowIndex + 1}`,
      "维护人": tester,
      "更新时间": updatedAt,
    });
  }

  return rows;
}

function splitList(value) {
  return String(value || "")
    .split(/[，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function workbookExtractionExpression(preferredSubIds, maxRows, maxCols, syncAllSheets) {
  return `(async () => {
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    const deadline = Date.now() + 45000;
    let app = window.SpreadsheetApp;
    while ((!app || !app.workbook) && Date.now() < deadline) {
      await sleep(1000);
      app = window.SpreadsheetApp;
    }
    if (!app || !app.workbook) {
      const bodyText = document.body ? document.body.innerText.slice(0, 300) : "";
      if (/企业身份登录|个人身份登录|切换个人身份登录/.test(bodyText)) {
        throw new Error("Tencent Docs login required: Chromium is on the login screen");
      }
      throw new Error("SpreadsheetApp is not ready; title=" + document.title + "; body=" + bodyText);
    }

    const workbook = app.workbook;
    const worksheetManager = workbook.worksheetManager;
    const preferredSubIds = ${JSON.stringify(preferredSubIds)};
    const syncAllSheets = ${JSON.stringify(syncAllSheets)};

    function sheetIdOf(sheet) {
      if (!sheet) return "";
      try { if (typeof sheet.getSheetId === "function") return String(sheet.getSheetId()); } catch (error) {}
      return String(sheet.id || sheet.sheetId || sheet.subId || "");
    }

    function sheetNameOf(sheet) {
      if (!sheet) return "";
      try { if (typeof sheet.getSheetName === "function") return String(sheet.getSheetName()); } catch (error) {}
      return String(sheet.name || sheet.sheetName || "");
    }

    function resolveSheet(candidate) {
      if (!candidate) return null;
      if (
        typeof candidate.getRowCount === "function" &&
        typeof candidate.getColCount === "function" &&
        typeof candidate.getCellDataAtPosition === "function"
      ) {
        return candidate;
      }

      const id = sheetIdOf(candidate);
      if (!id || !worksheetManager || typeof worksheetManager.getSheetBySheetId !== "function") return null;
      try {
        const sheet = worksheetManager.getSheetBySheetId(id);
        return sheet || null;
      } catch (error) {
        return null;
      }
    }

    function addSheet(target, sheet) {
      sheet = resolveSheet(sheet);
      if (!sheet) return;
      const id = sheetIdOf(sheet);
      if (id && target.some((item) => sheetIdOf(item) === id)) return;
      if (target.includes(sheet)) return;
      target.push(sheet);
    }

    function arrayFromMaybe(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (value instanceof Map) return Array.from(value.values());
      if (typeof value === "object") return Object.values(value);
      return [];
    }

    function discoverSheets() {
      const sheets = [];
      const manager = worksheetManager || {};
      for (const name of ["getSheets", "getSheetList", "getAllSheets", "getWorksheets", "getWorksheetList"]) {
        try {
          if (typeof manager[name] === "function") arrayFromMaybe(manager[name]()).forEach((sheet) => addSheet(sheets, sheet));
        } catch (error) {}
      }
      for (const key of ["sheets", "sheetList", "worksheets", "worksheetList", "_sheets", "_sheetList", "sheetMap", "_sheetMap"]) {
        try { arrayFromMaybe(manager[key]).forEach((sheet) => addSheet(sheets, sheet)); } catch (error) {}
      }
      addSheet(sheets, workbook.activeSheet);
      return sheets;
    }

    const sheets = syncAllSheets ? discoverSheets() : [];
    const preferredSheets = preferredSubIds
      .map((subId) => {
        try {
          return worksheetManager && typeof worksheetManager.getSheetBySheetId === "function"
            ? worksheetManager.getSheetBySheetId(subId)
            : null;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
    if (!syncAllSheets && preferredSheets.length) preferredSheets.forEach((sheet) => addSheet(sheets, sheet));
    if (!syncAllSheets && !sheets.length) addSheet(sheets, workbook.activeSheet);
    if (syncAllSheets) preferredSheets.forEach((sheet) => addSheet(sheets, sheet));
    if (!sheets.length) throw new Error("No active sheet");

    function textOf(cell) {
      if (!cell) return "";
      for (const key of ["value", "formattedValue", "text"]) {
        const value = cell[key];
        if (typeof value === "string" || typeof value === "number") return String(value);
        if (value && typeof value === "object") {
          for (const nestedKey of ["value", "text", "plainText"]) {
            const nestedValue = value[nestedKey];
            if (typeof nestedValue === "string" || typeof nestedValue === "number") return String(nestedValue);
          }
        }
      }
      try {
        if (typeof cell.getValue === "function") {
          const value = cell.getValue();
          if (typeof value === "string" || typeof value === "number") return String(value);
        }
      } catch (error) {}
      try {
        if (typeof cell.getFormattedValue === "function") {
          const formatted = cell.getFormattedValue();
          if (typeof formatted === "string" || typeof formatted === "number") return String(formatted);
          if (formatted && typeof formatted === "object") {
            for (const nestedKey of ["value", "text", "plainText"]) {
              const nestedValue = formatted[nestedKey];
              if (typeof nestedValue === "string" || typeof nestedValue === "number") return String(nestedValue);
            }
          }
        }
      } catch (error) {}
      return "";
    }

    function extractSheet(sheet) {
      const rowCount = Math.min(sheet.getRowCount(), ${Number(maxRows)});
      const colCount = Math.min(sheet.getColCount(), ${Number(maxCols)});
      const matrix = [];
      for (let row = 0; row < rowCount; row += 1) {
        const values = [];
        for (let col = 0; col < colCount; col += 1) {
          values.push(textOf(sheet.getCellDataAtPosition(row, col)).trim());
        }
        matrix.push(values);
      }
      return {
        subId: sheetIdOf(sheet),
        sheetName: sheetNameOf(sheet),
        rowCount: sheet.getRowCount(),
        colCount: sheet.getColCount(),
        matrix,
      };
    }

    return {
      title: document.title,
      url: location.href,
      padId: location.pathname.split("/").pop(),
      sheets: sheets.map(extractSheet),
    };
  })()`;
}

async function main() {
  loadDotEnv();

  const debugUrl = option("chrome-debug-url", process.env.CHROME_DEBUG_URL || DEFAULT_CHROME_DEBUG_URL);
  const output = option("output", process.env.GPU_RESULTS_JSON || DEFAULT_OUTPUT);
  const preferredSubId = option("sub-id", process.env.TENCENT_DOC_SUB_ID || "");
  const preferredSubIds = splitList(option("sub-ids", process.env.TENCENT_DOC_SUB_IDS || preferredSubId));
  const maxRows = Number(option("max-rows", process.env.TENCENT_DOC_MAX_ROWS || "260"));
  const maxCols = Number(option("max-cols", process.env.TENCENT_DOC_MAX_COLS || "40"));
  const syncAllSheets = option("all-sheets", process.env.TENCENT_DOC_ALL_SHEETS || "1") !== "0";

  const page = await getTencentDocsPage(debugUrl);
  const workbook = await cdpEvaluate(page, workbookExtractionExpression(preferredSubIds, maxRows, maxCols, syncAllSheets));
  const extractedSheets = (workbook.sheets || []).map((sheet) => {
    const matrix = sheet.matrix.map((row) => row.map(normalizeCellText));
    const rows = buildRows(matrix);
    return { ...sheet, matrix, rows };
  });
  const rows = extractedSheets.flatMap((sheet) => {
    return sheet.rows.map((row) => ({
      ...row,
      "备注": [row["备注"], sheet.sheetName ? `Sheet：${sheet.sheetName}` : "", sheet.subId ? `Tab：${sheet.subId}` : ""]
        .filter(Boolean)
        .join("；"),
    }));
  });

  const payload = {
    source: {
      type: "tencent-docs-chrome",
      title: workbook.title,
      sheetName: extractedSheets.length === 1 ? extractedSheets[0].sheetName : "multiple sheets",
      padId: workbook.padId,
      subId: extractedSheets.length === 1 ? extractedSheets[0].subId : "multiple",
      url: workbook.url,
      rowCount: extractedSheets.reduce((sum, sheet) => sum + Number(sheet.rowCount || 0), 0),
      colCount: Math.max(0, ...extractedSheets.map((sheet) => Number(sheet.colCount || 0))),
      sheetCount: extractedSheets.length,
      sheets: extractedSheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        subId: sheet.subId,
        rowCount: sheet.rowCount,
        colCount: sheet.colCount,
        extractedRows: sheet.rows.length,
        models: [...new Set(sheet.rows.map((row) => row["型号"]))],
      })),
    },
    syncedAt: new Date().toISOString(),
    columns: ["型号", "测试项", "测试结果", "结论", "备注", "维护人", "更新时间"],
    rows,
  };

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    output,
    sheetCount: extractedSheets.length,
    sheets: extractedSheets.map((sheet) => ({
      sheetName: sheet.sheetName,
      subId: sheet.subId,
      rows: sheet.rows.length,
      models: [...new Set(sheet.rows.map((row) => row["型号"]))],
    })),
    rows: rows.length,
    models: [...new Set(rows.map((row) => row["型号"]))],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
