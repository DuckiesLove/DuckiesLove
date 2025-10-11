/* /js/kinksurvey.js
   Reliable Start Survey → Category Panel + label map + full-bleed PDF.
*/
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

  const btnOpen = $('#startSurveyBtn');
  const panel = $('#categorySurveyPanel');
  const btnClose = $('#closeCategoryPanelBtn');
  const btnAll = $('#selectAllCatsBtn');
  const btnNone = $('#deselectAllCatsBtn');
  const listEl = $('#categoryList');
  const btnGo = $('#startSurveyNowBtn');
  const countEl = $('#catCount');

  if (!btnOpen || !panel || !listEl) {
    console.warn('[TK] Panel skeleton not found; skipping enhanced wiring.');
    return;
  }

  let categories = [];
  let ready = false;
  let wiredOpen = false;
  let wiredClose = false;
  let wiredSelect = false;
  let wiredGo = false;

  function escapeHtml(value = '') {
    return value.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  function renderList() {
    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const item of categories) {
      const pill = document.createElement('label');
      pill.className = 'pill';
      pill.dataset.code = item.code;
      pill.innerHTML = `
        <input type="checkbox" value="${item.code}">
        <span class="lbl">${escapeHtml(item.name)}</span>
      `;
      frag.appendChild(pill);
    }
    listEl.appendChild(frag);
    refreshCount();
  }

  function refreshCount() {
    if (!countEl) return;
    const total = categories.length;
    const selected = $$('input[type="checkbox"]:checked', listEl).length;
    countEl.textContent = `${selected} selected / ${total} total`;
  }

  function setAll(val) {
    $$('input[type="checkbox"]', listEl).forEach((cb) => {
      cb.checked = val;
    });
    refreshCount();
  }

  function selectedCodes() {
    return $$('input[type="checkbox"]:checked', listEl).map((cb) => cb.value);
  }

  function openPanel() {
    if (!ready) {
      if (Array.isArray(window.tkCategories) && window.tkCategories.length) {
        window.tkWireCategoryPanel(window.tkCategories);
      }
    }
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tk-lock');
    setTimeout(() => {
      try { listEl.focus({ preventScroll: true }); } catch {}
    }, 0);
  }

  function closePanel() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('tk-lock');
    btnOpen?.focus?.();
  }

  function wireButtons() {
    if (!wiredOpen && btnOpen) {
      btnOpen.addEventListener('click', openPanel, { passive: true });
      wiredOpen = true;
    }
    if (!wiredClose) {
      if (btnClose) btnClose.addEventListener('click', closePanel);
      panel.addEventListener('click', (event) => {
        if (event.target === panel) closePanel();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
      });
      wiredClose = true;
    }
    if (!wiredSelect) {
      if (btnAll) btnAll.addEventListener('click', () => setAll(true));
      if (btnNone) btnNone.addEventListener('click', () => setAll(false));
      listEl.addEventListener('change', refreshCount);
      wiredSelect = true;
    }
    if (!wiredGo && btnGo) {
      btnGo.addEventListener('click', () => {
        const chosen = selectedCodes();
        if (typeof window.tkStartSurvey === 'function') {
          window.tkStartSurvey(chosen);
        } else if (typeof window.startSurveyWithCategories === 'function') {
          window.startSurveyWithCategories(chosen);
        } else {
          try {
            localStorage.setItem('tk:selectedCategories', JSON.stringify(chosen));
          } catch {}
        }
        closePanel();
      });
      wiredGo = true;
    }
  }

  window.tkWireCategoryPanel = (cats) => {
    try {
      categories = (cats || [])
        .map((entry) => {
          if (typeof entry === 'string') {
            const text = entry.trim();
            return text ? { code: text, name: text } : null;
          }
          if (!entry || typeof entry !== 'object') return null;
          const code = entry.code ?? entry.id ?? entry.key ?? entry.name ?? '';
          const name = entry.name ?? entry.label ?? entry.title ?? code;
          const cleanCode = String(code || name || '').trim();
          const cleanName = String(name || code || '').trim();
          if (!cleanCode || !cleanName) return null;
          return { code: cleanCode, name: cleanName };
        })
        .filter(Boolean)
        .sort((a, b) => byText(a.name, b.name));

      renderList();
      wireButtons();
      ready = true;
      console.info(`[TK] Category panel wired with ${categories.length} categories.`);
    } catch (error) {
      console.error('[TK] tkWireCategoryPanel failed:', error);
    }
  };

  if (Array.isArray(window.tkCategories) && window.tkCategories.length) {
    window.tkWireCategoryPanel(window.tkCategories);
  }

  window.tkOpenCategories = openPanel;
  window.tkCloseCategories = closePanel;
})();

(() => {
  const log = (...args) => console.log('[TK]', ...args);

  const fetchJSON = async (url) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  const Data = { kinks: null, labelOverrides: {}, labelMap: {}, categories: [] };

  function deriveCategoriesFromKinks(kinks) {
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const set = new Set();
    for (const item of list) {
      if (item?.category) set.add(String(item.category).trim());
      if (Array.isArray(item?.categories)) item.categories.forEach((cat) => cat && set.add(String(cat).trim()));
      if (item?.group) set.add(String(item.group).trim());
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function buildLabelMap(kinks, overrides) {
    const map = { ...(overrides || {}) };
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    for (const item of list) {
      if (item?.id && item?.name) map[String(item.id)] = String(item.name);
      if (item?.code && item?.name) map[String(item.code)] = String(item.name);
      if (item?.cb && item?.label) map[String(item.cb)] = String(item.label);
    }
    return map;
  }

  async function loadAll() {
    Data.kinks = await fetchJSON('/data/kinks.json');
    try {
      Data.labelOverrides = await fetchJSON('/data/labels-overrides.json');
    } catch {
      Data.labelOverrides = {};
    }

    Data.labelMap = buildLabelMap(Data.kinks, Data.labelOverrides);
    const baseCategories = Array.isArray(window.__TK_CATEGORIES__) && window.__TK_CATEGORIES__.length
      ? window.__TK_CATEGORIES__.slice()
      : deriveCategoriesFromKinks(Data.kinks);

    Data.categories = baseCategories.slice();

    const categoriesArray = baseCategories
      .map((entry) => {
        if (typeof entry === 'string') {
          const text = entry.trim();
          return text ? { code: text, name: text } : null;
        }
        if (!entry || typeof entry !== 'object') return null;
        const code = entry.code ?? entry.id ?? entry.key ?? entry.name ?? '';
        const name = entry.name ?? entry.label ?? entry.title ?? code;
        const cleanCode = String(code || name || '').trim();
        const cleanName = String(name || code || '').trim();
        if (!cleanCode || !cleanName) return null;
        return { code: cleanCode, name: cleanName };
      })
      .filter(Boolean);

    window.__TK__ = Data;
    window.tkCategories = categoriesArray;
    if (typeof window.tkWireCategoryPanel === 'function') {
      window.tkWireCategoryPanel(categoriesArray);
    }

    log(`Loaded ${categoriesArray.length} categories; UI wired.`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll, { once: true });
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
