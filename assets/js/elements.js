function requireElement(documentRef, id) {
  const element = documentRef.getElementById(id);
  if (!element) throw new Error(`页面缺少 #${id} 容器`);
  return element;
}

export function collectElements(documentRef = document) {
  const table = requireElement(documentRef, "gpuTable");
  const tableBody = table.querySelector("tbody");
  if (!tableBody) throw new Error("#gpuTable 缺少 tbody");

  return {
    table,
    tableBody,
    compareCount: requireElement(documentRef, "compareCount"),
    buildCompare: requireElement(documentRef, "buildCompare"),
    clearCompare: requireElement(documentRef, "clearCompare"),
    toggleSelectedOnly: requireElement(documentRef, "toggleSelectedOnly"),
    comparePanel: requireElement(documentRef, "comparePanel"),
    compareOutput: requireElement(documentRef, "compareOutput"),
    levelButtons: Array.from(documentRef.querySelectorAll(".level-btn")),
    fullViewBtn: requireElement(documentRef, "fullViewBtn"),
    compactViewBtn: requireElement(documentRef, "compactViewBtn"),
    hevcShelf: requireElement(documentRef, "hevcShelf"),
    hevcResultCount: requireElement(documentRef, "hevcResultCount"),
    hevcSearch: requireElement(documentRef, "hevcSearch"),
    hevcSort: requireElement(documentRef, "hevcSort"),
    hevcLevel: requireElement(documentRef, "hevcLevel"),
    hevcArch: requireElement(documentRef, "hevcArch"),
    hevcMinNvdec: requireElement(documentRef, "hevcMinNvdec"),
    hevcMinMemory: requireElement(documentRef, "hevcMinMemory"),
    hevcMaxPower: requireElement(documentRef, "hevcMaxPower"),
    hevcNeed422: requireElement(documentRef, "hevcNeed422"),
    hevcNeedAv1: requireElement(documentRef, "hevcNeedAv1"),
    hevcLowPower: requireElement(documentRef, "hevcLowPower"),
    hevcHideWeak: requireElement(documentRef, "hevcHideWeak"),
    hevcReset: requireElement(documentRef, "hevcReset"),
    hevcSortNote: requireElement(documentRef, "hevcSortNote"),
  };
}
