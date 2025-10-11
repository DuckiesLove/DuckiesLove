/* /js/kinksurvey.js
   Reliable Start Survey → Category Panel + label map + full-bleed PDF.
*/
(() => {
  const log = (...a) => console.log("[TK]", ...a);
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const fetchJSON = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  const Data = { kinks:null, labelOverrides:{}, labelMap:{}, categories:[] };

  /* ===================== CATEGORIES & LABELS ===================== */
  function deriveCategoriesFromKinks(kinks) {
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const set = new Set();
    for (const it of list) {
      if (it?.category) set.add(String(it.category).trim());
      if (Array.isArray(it?.categories)) it.categories.forEach(c => c && set.add(String(c).trim()));
      if (it?.group) set.add(String(it.group).trim());
    }
    return Array.from(set).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }

  function buildLabelMap(kinks, overrides) {
    const map = { ...(overrides || {}) };
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    for (const it of list) {
      if (it?.id && it?.name)   map[String(it.id)]   = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label)  map[String(it.cb)]   = String(it.label);
    }
    return map;
  }

  /* ===================== PANEL CREATION/CONTROL ===================== */
  function ensureCategoryPanel() {
    let panel = document.getElementById("categorySurveyPanel");
    if (panel) return panel;

    panel = document.createElement("aside");
    panel.id = "categorySurveyPanel";
    panel.className = "category-panel tk-wide-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Category selection");
    panel.setAttribute("aria-hidden", "true");
    panel.style.display = "none";        // make sure hidden by default
    panel.style.zIndex = "9999";         // bring to front (keeps your look)

    panel.innerHTML = `
      <div class="category-panel__header">
        <button class="themed-button" id="panelCloseBtn" aria-label="Close">Close ✕</button>
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

    const openPanel = () => {
      panel.setAttribute("aria-hidden", "false");
      panel.classList.add("is-open");
      panel.style.display = ""; // let your stylesheet style it
    };
    const closePanel = () => {
      panel.setAttribute("aria-hidden", "true");
      panel.classList.remove("is-open");
      panel.style.display = "none";
    };

    panel.dataset.tkOpen  = "1";
    panel.dataset.tkClose = "1";
    panel._openPanel  = openPanel;
    panel._closePanel = closePanel;

    $("#panelCloseBtn", panel)?.addEventListener("click", closePanel);
    return panel;
  }

  function openCategoryPanel() {
    const panel = ensureCategoryPanel();
    panel?._openPanel?.();
  }
  function closeCategoryPanel() {
    $("#categorySurveyPanel")?._closePanel?.();
  }

  /* ===================== RENDER CHOOSER ===================== */
  function renderCategoryChooser(categories) {
    const listEl = $("#categoryList") || $("[data-tk='category-list']");
    if (!listEl) return;

    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    categories.forEach(cat => {
      const lab = document.createElement("label");
      lab.className = "tk-chip";
      lab.innerHTML = `
        <input type="checkbox" class="tk-cat" value="${cat}">
        <span class="txt">${cat}</span>
      `;
      frag.appendChild(lab);
    });
    listEl.appendChild(frag);

    const badge = $("#catCount") || $("[data-tk='cat-count']");
    const update = () => { if (badge) badge.textContent = `${$$(".tk-cat:checked", listEl).length} selected / ${categories.length} total`; };
    listEl.addEventListener("change", update); update();

    $("#btnSelectAll")?.addEventListener("click", () => { $$(".tk-cat", listEl).forEach(c => c.checked = true);  listEl.dispatchEvent(new Event("change")); });
    $("#btnDeselectAll")?.addEventListener("click", () => { $$(".tk-cat", listEl).forEach(c => c.checked = false); listEl.dispatchEvent(new Event("change")); });

    $("#btnProceed")?.addEventListener("click", () => {
      const sel = $$(".tk-cat:checked", listEl).map(c => c.value);
      const chosen = sel.length ? sel : Data.categories;
      if (!chosen.length) return alert("No categories available.");
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
  }

  /* ===================== START BUTTON WIRING (ROBUST) ===================== */
  function textContent(el) {
    return (el?.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
  }

  // 1) Event delegation: catch clicks anywhere and match likely “Start Survey” triggers.
  function installGlobalStartListener() {
    document.addEventListener("click", (e) => {
      const clickEl = e.target.closest(
        "#startSurvey, .start-survey-btn, [data-tk='start'], [data-action='start-survey'], a[href*='#start']"
      );
      if (clickEl) { e.preventDefault(); openCategoryPanel(); return; }

      // Fallback: button-like element whose visible text is “Start Survey”
      const btn = e.target.closest("button, a, div, span");
      if (btn && textContent(btn) === "start survey") {
        e.preventDefault(); openCategoryPanel();
      }
    }, true);
  }

  // 2) Direct wire if a known element exists at load (no harm if also caught by delegation).
  function wireKnownStartButtons() {
    const candidates = [
      "#startSurvey",
      ".start-survey-btn",
      "[data-tk='start']",
      "[data-action='start-survey']",
      "a[href*='#start']"
    ];
    candidates.forEach(sel => {
      $$(sel).forEach(el => {
        el.addEventListener("click", (e) => { e.preventDefault(); openCategoryPanel(); }, { capture:true, once:false });
      });
    });
  }

  /* ===================== BOOT ===================== */
  async function loadAll() {
    // Load data
    Data.kinks = await fetchJSON("/data/kinks.json");
    try { Data.labelOverrides = await fetchJSON("/data/labels-overrides.json"); } catch { Data.labelOverrides = {}; }

    Data.labelMap   = buildLabelMap(Data.kinks, Data.labelOverrides);
    Data.categories = Array.isArray(window.__TK_CATEGORIES__) && window.__TK_CATEGORIES__.length
      ? window.__TK_CATEGORIES__.slice().sort((a,b)=>a.localeCompare(b))
      : deriveCategoriesFromKinks(Data.kinks);

    // Panel + UI
    ensureCategoryPanel();
    renderCategoryChooser(Data.categories);
    installGlobalStartListener();
    wireKnownStartButtons();

    // Make data globally available
    window.__TK__ = Data;

    log(`Loaded ${Data.categories.length} categories; UI wired.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll, { once: true });
  } else {
    loadAll();
  }
})();

