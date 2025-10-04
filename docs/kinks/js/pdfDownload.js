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
  return (
    (window.jspdf && window.jspdf.jsPDF) ||
    window.jsPDF ||
    (window.jsPDF && window.jsPDF.jsPDF)
  );
}

async function _ensurePdfLibs() {
  if (!_getJsPDF()) {
    const jspdfSources = [
      '/js/vendor/jspdf.umd.min.js',
      './js/vendor/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    ];
    for (const src of jspdfSources) {
      try {
        await _loadScript(src);
        if (_getJsPDF()) break;
      } catch {}
    }
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    window.jsPDF = window.jspdf.jsPDF; // expose for plugins
  }

  let hasAT =
    (window.jspdf && window.jspdf.autoTable) ||
    (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);
  if (!hasAT) {
    const autoTableSources = [
      '/js/vendor/jspdf.plugin.autotable.min.js',
      './js/vendor/jspdf.plugin.autotable.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
    ];
    for (const src of autoTableSources) {
      try {
        await _loadScript(src);
        hasAT =
          (window.jspdf && window.jspdf.autoTable) ||
          (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);
        if (hasAT) break;
      } catch {}
    }
  }

  if (!_getJsPDF()) throw new Error('jsPDF failed to load.');
}

// --- Extract rows from a <table> ---
function _extractRows() {
  const table =
    document.querySelector('#compatibilityTable') ||
    document.querySelector('table.results-table.compat') ||
    document.querySelector('table');
  if (!table) return [];

  const trs = [...table.querySelectorAll('tr')].filter(
    (tr) => tr.querySelectorAll('th').length === 0 && tr.querySelectorAll('td').length > 0
  );

  return trs.map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) =>
      (td.textContent || '')
        .replace(/\s+/g, ' ')
        .replace(/([A-Za-z]+)\s*\1/, '$1')
        .trim()
    );

    let category = cells[0] || '—';
    if (/^cum$/i.test(category)) category = 'Cum Play';

    const toNum = (v) => {
      const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const nums = cells.map(toNum).filter((n) => n !== null);

    // Section header: no numbers and only first cell has content
    if (nums.length === 0 && cells.slice(1).every((c) => !c)) {
      return { type: 'header', category };
    }

    const A = nums.length ? nums[0] : null;
    const B = nums.length > 1 ? nums[nums.length - 1] : null;

    let pct = cells.find((c) => /%$/.test(c)) || null;
    if (!pct && A != null && B != null) {
      const p = Math.round(100 - (Math.abs(A - B) / 5) * 100);
      pct = `${Math.max(0, Math.min(100, p))}%`;
    }

    return { type: 'row', category, A: A ?? '—', pct: pct ?? '—', B: B ?? '—' };
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
    console.warn('[pdf] No data rows found to export.');
    document
      .querySelectorAll('#downloadBtn, #downloadPdfBtn, [data-download-pdf]')
      .forEach(btn => _setBtnState(btn, false));
    return;
  }

  const body = [];
  const headers = [];
  rows.forEach(r => {
    if (r.type === 'header') {
      body.push([
        {
          content: r.category,
          colSpan: 4,
          styles: {
            fontStyle: 'bold',
            halign: 'left',
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255]
          }
        }
      ]);
      headers.push(r.category);
    } else {
      body.push([r.category, r.A, r.pct, r.B]);
    }
  });

  const JsPDF = _getJsPDF();
  const doc = new JsPDF({ orientation, unit: 'pt', format });

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

    // Fallback: simple manual table drawing when AutoTable is unavailable
    const { head, body, startY = 0, margin = {}, styles = {}, headStyles = {}, columnStyles = {}, tableLineColor = [0,0,0], tableLineWidth = 0.2, didDrawPage } = opts;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const top = margin.top || startY;
    const left = margin.left || 0;
    const bottom = margin.bottom || 0;
    const pad = styles.cellPadding || 6;
    const fontSize = styles.fontSize || 12;
    const lineH = fontSize * 1.15;
    const widths = head[0].map((_, i) => columnStyles[i]?.cellWidth || (pageW - left - (margin.right || 0)) / head[0].length);
    const aligns = head[0].map((_, i) => columnStyles[i]?.halign || 'left');
    let y = top;

    function drawRow(cells, isHead){
      let rowH = pad * 2;
      const lines = cells.map(txt => {
        const arr = String(txt).split('\n');
        rowH = Math.max(rowH, pad * 2 + arr.length * lineH);
        return arr;
      });
      if (y + rowH > pageH - bottom) {
        doc.addPage();
        if (typeof didDrawPage === 'function') didDrawPage(doc);
        y = top;
        if (!isHead) drawRow(head[0], true);
      }
      let x = left;
      for (let i = 0; i < cells.length; i++) {
        const w = widths[i];
        doc.setDrawColor(...tableLineColor);
        doc.setLineWidth(tableLineWidth);
        const fill = isHead ? (headStyles.fillColor || styles.fillColor) : styles.fillColor;
        const textCol = isHead ? (headStyles.textColor || styles.textColor) : styles.textColor;
        if (fill) doc.setFillColor(...fill);
        doc.rect(x, y, w, rowH, fill ? 'FD' : 'S');
        if (textCol) doc.setTextColor(...textCol);
        doc.setFontSize(fontSize);
        const halign = aligns[i];
        lines[i].forEach((line, idx) => {
          let tx = x + pad;
          if (halign === 'center') tx = x + w / 2;
          else if (halign === 'right') tx = x + w - pad;
          const ty = y + pad + lineH * (idx + 0.75);
          const opt = {};
          if (halign !== 'left') opt.align = halign;
          doc.text(String(line), tx, ty, opt);
        });
        x += w;
      }
      y += rowH;
    }

    drawRow(head[0], true);
    body.forEach(r => drawRow(r, false));
  };

  const originalAddPage = doc.addPage;
  doc.addPage = function patchedAddPage(...args) {
    const result = originalAddPage.apply(this, args);
    paintPage();
    return result;
  };

  try {
    runAutoTable({
      head: [['Category', 'Partner A', 'Match %', 'Partner B']],
      body,
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
      bodyStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255]
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
  } finally {
    doc.addPage = originalAddPage;
  }

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

  // Clear any inline onclick and intercept early to block previous handlers
  btn.onclick = null;
  btn.addEventListener('click', ev => {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    const ready = btn.getAttribute(READY_ATTR) === 'true';
    if (!ready) {
      console.warn('[pdf] Not ready: load both surveys before exporting.');
      return;
    }
    downloadCompatibilityPDF();
  }, true);

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
