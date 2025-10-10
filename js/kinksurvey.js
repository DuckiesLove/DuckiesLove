/* ------------------------------------------------------------
   FILE:  /js/kinksurvey.js
   PURPOSE: Robust loader + Start Survey wiring + label map + categories fallback
   ------------------------------------------------------------ */
(() => {
  // --- small helpers --------------------------------------------------------
  const log = (...a) => console.log("[TK]", ...a);
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const fetchJSON = async (url) => {
    const res = await fetch(url, {cache:"no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  // --- data cache ------------------------------------------------------------
  const Data = {
    kinks: null,                 // full kinks.json (array or object)
    categoriesFile: null,        // optional categories.json (array of strings or {id,name}[])
    labelOverrides: {},          // labels-overrides.json (code->name)
    labelMap: {},                // final code->name map (merged)
    categories: [],              // final category list (strings)
  };

  // --- derive categories if categories.json is missing -----------------------
  function deriveCategoriesFromKinks(kinks) {
    // Accept both array-of-objects or {items:[...]} shapes
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const set = new Set();
    list.forEach(it => {
      // common fields: it.category, it.categories, it.group
      if (typeof it?.category === "string" && it.category.trim()) set.add(it.category.trim());
      if (Array.isArray(it?.categories)) it.categories.forEach(c => c && set.add(String(c).trim()));
      if (typeof it?.group === "string" && it.group.trim()) set.add(it.group.trim());
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  // --- build label map for cb_* codes -> friendly names ----------------------
  function buildLabelMap(kinks, overrides) {
    const map = {...overrides};
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    list.forEach(it => {
      if (it?.id && it?.name) map[String(it.id)] = String(it.name);
      if (it?.code && it?.name) map[String(it.code)] = String(it.name);
      if (it?.cb && it?.label) map[String(it.cb)]  = String(it.label);
    });
    return map;
  }

  // --- UI: render category chips/checkboxes (keeps your look) ----------------
  function renderCategoryChooser(categories) {
    const mount = document.getElementById("categoryList") || document.querySelector("[data-tk='category-list']");
    if (!mount) return;
    mount.innerHTML = "";
    const frag = document.createDocumentFragment();
    categories.forEach(cat => {
      const row = document.createElement("label");
      row.className = "tk-chip"; // reuses existing styles
      row.innerHTML = `
        <input type="checkbox" class="tk-cat" value="${cat}">
        <span class="txt">${cat}</span>
      `;
      frag.appendChild(row);
    });
    mount.appendChild(frag);
    // counters
    const badge = document.getElementById("catCount") || document.querySelector("[data-tk='cat-count']");
    const updateBadge = () => { if (badge) badge.textContent = `${$$(".tk-cat:checked", mount).length} selected / ${categories.length} total`; };
    mount.addEventListener("change", updateBadge);
    updateBadge();
    // select/deselect all
    const btnSelAll = document.getElementById("btnSelectAll");
    const btnDesel  = document.getElementById("btnDeselectAll");
    btnSelAll?.addEventListener("click", () => { $$(".tk-cat", mount).forEach(c => (c.checked = true)); mount.dispatchEvent(new Event("change")); });
    btnDesel?.addEventListener("click", () => { $$(".tk-cat", mount).forEach(c => (c.checked = false)); mount.dispatchEvent(new Event("change")); });
  }

  // --- START SURVEY wiring (no freeze if categories file missing) ------------
  function wireStartSurvey() {
    const btn = document.getElementById("startSurvey") || document.querySelector("[data-tk='start']");
    if (!btn) return;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        // selected categories (empty => use all)
        const sel = $$(".tk-cat:checked").map(c => c.value);
        const chosen = sel.length ? sel : Data.categories;
        if (!chosen.length) throw new Error("No categories available.");
        // Call your existing survey bootstrap function if present
        if (window.tkBeginSurvey) {
          window.tkBeginSurvey({ categories: chosen, kinks: Data.kinks, labels: Data.labelMap });
        } else {
          // Minimal fallback so the button does *something* without changing your visuals
          alert(`Survey would start with ${chosen.length} categories.`);
        }
      } catch (err) {
        console.error("[TK] start survey failed:", err);
        alert("Sorry, something prevented the survey from starting. Check the console for details.");
      }
    });
  }

  // --- boot loader -----------------------------------------------------------
  async function loadAll() {
    // 1) core data (must exist)
    const kinksUrl  = "/data/kinks.json";
    const labelsUrl = "/data/labels-overrides.json";
    // 2) optional categories file; if 404 we auto-derive
    const catsUrl   = "/data/categories.json";

    Data.kinks = await fetchJSON(kinksUrl);
    try {
      Data.categoriesFile = await fetchJSON(catsUrl);
    } catch (e) {
      Data.categoriesFile = null; // signal fallback
    }
    try {
      Data.labelOverrides = await fetchJSON(labelsUrl);
    } catch (e) {
      Data.labelOverrides = {};
    }

    Data.labelMap = buildLabelMap(Data.kinks, Data.labelOverrides);

    // normalize categories
    if (Array.isArray(Data.categoriesFile)) {
      // can be ["Impact Play","Breath Play", ...] or [{id,name},...]
      Data.categories = Data.categoriesFile.map(c => typeof c === "string" ? c : (c?.name || c?.id || "")).filter(Boolean);
    } else {
      Data.categories = deriveCategoriesFromKinks(Data.kinks);
    }

    renderCategoryChooser(Data.categories);
    wireStartSurvey();
    log(`Loaded ${Data.categories.length} categories; UI wired.`);
    window.__TK__ = Data; // handy for other modules (e.g., PDF + compat page)
  }

  // run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll, {once:true});
  } else {
    loadAll();
  }
})();