/* ================== Compatibility: code → name swap ================== */
(() => {
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f=async u=>(await fetch(u,{cache:"no-store"})).json();
    const k=await f("/data/kinks.json"); const o=await f("/data/labels-overrides.json").catch(()=>({}));
    const map={...o}; (Array.isArray(k)?k:(k?.items||[])).forEach(it=>{ if(it?.id&&it?.name)map[String(it.id)]=String(it.name); if(it?.code&&it?.name)map[String(it.code)]=String(it.name); if(it?.cb&&it?.label)map[String(it.cb)]=String(it.label);}); return map;
  }
  async function swapCodes() {
    const map = await ensureLabelMap();
    document.querySelectorAll("table td:first-child, table th:first-child").forEach(td => {
      const raw = td.textContent.trim();
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", swapCodes, { once: true });
  else swapCodes();
})();

/* ================== Full-bleed black PDF export ================== */
(() => {
  const loadScript = (src) => new Promise((ok,err)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=err; document.head.appendChild(s); });
  async function ensurePDFLibs() {
    if (!window.jspdf)       await loadScript("/js/vendor/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("/js/vendor/html2canvas.min.js");
  }
  async function ensureLabelMap(){
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f=async u=>(await fetch(u,{cache:"no-store"})).json();
    const k=await f("/data/kinks.json"); const o=await f("/data/labels-overrides.json").catch(()=>({}));
    const map={...o}; (Array.isArray(k)?k:(k?.items||[])).forEach(it=>{ if(it?.id&&it?.name)map[String(it.id)]=String(it.name); if(it?.code&&it?.name)map[String(it.code)]=String(it.name); if(it?.cb&&it?.label)map[String(it.cb)]=String(it.label);}); return map;
  }
  async function makeFullBleedPDF(){
    await ensurePDFLibs(); const map=await ensureLabelMap();
    const table=document.querySelector("table"); if(!table) return alert("No table to export.");
    const clone=table.cloneNode(true);
    clone.querySelectorAll("td:first-child, th:first-child").forEach(td=>{ const raw=td.textContent.trim(); if(raw.startsWith("cb_") && map[raw]) td.textContent=map[raw]; });
    const wrap=document.createElement("div"); wrap.style.background="#000"; wrap.style.padding="0"; wrap.style.margin="0"; wrap.appendChild(clone); document.body.appendChild(wrap);
    const canvas=await html2canvas(wrap,{backgroundColor:"#000",scale:2}); document.body.removeChild(wrap);
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const w=pdf.internal.pageSize.getWidth(), h=pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,w,h,undefined,"FAST");
    pdf.save("compatibility.pdf");
  }
  const btn=document.getElementById("dl") || document.querySelector("[data-tk='download']");
  btn?.addEventListener("click",(e)=>{ e.preventDefault(); makeFullBleedPDF(); });
  window.tkMakeCompatibilityPDF = makeFullBleedPDF;
})();
