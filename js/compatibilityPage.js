/* SAVE THIS AS: /js/compatibilityPage.js
 *
 * What it does
 * ------------
 * 1) Loads Survey A & B JSON files exactly as before.
 * 2) Loads your site label map from kinks.json (multiple fallback URLs supported) and merges in
 *    automatic labels scraped from the uploaded Survey A/B JSON plus optional manual overrides.
 * 3) Renders the table with readable Category names (no more cb_xxxxx) and a match % bar.
 * 4) If any ids are still missing from all sources, they show once in the console and the raw code is
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

  const OVERRIDE_URL = '/data/labels-overrides.json';

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
  function hasPrefix(id) { return typeof id === 'string' && ID_PREFIXES.some(p => id.startsWith(p)); }

  // ---------- LABELS: AUTO-BUILD FROM kinks.json ----------
  let LABELS = {}; // id -> friendly text from site kinks.json
  let AUTO_LABELS = {}; // id -> friendly text sourced from uploads
  let OVERRIDE_LABELS = {}; // manual overrides map
  let loggedMissingOnce = false;

  function tighten(s) {
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t.length > 140 ? `${t.slice(0, 137)}…` : t;
  }

  function getLabel(id, site, auto, over, testOnly = false) {
    const txt = (site && site[id]) || (auto && auto[id]) || (over && over[id]) || (FALLBACK_LABELS && FALLBACK_LABELS[id]);
    if (testOnly) return !!txt;
    if (txt) return tighten(txt);
    return typeof id === 'string'
      ? id.replace(/^cb_/, '').replace(/_/g, ' ').trim()
      : String(id || '');
  }

  async function safeFetchJSON(url, opts = {}) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        if (opts.optional) return {};
        throw new Error(`${url} ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      if (opts.optional) return {};
      console.warn('[labels] failed to load', url, e);
      return {};
    }
  }

  async function loadSiteLabels() {
    for (const url of LABEL_URLS) {
      try {
        const json = await safeFetchJSON(url, { optional: true });
        const collected = collectLabelMap(json);
        const count = Object.keys(collected).length;
        if (count > 0) {
          LABELS = { ...collected, ...FALLBACK_LABELS };
          console.info(`[labels] built ${count} labels from ${url}`);
          return;
        }
        if (json && Object.keys(json).length) {
          console.warn(`[labels] ${url} loaded but contained no recognized ids`);
        }
      } catch (e) {
        console.warn(`[labels] ${url} → ${e.message}`);
      }
    }
    LABELS = { ...FALLBACK_LABELS };
    console.warn('[labels] using FALLBACK_LABELS only');
  }

  function collectLabelMap(json) {
    if (!json || typeof json !== 'object') return {};
    // If already a flat map of id -> label, trust it
    const entries = Object.entries(json);
    if (entries.every(([k, v]) => hasPrefix(k) && typeof v === 'string')) {
      return entries.reduce((acc, [k, v]) => { acc[k] = tighten(v); return acc; }, {});
    }
    const out = {};
    deepCollectLabels(json, out);
    return out;
  }

  // Walk all objects/arrays and collect {id: label}
  function deepCollectLabels(node, out) {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(n => deepCollectLabels(n, out)); return; }
    if (typeof node !== 'object') return;

    const id = node.id ?? node.code ?? node.key ?? node.slug ?? node.value;
    const label = node.short ?? node.label ?? node.title ?? node.text ?? node.name ?? node.question ?? node.prompt ?? node.summary ?? node.description ?? node.desc ?? node.caption ?? node.heading;

    if (hasPrefix(id) && typeof label === 'string') {
      if (!out[id]) out[id] = tighten(label);
    }
    for (const v of Object.values(node)) deepCollectLabels(v, out);
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

    const labelledRows = applyLabelsToRows(rows, LABELS, AUTO_LABELS, OVERRIDE_LABELS)
      .sort((x, y) => x.label.localeCompare(y.label, undefined, { sensitivity: 'base' }));

    const usedIds = labelledRows.map(r => r.id);
    const missing = [];

    for (let i = 0; i < labelledRows.length; i += 1) {
      const r = labelledRows[i];
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.classList.add('compatNameCell');
      if (!getLabel(r.id, LABELS, AUTO_LABELS, OVERRIDE_LABELS, true)) missing.push(r.id);
      nameCell.textContent = r.label;

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

    const uniqMissing = [...new Set(missing)].sort();
    if (uniqMissing.length && !loggedMissingOnce) {
      console.warn(`[labels] Missing ${uniqMissing.length} labels (showing raw codes):`, uniqMissing);
      loggedMissingOnce = true;
    }

    updateMissingButton([...new Set(usedIds)]);
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
    return out;
  }

  function applyLabelsToRows(rows, labels, autoLabels, overrideLabels) {
    const { TKLabels } = globalThis;
    for (const r of rows) {
      const id = r.id;
      let label = '';
      let source = 'id';

      if (TKLabels && typeof TKLabels.label === 'function') {
        const friendly = TKLabels.label(id);
        const tightFriendly = friendly != null ? tighten(friendly) : '';
        if (tightFriendly) {
          label = tightFriendly;
          source = 'tk';
        }
      }

      if (!label) {
        if (labels && labels[id]) {
          label = tighten(labels[id]);
          source = 'labels';
        } else if (autoLabels && autoLabels[id]) {
          label = tighten(autoLabels[id]);
          source = 'auto';
        } else if (overrideLabels && overrideLabels[id]) {
          label = tighten(overrideLabels[id]);
          source = 'overrides';
        } else if (FALLBACK_LABELS && FALLBACK_LABELS[id]) {
          label = tighten(FALLBACK_LABELS[id]);
          source = 'fallback';
        }
      }

      if (!label) {
        label = getLabel(id, labels, autoLabels, overrideLabels);
        source = 'id';
      }

      r.label = label;
      r.labelSource = source;
    }
    return rows;
  }

  function mergeLabelsFromExports(list) {
    const out = {};
    for (const src of list) {
      if (!src) continue;
      const m = extractLabelsFromExport(src);
      for (const k in m) if (!out[k]) out[k] = m[k];
    }
    return out;
  }

  function extractLabelsFromExport(json) {
    const map = {};
    const ID_KEYS = ['id', 'code', 'key', 'slug', 'value'];
    const TEXT_KEYS = ['text', 'label', 'name', 'question', 'title', 'prompt', 'short', 'summary', 'desc', 'description', 'caption', 'heading'];
    const LIST_KEYS = ['choices', 'options', 'answers', 'items', 'children', 'content', 'rows', 'elements', 'fields'];

    walk(json);
    return map;

    function isCbId(v) { return typeof v === 'string' && /^cb_[a-z0-9]+$/i.test(v); }
    function pickText(obj) {
      for (const k of TEXT_KEYS) {
        if (typeof obj?.[k] === 'string' && obj[k].trim()) return obj[k];
      }
      return null;
    }

    function walk(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node !== 'object') return;

      let cid = null;
      for (const k of ID_KEYS) {
        if (isCbId(node[k])) { cid = node[k]; break; }
      }
      if (cid) {
        const t = pickText(node);
        if (t && !map[cid]) map[cid] = tighten(t);
      }

      for (const k of LIST_KEYS) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(item => {
          if (item && typeof item === 'object') {
            let id2 = null;
            for (const kk of ID_KEYS) if (isCbId(item[kk])) { id2 = item[kk]; break; }
            if (id2) {
              const t2 = pickText(item);
              if (t2 && !map[id2]) map[id2] = tighten(t2);
            }
          }
          walk(item);
        });
      }

      for (const k in node) walk(node[k]);
    }
  }

  function updateMissingButton(usedIds) {
    const btn = document.getElementById('tk-missing-labels-btn');
    if (!btn) return;
    const uniqueIds = Array.from(new Set(usedIds)).filter(Boolean);
    const missing = uniqueIds.filter(id => !getLabel(id, LABELS, AUTO_LABELS, OVERRIDE_LABELS, true));
    if (missing.length) {
      btn.style.display = '';
      btn.onclick = () => downloadMissingLabels(missing.slice());
    } else {
      btn.style.display = 'none';
      btn.onclick = null;
    }
  }

  function downloadMissingLabels(missingIds) {
    const stub = Object.fromEntries(missingIds.map(id => [id, '']));
    downloadJSON('missing-labels.json', stub);
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  // ---------- WIRE UP ----------
  async function init() {
    const { TKLabels } = globalThis;
    if (TKLabels && typeof TKLabels.load === 'function') {
      await TKLabels.load();
    }

    await loadSiteLabels();
    OVERRIDE_LABELS = await safeFetchJSON(OVERRIDE_URL, { optional: true });
    if (OVERRIDE_LABELS && Object.keys(OVERRIDE_LABELS).length) {
      console.info(`[labels] loaded ${Object.keys(OVERRIDE_LABELS).length} overrides from ${OVERRIDE_URL}`);
    }

    const aBtn = $('#btnUploadA') || $('#uploadA');
    const bBtn = $('#btnUploadB') || $('#uploadB');
    const aFile = $('#fileA') || $('#surveyA');
    const bFile = $('#fileB') || $('#surveyB');
    const tableHost = $('#compatTable') || $('#compat-container') || $('#table');

    let aAnswers = [];
    let bAnswers = [];
    let surveyARaw = null;
    let surveyBRaw = null;

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
        if (which === 'A') {
          aAnswers = norm;
          surveyARaw = raw;
        } else {
          bAnswers = norm;
          surveyBRaw = raw;
        }
        AUTO_LABELS = mergeLabelsFromExports([surveyARaw, surveyBRaw]);
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
