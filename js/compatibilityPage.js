/* SAVE THIS AS: /js/compatibilityPage.js
 *
 * What it does
 * ------------
 * 1) Loads Survey A & B JSON files exactly as before.
 * 2) Auto-builds a COMPLETE label map (id -> friendly text) by deep-reading your master kinks.json.
 *    It tries these URLs in order: /kinksurvey/data/kinks.json, /data/kinks.json, /kinks.json, kinks.json
 *    (Adjust LABEL_URLS below if your path is different.)
 * 3) Renders the table with readable Category names (no more cb_xxxxx) and a match % bar.
 * 4) If any ids are still missing from kinks.json, they show once in the console and the raw code is
 *    shown in the table so you can spot it.
 *
 * How to wire (no HTML redesign required)
 * ---------------------------------------
 * - Make sure one of the paths in LABEL_URLS points to the same kinks.json your survey uses.
 * - Your page should already have file inputs/buttons and a table container. This script looks for:
 *     #btnUploadA (or #uploadA)       -> click to select Survey A
 *     #btnUploadB (or #uploadB)       -> click to select Survey B
 *     #fileA  (or #surveyA)           -> <input type="file"> for Survey A
 *     #fileB  (or #surveyB)           -> <input type="file"> for Survey B
 *     #compatTable (or #compat-container or #table) -> where the table renders
 * - Include this script on compatibility.html:
 *     <script defer src="/js/compatibilityPage.js"></script>
 */

