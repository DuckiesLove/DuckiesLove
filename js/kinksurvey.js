/* ------------------------------------------------------------
   FILE:  /js/kinksurvey.js
   PURPOSE: Category panel auto-inject + robust loader (no /data/categories.json).
            - Builds label map from kinks.json (+ optional overrides)
            - Creates/wires category panel if missing
            - Start Survey opens the panel; Proceed begins survey
            - Keeps compatibility table code->name & full-bleed PDF export
   ------------------------------------------------------------ */
(() => {
  const log = (...a) => console.log("[TK]", ...a);
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fetchJSON = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  const Data = {
    kinks: null,
    labelOverrides: {},
    labelMap: {},
    categories: [],
  };

  /* ---------- categories & labels ---------- */
  function deriveCategoriesFromKinks(kinks) {
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const set = new Set();
    for (const it of list) {
      if (it?.category) set.add(String(it.category).trim());
      if (Array.isArray(it?.categories)) it.categories.forEach(c => c && set.add(String(c).trim()));
      if (it?.group) set.add(String(it.group).trim());
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function buildLabelMap(kinks, overrides) {
    const map = { ...(overrides || {}) };
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    for (const it of list) {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)] = String(it.label);
    }
    return map;
  }

  /* ---------- panel creation (only if missing) ---------- */
  function ensureCategoryPanel() {
    let panel = document.getElementById("categorySurveyPanel");
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.id = "categorySurveyPanel";
    panel.className = "category-panel tk-wide-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Category selection");
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("data-ksv-panel", "category");

    panel.innerHTML = `
      <div class="category-panel__header">
        <div class="menu-btn themed-button" id="panelCloseBtn" aria-label="Close" title="Close">Close ✕</div>
      </div>

      <div class="category-panel__body">
        <h3 class="themed-heading">Select categories</h3>

        <div class="tk-btn-row">
          <button id="btnSelectAll" class="themed-button">Select All</button>
          <button id="btnDeselectAll" class="themed-button">Deselect All</button>
          <span class="badge" id="catCount" data-tk="cat-count">0 selected</span>
        </div>

        <div id="categoryList" data-tk="category-list" class="tk-chip-wrap" style="margin-top:1rem"></div>
      </div>

      <div class="category-panel__footer">
        <button id="btnProceed" class="themed-button start-survey-btn">Proceed</button>
      </div>
    `;
    document.body.appendChild(panel);

    function openPanel() {
      panel.setAttribute("aria-hidden", "false");
    }
    function closePanel() {
      panel.setAttribute("aria-hidden", "true");
    }
    panel.__tkOpen = openPanel;
    panel.__tkClose = closePanel;

    $("#panelCloseBtn", panel)?.addEventListener("click", closePanel);
    return panel;
  }

  function openCategoryPanel() {
    const panel = ensureCategoryPanel();
    const open = panel?.__tkOpen;
    if (typeof open === "function") open();
  }

  function closeCategoryPanel() {
    const panel = document.getElementById("categorySurveyPanel");
    const close = panel?.__tkClose;
    if (typeof close === "function") close();
  }

  /* ---------- render inside the panel ---------- */
  function renderCategoryChooser(categories) {
    const listEl = document.getElementById("categoryList") || document.querySelector("[data-tk='category-list']");
    if (!listEl) return;

    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    categories.forEach((cat) => {
      const lab = document.createElement("label");
      lab.className = "tk-chip";
      lab.innerHTML = `
        <input type="checkbox" class="tk-cat" value="${cat}">
        <span class="txt">${cat}</span>
      `;
      frag.appendChild(lab);
    });
    listEl.appendChild(frag);

    const badge = document.getElementById("catCount") || document.querySelector("[data-tk='cat-count']");
    const update = () => {
      if (badge) badge.textContent = `${$$(".tk-cat:checked", listEl).length} selected / ${categories.length} total`;
    };
    listEl.addEventListener("change", update);
    update();

    const btnAll = document.getElementById("btnSelectAll");
    const btnNone = document.getElementById("btnDeselectAll");
    btnAll?.addEventListener("click", () => {
      $$(".tk-cat", listEl).forEach((c) => {
        c.checked = true;
      });
      listEl.dispatchEvent(new Event("change"));
    });
    btnNone?.addEventListener("click", () => {
      $$(".tk-cat", listEl).forEach((c) => {
        c.checked = false;
      });
      listEl.dispatchEvent(new Event("change"));
    });

    const btnProceed = document.getElementById("btnProceed");
    if (btnProceed && !btnProceed.__tkBound) {
      btnProceed.addEventListener("click", () => {
        const sel = $$(".tk-cat:checked", listEl).map((c) => c.value);
        const chosen = sel.length ? sel : Data.categories;
        if (!chosen.length) {
          alert("No categories available.");
          return;
        }
        try {
          closeCategoryPanel();
          if (window.tkBeginSurvey) {
            window.tkBeginSurvey({ categories: chosen, kinks: Data.kinks, labels: Data.labelMap });
          } else {
            alert(`Survey would start with ${chosen.length} categories.`);
          }
        } catch (err) {
          console.error("[TK] proceed failed:", err);
          alert("Sorry, something prevented the survey from starting. See console.");
        }
      });
      btnProceed.__tkBound = true;
    }
  }

  function wireStartButton() {
    const btn = document.getElementById("startSurvey") || document.querySelector("[data-tk='start']");
    if (!btn || btn.__tkBound) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openCategoryPanel();
    });
    btn.__tkBound = true;
  }

  /* ---------- boot ---------- */
  async function loadAll() {
    Data.kinks = await fetchJSON("/data/kinks.json");
    try {
      Data.labelOverrides = await fetchJSON("/data/labels-overrides.json");
    } catch {
      Data.labelOverrides = {};
    }

    Data.labelMap = buildLabelMap(Data.kinks, Data.labelOverrides);
    Data.categories = Array.isArray(window.__TK_CATEGORIES__) && window.__TK_CATEGORIES__.length
      ? window.__TK_CATEGORIES__.slice().sort((a, b) => a.localeCompare(b))
      : deriveCategoriesFromKinks(Data.kinks);

    const panel = ensureCategoryPanel();
    renderCategoryChooser(Data.categories);
    wireStartButton();

    window.__TK__ = Data;
    panel.setAttribute("data-tk-ready", "true");

    log(`Loaded ${Data.categories.length} categories; UI wired.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll, { once: true });
  } else {
    loadAll();
  }
})();

/* ==================== Compatibility: swap codes->names ==================== */
(() => {
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f = async (u) => (await fetch(u, { cache: "no-store" })).json();
    const k = await f("/data/kinks.json");
    const o = await f("/data/labels-overrides.json").catch(() => ({}));
    const map = { ...o };
    (Array.isArray(k) ? k : (k?.items || [])).forEach((it) => {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)] = String(it.label);
    });
    return map;
  }
  async function swapCodes() {
    const map = await ensureLabelMap();
    document.querySelectorAll("table td:first-child, table th:first-child").forEach((td) => {
      const raw = td.textContent.trim();
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", swapCodes, { once: true });
  else swapCodes();
})();

/* ==================== Full-bleed black PDF export ==================== */
(() => {
  const loadScript = (src) => new Promise((ok, err) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = err;
    document.head.appendChild(s);
  });
  async function ensurePDFLibs() {
    if (!window.jspdf) await loadScript("/js/vendor/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("/js/vendor/html2canvas.min.js");
  }
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f = async (u) => (await fetch(u, { cache: "no-store" })).json();
    const k = await f("/data/kinks.json");
    const o = await f("/data/labels-overrides.json").catch(() => ({}));
    const map = { ...o };
    (Array.isArray(k) ? k : (k?.items || [])).forEach((it) => {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)] = String(it.label);
    });
    return map;
  }
  async function makeFullBleedPDF() {
    await ensurePDFLibs();
    const map = await ensureLabelMap();
    const table = document.querySelector("table");
    if (!table) return alert("No table to export.");
    const clone = table.cloneNode(true);
    clone.querySelectorAll("td:first-child, th:first-child").forEach((td) => {
      const raw = td.textContent.trim();
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
    const wrap = document.createElement("div");
    wrap.style.background = "#000";
    wrap.style.padding = "0";
    wrap.style.margin = "0";
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    const canvas = await html2canvas(wrap, { backgroundColor: "#000", scale: 2 });
    document.body.removeChild(wrap);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h, undefined, "FAST");
    pdf.save("compatibility.pdf");
  }
  const btn = document.getElementById("dl") || document.querySelector("[data-tk='download']");
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    makeFullBleedPDF();
  });
  window.tkMakeCompatibilityPDF = makeFullBleedPDF;
})();
