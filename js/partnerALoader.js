// Partner A Loader: attaches JSON upload handler and PDF download guard
// Auto-generated based on provided snippet.

import { compatNormalizeKey as normalize } from './compatNormalizeKey.js';

const CFG = {
  uploadSelector: '#uploadSurveyA, [data-upload-a]',
  downloadSelector: '#downloadBtn',
  tableContainer: '#pdf-container',
  partnerACellSelector: null,
  createMissingPartnerACol: true,
  partnerAHeaderText: 'Partner A'
};

const $one = (sel, ctx = document) => ctx.querySelector(sel);
const $all = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
// --- normalize (reuse if already defined elsewhere) ---
const __compatNormalize =
  (typeof window !== 'undefined' && window.__compatNormalize)
    ? window.__compatNormalize
    : (str =>
        (str || '')
          .trim()
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/[\u2013\u2014]/g, '-')      // – — -> -
          .replace(/\u2026/g, '...')            // … -> ...
          .replace(/\s+/g, ' ')
          .toLowerCase()
      );

// Optionally cache on window for other scripts
if (typeof window !== 'undefined' && !window.__compatNormalize) {
  window.__compatNormalize = __compatNormalize;
}

// --- __compatDump (browser-only helper) ---
if (typeof window !== 'undefined') {
  window.__compatDump = () => {
    console.log('Headers:', getHeaders());
    console.log(
      'Row samples:',
      $all(`${CFG.tableContainer} tr`).slice(0, 5).map(r => ({
        label: __compatNormalize(r.dataset.key || r.cells[0]?.textContent || ''),
        dataKey: r.dataset.key || '',
        partnerA: r.querySelector(CFG.partnerACellSelector)?.textContent
      }))
    );
  };
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
}

function fillPartnerA(data) {
  let matched = 0;
  $all(`${CFG.tableContainer} tr[data-key], ${CFG.tableContainer} tr`).forEach(row => {
    const key = normalize(row.dataset.key || row.cells[0]?.textContent || '');
    if (key && key in data) {
      let cell = CFG.partnerACellSelector ? row.querySelector(CFG.partnerACellSelector) : row.cells[1];
      if (cell) { cell.textContent = data[key]; matched++; }
    }
  });
  return matched;
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
  setTimeout(() => {
    const matched = fillPartnerA(lookup);
    if (!matched) {
      console.warn('[Partner A] No values found yet — will attempt to annotate and refill.');
      if (window.__compatMismatch) setTimeout(window.__compatMismatch, 300);
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
      downloadCompatibilityPDF();
    }
  });
}

// initialization
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    ensurePartnerACol();
    const up = $one(CFG.uploadSelector);
    if (up) up.addEventListener('change', e => {
      if (e.target.files.length) handlePartnerAUpload(e.target.files[0]);
    });
    guardDownload();
  });
}

// Keep normalize function from codex branch
const normalize = str => (str || '').trim()
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ')
  .toLowerCase();

// Keep __compatDump from main branch but using normalize above
if (typeof window !== 'undefined') {
  window.__compatDump = () => {
    console.log('Headers:', getHeaders());
    console.log('Row samples:', $all(`${CFG.tableContainer} tr`).slice(0, 5).map(r => ({
      label: normalize(r.dataset.key || r.cells[0]?.textContent || ''),
      dataKey: r.dataset.key || '',
      partnerA: r.querySelector(CFG.partnerACellSelector)?.textContent
    })));
  };
}

// Unified exports from both branches
export { ensurePartnerACol, handlePartnerAUpload, CFG };
export { normalizeSurvey, surveyToLookup };

