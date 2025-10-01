/* /js/tk-labels.js  — v2
   Relabel the first (Category) column from cb_* codes to human summaries.
   - Never “lock” a row before a successful relabel
   - Works with or without <tbody>
   - Merges labels from /data/kinks.json and any uploaded survey JSONs
*/
(() => {
  // ----- configuration -----
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];
  const FALLBACK_LABELS = {
    cb_zsnrb: "Dress partner’s outfit",
    cb_6jd2f: "Pick lingerie / base layers",
    cb_kgrnn: "Uniforms (school, military, nurse, etc.)",
    cb_169ma: "Time-period dress-up",
    cb_4yyxa: "Dollification / polished object aesthetics",
    cb_2c0f9: "Hair-based play (brushing, ribbons, tying)",
    cb_qwnhi: "Head coverings / symbolic hoods",
    cb_zvchg: "Coordinated looks / dress codes",
    cb_qw9jg: "Ritualized grooming",
    cb_3ozhq: "Praise for pleasing visual display",
    cb_hqakm: "Formal appearance protocols",
    cb_rn136: "Clothing as power-role signal"
    // …add the rest of your cb_* codes here or in /data/kinks.json
  };

  // ----- state -----
  const LABELS = { ...FALLBACK_LABELS };
  let dictReady = false;
  let scheduled = false;
  let observer = null;
  let relabelCount = 0;

  // ----- helpers -----
  function harvestLabels(obj, out = {}) {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj.categories)) for (const c of obj.categories) {
      const id = (c.id || c.key || c.code || c.slug || "").toLowerCase();
      const title = c.title || c.name || c.label || c.summary || c.short || c.shortTitle;
      if (id && title) out[id] = title;
    }
    if (Array.isArray(obj.items)) for (const it of obj.items) {
      const id = (it.id || it.code || it.key || "").toLowerCase();
      const title = it.title || it.prompt || it.question || it.label || it.summary || it.name;
      if (id && title) out[id] = title;
    }
    if (obj.labels && typeof obj.labels === "object") {
      for (const [k,v] of Object.entries(obj.labels)) out[k.toLowerCase()] = v;
    }
    if (obj.meta && obj.meta.labels && typeof obj.meta.labels === "object") {
      for (const [k,v] of Object.entries(obj.meta.labels)) out[k.toLowerCase()] = v;
    }
    for (const v of Object.values(obj)) if (v && typeof v === "object") harvestLabels(v, out);
    return out;
  }

  async function loadSharedDictionary() {
    if (dictReady) return true;
    for (const url of DICT_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) { console.info(`[labels] ${url} -> ${res.status}`); continue; }
        const data = await res.json();
        Object.assign(LABELS, harvestLabels(data));
        dictReady = true;
        console.info("[labels] loaded", Object.keys(LABELS).length, "labels from", url);
        break;
      } catch (e) {
        console.info("[labels] fetch failed", url, e?.message || e);
      }
    }
    return dictReady;
  }

  function getTable() {
    return (
      document.querySelector("#compatTable") ||
      document.querySelector(".compat-table") ||
      document.querySelector("main table") ||
      document.querySelector("table")
    );
  }

  function firstCellOfRow(tr) {
    return tr.querySelector("th:first-child, td:first-child");
  }

  function extractCode(td) {
    if (!td) return null;
    if (td.dataset && td.dataset.code) return td.dataset.code.trim().toLowerCase();
    const t = (td.textContent || "").trim();
    const m = t.match(/\bcb_[a-z0-9]+\b/i);
    return m ? m[0].toLowerCase() : null;
  }

  function relabelNow() {
    const table = getTable();
    if (!table) { scheduled = false; return; }

    let changedThisPass = 0;

    // Work with or without <tbody>
    const rows = table.querySelectorAll("tbody tr, tr");
    rows.forEach(tr => {
      // Skip header rows that start with TH but still allow TH in first cell selector
      const cell = firstCellOfRow(tr);
      if (!cell) return;

      const code = extractCode(cell);
      if (!code) return;

      const label = LABELS[code];
      if (label && cell.textContent.trim() !== label) {
        cell.textContent = label;
        cell.dataset.tkLabeled = "1";          // mark only AFTER a successful relabel
        relabelCount++;
        changedThisPass++;
      }
    });

    // If nothing changed, keep observer alive to catch late DOM builds or a later dict load.
    scheduled = false;
    if (changedThisPass > 0) {
      // Give the page time to add more rows, then try one more sweep.
      setTimeout(scheduleRelabel, 200);
    }
  }

  function scheduleRelabel() {
    if (!scheduled) {
      scheduled = true;
      setTimeout(relabelNow, 50);
    }
  }

  function tapUploadInputs() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.dataset.tkTapped === "1") return;
      input.dataset.tkTapped = "1";
      input.addEventListener(
        "change",
        ev => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const json = JSON.parse(reader.result);
              Object.assign(LABELS, harvestLabels(json));
              console.info("[labels] merged from uploaded survey:", Object.keys(LABELS).length);
              scheduleRelabel();
            } catch { /* ignore */ }
          };
          reader.readAsText(f);
        },
        { passive: true }
      );
    });
  }

  // Public probe for debugging
  window.TK_labels = {
    status() {
      return {
        dictReady,
        known: Object.keys(LABELS).length,
        relabelsApplied: relabelCount
      };
    },
    relabel: scheduleRelabel
  };

  // Boot
  loadSharedDictionary().finally(scheduleRelabel);

  observer = new MutationObserver(() => {
    tapUploadInputs();
    scheduleRelabel();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("load", () => {
    tapUploadInputs();
    scheduleRelabel();
    setTimeout(scheduleRelabel, 400);
    setTimeout(scheduleRelabel, 1200);
  });
})();
