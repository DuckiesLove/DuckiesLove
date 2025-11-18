import { normalizeKey } from './compatNormalizeKey.js';

// Partner A Loader: attaches JSON upload handler and PDF download guard
// Auto-generated based on provided snippet.


const CFG = {
  uploadSelector: '#uploadSurveyA, [data-upload-a]',
  downloadSelector: '#downloadBtn',
  tableContainer: '#compat-container, #pdf-container',
  partnerACellSelector: null,
  createMissingPartnerACol: true,
  partnerAHeaderText: 'Partner A'
};

const $one = (sel, ctx = document) => ctx.querySelector(sel);
const $all = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const normalize = normalizeKey;

const PARTNER_WEB_TABLE_SELECTOR = '#partnerWebReport';

if (typeof window !== 'undefined') {
  window.generateDarkPDF = function () {
    console.info('[partner-web-report] PDF export disabled on this page.');
  };
}

function safeString(val) {
  if (val == null) return '';
  const s = String(val).trim();
  return (s === 'null' || s === 'undefined') ? '' : s;
}

function coerceScore(val) {
  if (val == null || (typeof val === 'string' && !val.trim())) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const parsed = Number(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(v) {
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

function computeMatchPercent(rawMatch, aScore, bScore) {
  const direct = clampPercent(coerceScore(rawMatch));
  if (direct != null) return Math.round(direct);

  if (Number.isFinite(aScore) && Number.isFinite(bScore)) {
    const pct = 100 - (Math.abs(aScore - bScore) / 5) * 100;
    return Math.round(Math.max(0, Math.min(100, pct)));
  }
  return null;
}

function getCompatRows() {
  if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
    return window.talkkinkCompatRows.slice();
  }

  try {
    const raw = localStorage.getItem('talkkink:compatRows');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[partner-web-report] could not read cached rows', e);
    return [];
  }
}

function normalizeCompatRow(row) {
  let item, aRaw, bRaw, matchRaw;

  if (Array.isArray(row)) {
    [item, aRaw, matchRaw, , bRaw] = row;
  } else if (row && typeof row === 'object') {
    item = row.item ?? row.label ?? row.category ?? '';
    aRaw = row.a ?? row.partnerA ?? row.aScore ?? row.scoreA;
    bRaw = row.b ?? row.partnerB ?? row.bScore ?? row.scoreB;
    matchRaw =
      row.matchPercent ??
      row.matchPct ??
      row.match ??
      row.matchText ??
      row.matchValue ??
      '';
  }

  const aScore = coerceScore(aRaw);
  const bScore = coerceScore(bRaw);
  const matchPercent = computeMatchPercent(matchRaw, aScore, bScore);

  return {
    item: safeString(item),
    a: aScore != null ? String(aScore) : safeString(aRaw),
    b: bScore != null ? String(bScore) : safeString(bRaw),
    match: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
  };
}

function buildPartnerWebReport() {
  const table = document.querySelector(PARTNER_WEB_TABLE_SELECTOR);
  if (!table) return;

  const rawRows = getCompatRows();
  if (!rawRows.length) {
    table.innerHTML =
      '<thead><tr><th>Kinks</th><th>Partner A</th><th>Match</th><th>Partner B</th></tr></thead>' +
      '<tbody><tr><td colspan="4">Load both surveys on the compatibility page first.</td></tr></tbody>';
    return;
  }

  const rows = rawRows.map(normalizeCompatRow).filter(r => r.item || r.a || r.b || r.match);

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Kinks', 'Partner A', 'Match', 'Partner B'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');

    const tdItem = document.createElement('td');
    tdItem.textContent = r.item;
    tr.appendChild(tdItem);

    const tdA = document.createElement('td');
    tdA.textContent = r.a;
    tr.appendChild(tdA);

    const tdMatch = document.createElement('td');
    tdMatch.textContent = r.match;
    tr.appendChild(tdMatch);

    const tdB = document.createElement('td');
    tdB.textContent = r.b;
    tr.appendChild(tdB);

    tbody.appendChild(tr);
  });

  table.innerHTML = '';
  table.appendChild(thead);
  table.appendChild(tbody);
}

