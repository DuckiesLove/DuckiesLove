(() => {
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
  };
  const LABELS = { ...FALLBACK_LABELS };
  let dictReady = false, scheduled = false, running = false, observer = null, labeledOnce = false;

  function harvestLabels(obj, out = {}) {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj.categories)) for (const c of obj.categories) {
      const id = c.id || c.key || c.code || c.slug;
      const title = c.title || c.name || c.label || c.summary || c.short || c.shortTitle;
      if (id && title) out[id] = title;
    }
    if (Array.isArray(obj.items)) for (const it of obj.items) {
      const id = it.id || it.code || it.key;
      const title = it.title || it.prompt || it.question || it.label || it.summary || it.name;
      if (id && title) out[id] = title;
    }
    if (obj.labels && typeof obj.labels === "object") Object.assign(out, obj.labels);
    if (obj.meta && obj.meta.labels && typeof obj.meta.labels === "object") Object.assign(out, obj.meta.labels);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") harvestLabels(v, out);
    }
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
      } catch (e) { console.info("[labels] fetch failed", url, e?.message || e); }
    }
    return dictReady;
  }

  function extractCodeFromCell(td) {
    if (!td) return null;
    if (td.dataset && td.dataset.code) return td.dataset.code.trim();
    const t = (td.textContent || "").trim();
    const m = t.match(/\bcb_[a-z0-9]+\b/i);
    return m ? m[0] : null;
  }
  const pretty = (id) => (id && LABELS[id]) || id;
  const getTable = () =>
    document.querySelector("#compatTable") ||
    document.querySelector(".compat-table") ||
    document.querySelector("main table") ||
    document.querySelector("table");

  function relabelNow() {
    if (running) return;
    running = true;
    const table = getTable();
    if (!table) { running = false; scheduled = false; return; }
    let changed = 0;
    table.querySelectorAll("tbody tr").forEach(tr => {
      if (tr.dataset.tkLabeled === "1") return;
      const first = tr.querySelector("td");
      const code = extractCodeFromCell(first);
      if (code) {
        const text = pretty(code);
        if (text && text !== first.textContent.trim()) { first.textContent = text; changed++; }
      }
      tr.dataset.tkLabeled = "1";
    });
    if (changed > 0) labeledOnce = true;
    setTimeout(() => {
      if (observer && labeledOnce) { observer.disconnect(); observer = null; }
      running = false; scheduled = false;
    }, 120);
  }
  function scheduleRelabel() { if (!scheduled) { scheduled = true; setTimeout(relabelNow, 80); } }

  function tapUploadInputs() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (input.dataset.tkTapped === "1") return;
      input.dataset.tkTapped = "1";
      input.addEventListener("change", ev => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result);
            Object.assign(LABELS, harvestLabels(json));
            console.info("[labels] merged from uploaded survey:", Object.keys(LABELS).length);
            scheduleRelabel();
          } catch {}
        };
        reader.readAsText(f);
      }, { passive: true });
    });
  }

  window.TK_labelStatus = () => ({ dictReady, known: Object.keys(LABELS).length });
  loadSharedDictionary().finally(scheduleRelabel);
  const mo = new MutationObserver(scheduleRelabel);
  mo.observe(document.body, { childList: true, subtree: true }); observer = mo;
  window.addEventListener("load", () => {
    tapUploadInputs();
    scheduleRelabel();
    setTimeout(scheduleRelabel, 400);
    setTimeout(scheduleRelabel, 1200);
  });
})();
