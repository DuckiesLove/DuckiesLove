// Partner A Loader: attaches JSON upload handler and PDF download guard
// Auto-generated based on provided snippet.

const CFG = {
  uploadSelector: '#uploadSurveyA, [data-upload-a]',
  downloadSelector: '#downloadBtn',
  tableContainer: '#pdf-container',
  partnerACellSelector: 'td.pa',
  createMissingPartnerACol: false,
  partnerAHeaderText: 'Partner A'
};

const $one = (sel, ctx = document) => ctx.querySelector(sel);
const $all = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const normalize = str => (str || '').trim()
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ').toLowerCase();
window.__compatDump = () => {
  console.log('Headers:', getHeaders());
  console.log('Row samples:', $all(`${CFG.tableContainer} tr`).slice(0, 5).map(r => ({
    label: normalize(r.dataset.key || r.cells[0]?.textContent || ''),
    dataKey: r.dataset.key || '',
    partnerA: r.querySelector(CFG.partnerACellSelector)?.textContent
  })));
};

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

async function handlePartnerAUpload(file) {
  const json = await file.text();
  let parsed = {};
  try { parsed = JSON.parse(json); } catch (e) { alert('Invalid JSON'); return; }
  const normalized = {};
  Object.keys(parsed).forEach(k => { normalized[normalize(k)] = parsed[k]; });
  window.partnerASurvey = window.surveyA = normalized;
  if (typeof updateComparison === 'function') updateComparison();
  ensurePartnerACol();
  setTimeout(() => {
    const matched = fillPartnerA(normalized);
    if (!matched) {
      alert(`Partner A did not appear in the table.\n\nCheck that:\n• Rows have a data-key/data-id, or the first column matches your JSON keys\n• Table has td.pa cells OR a header named "${CFG.partnerAHeaderText}"\n• updateComparison() writes Partner A values`);
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
    const up = $one(CFG.uploadSelector);
    if (up) up.addEventListener('change', e => {
      if (e.target.files.length) handlePartnerAUpload(e.target.files[0]);
    });
    guardDownload();
  });
}

export {}; // ensure module context