function tagPartnerAColumn(root = $one(CFG.tableContainer)) {
  if (!root) return;
  root.querySelectorAll('table').forEach(table => {
    const header = table.querySelector('thead tr');
    if (!header) return;
    const headers = [...header.children].map(h => normalize(h.textContent));
    const idx = headers.findIndex(h => h === normalize(CFG.partnerAHeaderText));
    if (idx < 0) return;
    table.querySelectorAll('tbody tr').forEach(row => {
      const cell = row.cells[idx];
      if (cell) {
        if (cell.classList && cell.classList.add) {
          cell.classList.add('pa');
        } else if (!cell.className.split(/\s+/).includes('pa')) {
          cell.className = (cell.className ? cell.className + ' ' : '') + 'pa';
        }
      }
    });
  });
}

function annotateRows(root = $one(CFG.tableContainer)) {
  if (!root) return;
  root.querySelectorAll('table tbody tr').forEach(tr => {
    const existing = tr.getAttribute('data-key');
    if (existing && existing.trim()) {
      tr.setAttribute('data-key', normalize(existing));
      return;
    }
    const first = tr.querySelector('td:first-child, th:first-child');
    const label =
      tr.getAttribute('data-full') || tr.getAttribute('data-label') ||
      (first && (first.getAttribute('data-full') || first.getAttribute('data-label'))) ||
      tr.getAttribute('title') || tr.getAttribute('aria-label') ||
      (first && (first.getAttribute('title') || first.getAttribute('aria-label'))) ||
      (first ? first.textContent : '');
    tr.setAttribute('data-key', normalize(label));
  });
}

function getHeaders() {
  const headerRow = $one(`${CFG.tableContainer} thead tr`) || $one(`${CFG.tableContainer} tr`);
  return headerRow ? [...headerRow.cells].map(th => normalize(th.textContent)) : [];
}

function ensurePartnerACol() {
  if (!CFG.createMissingPartnerACol) return;
  const headers = getHeaders();
  if (!headers.includes(normalize(CFG.partnerAHeaderText))) {
    $all(`${CFG.tableContainer} tr`).forEach((row, i) => {
      const cell = i === 0 ? document.createElement('th') : document.createElement('td');
      if (i === 0) cell.textContent = CFG.partnerAHeaderText;
      else {
        cell.className = 'pa';
        cell.textContent = '-';
      }
      row.insertBefore(cell, row.cells[1] || null);
    });
  }
  tagPartnerAColumn();
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length > 10 && (a.includes(b) || b.includes(a))) return 0.9;
  const A = new Set(a.split(/\s+/));
  const B = new Set(b.split(/\s+/));
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter || 1;
  return inter / union;
}

function fillPartnerA(data) {
  let matched = 0;
  const keys = Object.keys(data);
  $all(`${CFG.tableContainer} tbody tr`).forEach(row => {
    const key = row.getAttribute('data-key');
    if (!key) return;
    let cell = row.querySelector('.pa');
    if (!cell) cell = CFG.partnerACellSelector ? row.querySelector(CFG.partnerACellSelector) : row.cells[1];
    if (!cell) return;
    const current = (cell.textContent || '').trim();
    if (current && !/^[-–—]$/.test(current)) return;
    if (key in data) {
      cell.textContent = String(data[key]);
      matched++;
      return;
    }
    let bestK = null, bestS = 0;
    for (const k of keys) {
      const s = similarity(key, k);
      if (s > bestS) { bestS = s; bestK = k; }
      if (bestS >= 0.92) break;
    }
    if (bestS >= 0.72 && bestK != null) {
      cell.textContent = String(data[bestK]);
      matched++;
    }
  });
  return matched;
}

