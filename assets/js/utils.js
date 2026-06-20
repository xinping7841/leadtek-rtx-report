export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlLines(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function pill(text, type = "") {
  return `<span class="feature-pill ${escapeHtml(type)}">${escapeHtml(text)}</span>`;
}

export function normalizeModelName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[™®]/g, "")
    .trim();
}

export async function loadJson(url, options = {}) {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404 && options.optional) return null;
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}
