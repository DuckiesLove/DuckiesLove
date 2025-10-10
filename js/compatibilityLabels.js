/* ------------------------------------------------------------
   FILE:  /js/compatibilityLabels.js
   PURPOSE: Replace cb_* codes in the comparison table with real names
   (run on the compatibility page after table is rendered)
   ------------------------------------------------------------ */
(() => {
  // Use the merged label map populated by kink survey (if available),
  // otherwise lazily load the two files here.
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const fetchJSON = async u => (await fetch(u, {cache:"no-store"})).json();
    const kinks  = await fetchJSON("/data/kinks.json");
    const over   = await fetchJSON("/data/labels-overrides.json").catch(()=> ({}));
    const list   = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const map    = {...over};
    list.forEach(it => {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)]  = String(it.label);
    });
    return map;
  }

  async function swapCodesForNames() {
    const map = await ensureLabelMap();
    const cells = document.querySelectorAll("table td:first-child, table th:first-child");
    cells.forEach(td => {
      const raw = td.textContent.trim();
      // typical values: 'cb_xxx' or already a name
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", swapCodesForNames, {once:true});
  } else {
    swapCodesForNames();
  }
})();