function observeDom() {
  const root = $one(CFG.tableContainer);
  if (!root || typeof MutationObserver !== 'function') return;
  const mo = new MutationObserver(() => {
    if (window.partnerASurvey) {
      const lookup = surveyToLookup(window.partnerASurvey);
      annotateRows();
      tagPartnerAColumn();
      fillPartnerA(lookup);
      if (typeof window.populateFlags === 'function') window.populateFlags();
    }
  });
  mo.observe(root, { childList: true, subtree: true });
}

function normalizeSurvey(json) {
  const items = [];
  const toNum = v => (typeof v === 'number' ? v : Number(v ?? 0));

  const walk = obj => {
    if (!obj) return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj !== 'object') return;

    if (Array.isArray(obj.items)) {
      obj.items.forEach(walk);
      return;
    }

    const hasKey = obj.key || obj.id || obj.name || obj.label;
    const hasRating = obj.rating ?? obj.score ?? obj.value;
    if (hasKey && hasRating !== undefined) {
      items.push({
        key: obj.key ?? obj.id ?? obj.name ?? obj.label,
        rating: toNum(obj.rating ?? obj.score ?? obj.value)
      });
      return;
    }

    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' || typeof v === 'string') {
        items.push({ key: k, rating: toNum(v) });
      } else if (v && typeof v === 'object') {
        if ('rating' in v || 'score' in v || 'value' in v) {
          items.push({ key: k, rating: toNum(v.rating ?? v.score ?? v.value) });
        } else {
          walk(v);
        }
      }
    }
  };

  if (json && typeof json === 'object') walk(json);
  return { items };
}

function surveyToLookup(survey) {
  const out = {};
  if (!survey || !Array.isArray(survey.items)) return out;
  survey.items.forEach(it => {
    const key = normalize(it.key ?? it.id ?? it.label ?? it.name);
    if (key) out[key] = Number(it.rating ?? it.score ?? it.value ?? 0);
  });
  return out;
}

async function handlePartnerAUpload(file) {
  const json = await file.text();
  let parsed = {};
  try { parsed = JSON.parse(json); } catch (e) { alert('Invalid JSON'); return; }
  const survey = normalizeSurvey(parsed);
  const lookup = surveyToLookup(survey);
  window.partnerASurvey = window.surveyA = survey;
  if (typeof updateComparison === 'function') updateComparison();
  ensurePartnerACol();
  annotateRows();
  tagPartnerAColumn();
  setTimeout(() => {
    annotateRows();
    tagPartnerAColumn();
    const matched = fillPartnerA(lookup);
    if (typeof window.populateFlags === 'function') window.populateFlags();
    if (!matched) {
      console.warn('[Partner A] No values found yet — will attempt to annotate and refill.');
    }
  }, 300);
}

function guardDownload() {
  const btn = $one(CFG.downloadSelector);
  if (!btn) return;
  btn.addEventListener('click', e => {
    const hasData = $all(`${CFG.tableContainer} ${CFG.partnerACellSelector || 'td'}`).some(td => /\d/.test(td.textContent));
    if (!hasData) {
      e.preventDefault();
      alert('Please upload Partner A data before downloading PDF.');
    } else if (typeof downloadCompatibilityPDF === 'function') {
      e.preventDefault();
      const theme = (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'light';
      downloadCompatibilityPDF(theme);
    }
  });
}

// initialization
function initPartnerALoader() {
  ensurePartnerACol();
  annotateRows();
  tagPartnerAColumn();
  observeDom();
  const up = $one(CFG.uploadSelector);
  if (up) up.addEventListener('change', e => {
    e.stopImmediatePropagation?.();
    if (e.target.files.length) handlePartnerAUpload(e.target.files[0]);
  }, true);
  guardDownload();
  buildPartnerWebReport();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initPartnerALoader);
  if (document.readyState !== 'loading') {
    try { initPartnerALoader(); } catch (err) {
      console.warn('[partner-a-loader] init failed', err);
    }
  }
}

// Unified exports from both branches
export { ensurePartnerACol, handlePartnerAUpload, CFG };
export { normalizeSurvey, surveyToLookup };

