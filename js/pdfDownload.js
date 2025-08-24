// --- DROP-IN FIX: stop using html2canvas (the cause of earlier black PDFs) ---
// This generates the PDF directly with jsPDF + AutoTable from your DOM data.
// Output uses a DARK theme: black pages, white text, white table borders.

// USAGE:
// 1) Include this file after your table is rendered.
// 2) Call bindPdfButton() once (or let it auto-run at the bottom).
// 3) Make sure you have a Download button with id="downloadBtn" (or change the selector in bindPdfButton).

// If you were calling a previous function (e.g., downloadCompatibilityPDFCanvas),
// replace that call with: downloadCompatibilityPDF();

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function _getJsPDF() {
  return (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
}

async function _ensurePdfLibs() {
  if (!_getJsPDF()) {
    try { await _loadScript('/lib/jspdf.umd.min.js'); }
    catch { await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
  }
  const hasAT =
    (window.jspdf && window.jspdf.autoTable) ||
    (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);
  if (!hasAT) {
    try { await _loadScript('/lib/jspdf.plugin.autotable.min.js'); }
    catch { await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js'); }
  }
  if (!_getJsPDF()) throw new Error('jsPDF failed to load.');
}

// --- Helpers to read your table/div rows without html2canvas ---
function _tidy(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
function _toNum(v) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function _clampTwoLines(s, perLine = 60) {
  const t = _tidy(s);
  if (!t) return '—';
  if (t.length <= perLine) return t;
  const first = t.slice(0, perLine).trim();
  const rest  = t.slice(perLine).trim();
  const second = rest.length > perLine ? (rest.slice(0, perLine - 1).trim() + '…') : rest;
  return first + '\n' + second;
}

/**
 * Extract rows from either a real <table> or div-based “rows”.
 * Returns array of [Category, Partner A, Match %, Partner B]
 */
function _extractRows() {
  // Prefer a real table if present
  const table =
    document.querySelector('#compatibilityTable') ||
    document.querySelector('table.results-table.compat') ||
    document.querySelector('table');

  let rows = [];
  if (table) {
    const trs = [...table.querySelectorAll('tr')].filter(tr => tr.querySelectorAll('th').length === 0 && tr.querySelectorAll('td').length > 0);
    rows = trs.map(tr => [...tr.querySelectorAll('td')].map(td => _tidy(td.textContent)));
  } else {
    // Fallback for non-table layouts (adjust selector if needed)
    rows = [...document.querySelectorAll('.results-table.compat .row')]
      .map(r => [...r.children].map(c => _tidy(c.textContent)));
  }

  return rows.map(cells => {
    const category = cells[0] || '—';
    const nums = cells.map(_toNum).filter(n => n !== null);
    const a = nums.length ? nums[0] : null;
    const b = nums.length ? nums[nums.length - 1] : null;

    // Use existing % cell if present, else compute from A/B (0–5 scale)
    let match = cells.find(c => /%$/.test(c)) || null;
    if (!match && a !== null && b !== null) {
      const pct = Math.round(100 - (Math.abs(a - b) / 5) * 100);
      match = `${Math.max(0, Math.min(100, pct))}%`;
    }
    return [_clampTwoLines(category, 60), a ?? '—', match ?? '—', b ?? '—'];
  });
}

  // --- Main export (dark pages rendered via jsPDF/AutoTable) ---
export async function downloadCompatibilityPDF({
  filename = 'compatibility-report.pdf',
  orientation = 'landscape',
  format = 'a4'
} = {}) {
  await _ensurePdfLibs();

  const rows = _extractRows();
  if (!rows.length) {
    alert('No data rows found to export.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation, unit: 'pt', format });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const paintPage = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);
  };

  paintPage();

  // Title
  doc.setFontSize(28);
  doc.text('Talk Kink • Compatibility Report', pageW / 2, 48, { align: 'center' });

  // AutoTable (vector text; repaint each page background)
  const runAutoTable = (opts) => {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') return window.jspdf.autoTable(doc, opts);
    throw new Error('jsPDF-AutoTable not available');
  };

  runAutoTable({
    head: [['Category', 'Partner A', 'Match %', 'Partner B']],
    body: rows,
    startY: 70,
    margin: { left: 30, right: 30, top: 70, bottom: 40 },
    styles: {
      fontSize: 12,
      cellPadding: 6,
      textColor: [255, 255, 255],
      fillColor: [0, 0, 0],
      lineColor: [255, 255, 255],
      lineWidth: 0.25,
      overflow: 'linebreak'
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      lineColor: [255, 255, 255],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 520, halign: 'left'   }, // Category
      1: { cellWidth:  80, halign: 'center' }, // Partner A
      2: { cellWidth:  90, halign: 'center' }, // Match %
      3: { cellWidth:  80, halign: 'center' }  // Partner B
    },
    tableLineColor: [255, 255, 255],
    tableLineWidth: 0.5,
    didDrawPage: paintPage,
    tableWidth: 'wrap'
  });

  doc.save(filename);
}

// --- Bind your existing Download button (optional auto-bind) ---
const BTN_SELECTORS = ['#downloadBtn', '#downloadPdfBtn', '[data-download-pdf]'];
const READY_ATTR = 'data-pdf-ready';
const BOUND_ATTR = 'data-pdf-bound';

const _isNum = s => Number.isFinite(Number(String(s || '').trim()));

function _countPartnerCells(){
  const rows = document.querySelectorAll(
    '#compatibilityTable tbody tr, table.results-table.compat tbody tr, table tbody tr'
  );
  let aCount = 0, bCount = 0;
  rows.forEach(tr => {
    const aCell = tr.querySelector('td[data-cell="A"]');
    const bCell = tr.querySelector('td[data-cell="B"]');
    const tds = tr.querySelectorAll('td');
    const aVal = aCell ? aCell.textContent : tds[1]?.textContent;
    const bVal = bCell ? bCell.textContent : tds[tds.length - 1]?.textContent;
    if (_isNum(aVal)) aCount++;
    if (_isNum(bVal)) bCount++;
  });
  return { aCount, bCount };
}

function _setBtnState(btn, ready){
  btn.toggleAttribute('disabled', !ready);
  btn.setAttribute(READY_ATTR, ready ? 'true' : 'false');
  btn.setAttribute('aria-disabled', String(!ready));
  btn.title = ready ? 'Download PDF' : 'Load both surveys to enable';
}

export function bindPdfButton() {
  const btn = BTN_SELECTORS.map(sel => document.querySelector(sel)).find(Boolean);
  if (!btn || btn.hasAttribute(BOUND_ATTR)) return;

  btn.addEventListener('click', ev => {
    const ready = btn.getAttribute(READY_ATTR) === 'true';
    if (!ready) {
      ev.preventDefault();
      console.warn('[pdf] Not ready: load both surveys before exporting.');
      return;
    }
    downloadCompatibilityPDF();
  });

  btn.setAttribute(BOUND_ATTR, 'true');

  let pollTimer = null;
  const checkAndUpdate = () => {
    const { aCount, bCount } = _countPartnerCells();
    const ready = aCount > 0 && bCount > 0 && aCount === bCount;
    _setBtnState(btn, ready);
  };

  const mo = new MutationObserver(() => {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(checkAndUpdate, 150);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  checkAndUpdate();
}

// Expose for non-module usage
if (typeof window !== 'undefined') {
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
}

// Auto-bind if the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindPdfButton);
} else {
  bindPdfButton();
}
