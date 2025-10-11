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
    if (panel) {
      panel.classList.add("tk-force");
      panel.style.position = "fixed";
      panel.style.inset = "0";
      panel.style.zIndex = "2147483000"; // higher than anything else on the page
      if (!panel.classList.contains("is-open")) panel.style.opacity = "0";
      if (!panel._openPanel) {
        panel._openPanel = () => {
          panel.setAttribute("aria-hidden", "false");
          panel.classList.add("is-open");
          panel.style.display = "block";
          panel.style.opacity = "1";
          document.body?.classList?.add("tk-panel-open");
        };
      }
      if (!panel._closePanel) {
        panel._closePanel = () => {
          panel.setAttribute("aria-hidden", "true");
          panel.classList.remove("is-open");
          panel.style.opacity = "0";
          panel.style.display = "none";
          document.body?.classList?.remove("tk-panel-open");
        };
      }
      return panel;
    }

    panel = document.createElement("aside");
    panel.id = "categorySurveyPanel";
    panel.className = "category-panel tk-wide-panel tk-force";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Category selection");
    panel.setAttribute("aria-hidden", "true");
    panel.style.position = "fixed";
    panel.style.inset = "0";
    panel.style.opacity = "0";
    panel.style.display = "none";        // make sure hidden by default
    panel.style.zIndex = "2147483000";   // bring to front (keeps your look)

    panel.innerHTML = `
      <div class="tk-card" role="document">
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
          <button id="btnProceed" class="themed-button start-survey-btn">Start Survey</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const openPanel = () => {
      panel.setAttribute("aria-hidden", "false");
      panel.classList.add("is-open");
      panel.style.display = ""; // let your stylesheet style it
      document.body?.classList?.add("tk-panel-open");
    };
    const closePanel = () => {
      panel.setAttribute("aria-hidden", "true");
      panel.classList.remove("is-open");
      panel.style.display = "none";
      document.body?.classList?.remove("tk-panel-open");
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
    const panel = $("#categorySurveyPanel");
    panel?._closePanel?.();
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
    const update = () => {
      if (badge) badge.textContent = `${$$(".tk-cat:checked", listEl).length} selected / ${categories.length} total`;
    };
    listEl.addEventListener("change", update); update();

    $("#btnSelectAll")?.addEventListener("click", () => {
      $$(".tk-cat", listEl).forEach(c => { c.checked = true; });
      update();
    });
    $("#btnDeselectAll")?.addEventListener("click", () => {
      $$(".tk-cat", listEl).forEach(c => { c.checked = false; });
      update();
    });

    $("#btnProceed")?.addEventListener("click", (ev) => {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
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
  const textContent = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

  function looksLikeStart(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.dataset.tkStartHook === "1") return false;

    if (
      el.matches?.(
        "#startSurvey, #startSurveyBtn, #startSurveyButton, .start-survey-btn, [data-tk='start'], [data-tk-start], [data-tk-start-survey], [data-action='start-survey'], [data-tk='start-survey'], [data-tk='start']"
      )
    ) {
      return true;
    }

    const txt = textContent(el);
    if (txt && /start\s*survey/.test(txt)) return true;

    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (aria && /start\s*survey/.test(aria)) return true;

    const href = (el.getAttribute("href") || "").toLowerCase();
    if (href && (/\/kinksurvey\/?$/.test(href) || href.includes("start"))) return true;

    return false;
  }

  function wireStartButton(el) {
    if (!looksLikeStart(el)) return false;
    el.dataset.tkStartHook = "1";
    el.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCategoryPanel();
      },
      { capture: true }
    );
    return true;
  }

  function wireAllStartButtons(root = document) {
    let wired = 0;
    const priority = [
      "#startSurvey",
      "#startSurveyBtn",
      "#startSurveyButton",
      ".start-survey-btn",
      "[data-tk='start']",
      "[data-tk-start]",
      "[data-tk-start-survey]",
      "[data-action='start-survey']",
      "[data-tk='start-survey']",
      "a[href*='#start']"
    ];
    priority.forEach((sel) => {
      $$(sel, root).forEach((el) => {
        wired += wireStartButton(el) ? 1 : 0;
      });
    });

    $$("a,button,[role='button'],.themed-button,div,span", root).forEach((el) => {
      wired += wireStartButton(el) ? 1 : 0;
    });
    return wired;
  }

  function installGlobalStartListener() {
    document.addEventListener(
      "click",
      (e) => {
        const clickEl = e.target.closest(
          "a,button,[role='button'],.themed-button,div,span"
        );
        if (!clickEl) return;
        if (looksLikeStart(clickEl)) {
          e.preventDefault();
          e.stopPropagation();
          openCategoryPanel();
        }
      },
      true
    );
  }

  function observeStartButtons() {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (!m.addedNodes || !m.addedNodes.length) continue;
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          wireAllStartButtons(node);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function diagnosticAutoOpen() {
    const storageKey = "__TK_PANEL_AUTO_OPENED";
    if (window.__TK_PANEL_AUTO_OPENED) return;
    try {
      if (sessionStorage.getItem(storageKey) === "1") {
        window.__TK_PANEL_AUTO_OPENED = true;
        return;
      }
      sessionStorage.setItem(storageKey, "1");
    } catch {}
    window.__TK_PANEL_AUTO_OPENED = true;
    setTimeout(() => {
      const panel = ensureCategoryPanel();
      if (!panel) return;
      if (panel.classList.contains("is-open")) return;
      openCategoryPanel();
      log(
        "Auto-opened panel (diagnostic). If you see this, clicks were being blocked."
      );
    }, 800);
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
    wireAllStartButtons();
    observeStartButtons();
    diagnosticAutoOpen();

    // Make data globally available
    window.__TK__ = Data;
    window.tkOpenCategories = openCategoryPanel;
    window.tkCloseCategories = closeCategoryPanel;

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