(() => {
  // ---------- CONFIG ----------
  const LABEL_URLS = [
    '/kinksurvey/data/kinks.json',
    '/data/kinks.json',
    '/kinks.json',
    'kinks.json'
  ];

  // Treat ids starting with any of these as item ids we want to label
  const ID_PREFIXES = ['cb_', 'gn_', 'sa_', 'sh_', 'bd_', 'pl_', 'ps_', 'vr_', 'vo_'];

  // If a small number of ids truly aren’t in your kinks.json, you can hardcode them here:
  const FALLBACK_LABELS = {
    // 'cb_wwf76': 'Makeup as protocol or control',
    // 'cb_swujj': 'Accessory or ornament rules',
    // 'cb_05hqj': 'Wardrobe restrictions or permissions',
  };

  // ---------- LITTLE UTILITIES ----------
  const $ = sel => document.querySelector(sel);
  const dash = '—';

  function tidy(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function hasPrefix(id) { return typeof id === 'string' && ID_PREFIXES.some(p => id.startsWith(p)); }

  // ---------- LABELS: AUTO-BUILD FROM kinks.json ----------
  let LABELS = {}; // id -> friendly text
  let loggedMissingOnce = false;

  async function loadJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch { throw new Error('Not JSON (HTML?)'); }
  }

  // Walk all objects/arrays and collect {id: label}
  function deepCollectLabels(node, out) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(n => deepCollectLabels(n, out)); return; }
    if (typeof node !== 'object') return;

    const id = node.id ?? node.code ?? node.key;
    const label = node.short ?? node.label ?? node.title ?? node.text ?? node.name;

    if (hasPrefix(id) && typeof label === 'string') {
      out[id] = tidy(label);
    }
    // keep digging
    for (const v of Object.values(node)) deepCollectLabels(v, out);
  }

  async function buildLabels() {
    for (const url of LABEL_URLS) {
      try {
        const json = await loadJson(url);
        const collected = {};
        deepCollectLabels(json, collected);
        const count = Object.keys(collected).length;
        if (count > 0) {
          LABELS = { ...collected, ...FALLBACK_LABELS }; // collected wins; fallback fills gaps
          console.info(`[labels] built ${count} labels from ${url}`);
          return;
        } else {
          console.warn(`[labels] found 0 labels in ${url}`);
        }
      } catch (e) {
        console.warn(`[labels] ${url} → ${e.message}`);
      }
    }
    LABELS = { ...FALLBACK_LABELS };
    console.warn('[labels] using FALLBACK_LABELS only');
  }

  function prettyLabel(id) {
    const { TKLabels } = globalThis;
    if (TKLabels && typeof TKLabels.label === 'function') {
      const friendly = TKLabels.label(id);
      if (friendly) return tidy(friendly);
    }
    return LABELS[id] || FALLBACK_LABELS[id] || id; // show raw code only if truly missing
  }

  // ---------- SURVEY LOADING ----------
  function readJsonFile(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('File read error'));
      fr.onload = () => {
        try { res(JSON.parse(String(fr.result || 'null'))); }
        catch { rej(new Error('Invalid JSON')); }
      };
      fr.readAsText(file);
    });
  }

  // Normalize multiple shapes to [{id, value}]
  // Supports { answers: [ {id, value}, ... ] } or a flat { id: value, ... }
  function normalizeSurvey(raw) {
    if (!raw) return [];
    if (Array.isArray(raw.answers)) {
      return raw.answers
        .filter(a => a && hasPrefix(a.id))
        .map(a => ({ id: a.id, value: Number(a.value ?? 0) || 0 }));
    }
    const out = [];
    for (const [id, v] of Object.entries(raw)) {
      if (hasPrefix(id)) out.push({ id, value: Number(v ?? 0) || 0 });
    }
    return out;
  }

  // ---------- RENDER ----------
  async function renderTable(container, rows) {
    const tbl = document.createElement('table');
    tbl.className = 'compat-table'; // keep your CSS

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Category', 'Partner A', 'Match %', 'Partner B'].forEach(h => {
      const th = document.createElement('th'); th.textContent = h; trh.appendChild(th);
    });
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    const missing = [];

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.classList.add('compatNameCell');
      const label = prettyLabel(r.id);
      if (label === r.id) missing.push(r.id);
      nameCell.textContent = label;

      const tdA = document.createElement('td');
      tdA.textContent = (r.a ?? null) === null ? dash : String(r.a);

      const pctCell = document.createElement('td');
      const pctVal = Math.round(r.pct || 0);
      pctCell.innerHTML = (pctVal > 0)
        ? `<div class="pctBar" style="--pct:${pctVal}%"><i></i><span>${pctVal}%</span></div>`
        : '—';

      const tdB = document.createElement('td');
      tdB.textContent = (r.b ?? null) === null ? dash : String(r.b);

      tr.appendChild(nameCell);
      tr.appendChild(tdA);
      tr.appendChild(pctCell);
      tr.appendChild(tdB);
      tbody.appendChild(tr);

      if (i > 0 && i % 250 === 0) {
        await new Promise(rf => requestAnimationFrame(rf));
      }
    }

    tbl.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(tbl);

    if (missing.length && !loggedMissingOnce) {
      const uniq = [...new Set(missing)].sort();
      console.warn(`[labels] Missing ${uniq.length} labels (showing raw codes):`, uniq);
      loggedMissingOnce = true;
    }
  }

  function computeRows(aList, bList) {
    const mapA = new Map(aList.map(x => [x.id, x.value]));
    const mapB = new Map(bList.map(x => [x.id, x.value]));
    const all = new Set([...mapA.keys(), ...mapB.keys()]);
    const out = [];
    for (const id of all) {
      const a = mapA.has(id) ? mapA.get(id) : null;
      const b = mapB.has(id) ? mapB.get(id) : null;
      let pct = null;
      if (a !== null && b !== null) {
        const diff = Math.abs(a - b);
        pct = Math.max(0, 100 - diff * 20); // 0..5 scale → 100,80,60,40,20,0
      }
      out.push({ id, a, b, pct });
    }
    // stable and readable: sort by friendly label
    out.sort((x, y) => prettyLabel(x.id).localeCompare(prettyLabel(y.id), undefined, { sensitivity: 'base' }));
    return out;
  }

  // ---------- WIRE UP ----------
  async function init() {
    const { TKLabels } = globalThis;
    if (TKLabels && typeof TKLabels.load === 'function') {
      await TKLabels.load();
    }
    if (!TKLabels || typeof TKLabels.label !== 'function') {
      await buildLabels();
    }

    const aBtn = $('#btnUploadA') || $('#uploadA');
    const bBtn = $('#btnUploadB') || $('#uploadB');
    const aFile = $('#fileA') || $('#surveyA');
    const bFile = $('#fileB') || $('#surveyB');
    const tableHost = $('#compatTable') || $('#compat-container') || $('#table');

    let aAnswers = [];
    let bAnswers = [];

    async function refresh() {
      if (!tableHost) return;
      await renderTable(tableHost, computeRows(aAnswers, bAnswers));
    }

    async function pickAndLoad(which) {
      const inp = which === 'A' ? aFile : bFile;
      if (!inp || !inp.files || !inp.files[0]) return;
      try {
        const raw = await readJsonFile(inp.files[0]);
        const norm = normalizeSurvey(raw);
        if (which === 'A') aAnswers = norm; else bAnswers = norm;
        await refresh();
      } catch (e) {
        alert(`Invalid JSON for Survey ${which}. Please upload the unmodified JSON exported from this site.`);
      }
    }

    if (aBtn && aFile) aBtn.addEventListener('click', () => aFile.click());
    if (bBtn && bFile) bBtn.addEventListener('click', () => bFile.click());
    if (aFile) aFile.addEventListener('change', () => pickAndLoad('A'));
    if (bFile) bFile.addEventListener('change', () => pickAndLoad('B'));

    // If you pre-hydrate from storage/cookies, do it here then refresh()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
