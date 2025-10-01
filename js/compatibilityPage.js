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

import { loadLabels, fmtCell } from './tk-labels.js';

(() => {
  // ---------- CONFIG ----------
  const ID_PREFIXES = ['cb_', 'gn_', 'sa_', 'sh_', 'bd_', 'pl_', 'ps_', 'vr_', 'vo_'];

  // If a small number of ids truly aren’t in your kinks.json, you can hardcode them here:
  const FALLBACK_LABELS = {
    // 'cb_wwf76': 'Makeup as protocol or control',
    // 'cb_swujj': 'Accessory or ornament rules',
    // 'cb_05hqj': 'Wardrobe restrictions or permissions',
  };

  // ---------- LITTLE UTILITIES ----------
  const $ = sel => document.querySelector(sel);
  function hasPrefix(id) { return typeof id === 'string' && ID_PREFIXES.some(p => id.startsWith(p)); }
  const normalizeId = (id) => {
    if (id == null) return '';
    return hasPrefix(id) ? String(id).trim().toLowerCase() : '';
  };

  // ---------- LABELS: AUTO-BUILD FROM kinks.json ----------
  let LABELS = {}; // id -> friendly text from site kinks.json
  let AUTO_LABELS = {}; // id -> friendly text sourced from uploads
  let labelGetter = (id) => (id == null ? '' : String(id));
  let loggedMissingOnce = false;

  function tighten(s) {
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t.length > 140 ? `${t.slice(0, 137)}…` : t;
  }
  function friendlyLabel(id) {
    const key = normalizeId(id);
    if (!key) return labelGetter(id);
    if (AUTO_LABELS[key]) return tighten(AUTO_LABELS[key]);
    if (LABELS[key]) return tighten(LABELS[key]);
    return tighten(labelGetter(id));
  }

  function hasKnownLabel(id) {
    const key = normalizeId(id);
    if (!key) return false;
    return Boolean(AUTO_LABELS[key] || LABELS[key]);
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
        .map(a => ({ id: normalizeId(a.id), value: Number(a.value ?? 0) || 0 }))
        .filter(a => !!a.id);
    }
    const out = [];
    for (const [id, v] of Object.entries(raw)) {
      const norm = normalizeId(id);
      if (norm) out.push({ id: norm, value: Number(v ?? 0) || 0 });
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

    const labelledRows = applyLabelsToRows(rows)
      .sort((x, y) => x.label.localeCompare(y.label, undefined, { sensitivity: 'base' }));

    const usedIds = labelledRows.map(r => r.id);
    const missing = [];

    for (let i = 0; i < labelledRows.length; i += 1) {
      const r = labelledRows[i];
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.classList.add('compatNameCell');
      if (!hasKnownLabel(r.id)) missing.push(r.id);
      nameCell.textContent = r.label;

      const tdA = document.createElement('td');
      tdA.textContent = fmtCell(r.a);

      const pctCell = document.createElement('td');
      const pctRaw = Number.isFinite(r.pct) ? Math.max(0, Math.min(100, Math.round(r.pct))) : NaN;
      const pctText = fmtCell(pctRaw, '%');
      if (pctText !== '—') {
        pctCell.innerHTML = `<div class="pctBar" style="--pct:${pctRaw}%"><i></i><span>${pctText}</span></div>`;
      } else {
        pctCell.textContent = pctText;
      }

      const tdB = document.createElement('td');
      tdB.textContent = fmtCell(r.b);

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
    document.dispatchEvent(new Event('tk:compat:table-ready'));
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

  function applyLabelsToRows(rows) {
    return rows.map(r => ({ ...r, label: friendlyLabel(r.id) }));
  }

  function mergeLabelsFromExports(list) {
    const out = {};
    for (const src of list) {
      if (!src) continue;
      const m = extractLabelsFromExport(src);
      for (const k in m) {
        const norm = normalizeId(k);
        if (norm && !out[norm]) out[norm] = tighten(m[k]);
      }
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
    const missing = uniqueIds.filter(id => !hasKnownLabel(id));
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
    try {
      const loaded = await loadLabels();
      labelGetter = loaded.getLabel;
      LABELS = { ...loaded.map };
    } catch (err) {
      console.warn('[labels] unable to load base labels:', err);
      LABELS = {};
    }

    // Merge hard-coded fallbacks (normalized)
    for (const [key, value] of Object.entries(FALLBACK_LABELS || {})) {
      const norm = normalizeId(key);
      if (norm && typeof value === 'string') LABELS[norm] = tighten(value);
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

(function addHardLabelOverrides(){
  const HARD = {
    "cb_wwf76": "Makeup specifics (brands, palette, rules)",
    "cb_swujj": "Accessory or ornament rules"
  };

  // If you’re using the LabelService helper:
  if (window.LabelService) {
    const _get = LabelService.get.bind(LabelService);
    LabelService.get = (id) => HARD[id] || _get(id);

    // also exclude these from “missing labels”
    if (typeof LabelService.missing === 'function') {
      const _missing = LabelService.missing.bind(LabelService);
      LabelService.missing = (ids) => _missing(ids).filter(id => !HARD[id]);
    }
  }
})();
