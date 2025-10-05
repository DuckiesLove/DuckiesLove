// --- DROP-IN FIX: stop using html2canvas (the cause of earlier black PDFs) ---
// This generates the PDF directly with jsPDF + AutoTable from your DOM data.
// Output uses a DARK theme: black pages, white text, white table borders.

// USAGE:
// 1) Include this file after your table is rendered.
// 2) Call bindPdfButton() once (or let it auto-run at the bottom).
// 3) Make sure you have a Download button with id="downloadBtn" (or change the selector in bindPdfButton).

// If you were calling a previous function (e.g., downloadCompatibilityPDFCanvas),
// replace that call with: downloadCompatibilityPDF();

const CONSENT_IDS = {
  style: 'tk-consent-style',
  overlay: 'tk-consent-overlay',
  card: 'tk-consent-card',
  title: 'tk-consent-title',
  message: 'tk-consent-message',
  actions: 'tk-consent-actions',
  confirm: 'tk-consent-confirm',
  cancel: 'tk-consent-cancel'
};

const CONSENT_COPY = {
  title: 'Consent Check',
  message: 'Do you have your partner\'s consent to export or share this compatibility PDF?'
};

let _pendingConsent = null;

function _shouldBypassConsent(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  const doc = document;
  if (!doc || !doc.body || typeof doc.createElement !== 'function') return true;
  if (typeof doc.getElementById !== 'function' || typeof doc.addEventListener !== 'function') return true;
  try {
    const probe = doc.createElement('button');
    if (!probe) return true;
    if (typeof probe.addEventListener !== 'function') return true;
    if (typeof doc.body.appendChild !== 'function') return true;
  } catch (_) {
    return true;
  }
  return false;
}

function _injectConsentStyle(){
  if (_shouldBypassConsent()) return;
  const doc = document;
  if (doc.getElementById(CONSENT_IDS.style)) return;
  const style = doc.createElement('style');
  style.id = CONSENT_IDS.style;
  style.textContent = `
    #${CONSENT_IDS.overlay}{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:99999}
    #${CONSENT_IDS.card}{max-width:520px;width:90%;background:#111;color:#fff;border:1px solid #444;border-radius:10px;padding:18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    #${CONSENT_IDS.card} h3{margin:0 0 10px 0;font-size:18px}
    #${CONSENT_IDS.card} p{margin:0 0 12px 0;line-height:1.4}
    #${CONSENT_IDS.actions}{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
    .tk-btn{padding:8px 14px;border-radius:8px;border:1px solid #555;background:#1f1f1f;color:#fff;cursor:pointer}
    .tk-btn:hover{filter:brightness(1.15)}
    .tk-btn.primary{background:#2a7;border-color:#2a7}
  `;
  doc.head && doc.head.appendChild(style);
}

function _ensureConsentModal(){
  if (_shouldBypassConsent()) return null;
  _injectConsentStyle();
  const doc = document;
  let overlay = doc.getElementById(CONSENT_IDS.overlay);
  if (overlay) {
    return {
      overlay,
      card: doc.getElementById(CONSENT_IDS.card),
      titleEl: doc.getElementById(CONSENT_IDS.title),
      messageEl: doc.getElementById(CONSENT_IDS.message),
      confirmBtn: doc.getElementById(CONSENT_IDS.confirm),
      cancelBtn: doc.getElementById(CONSENT_IDS.cancel)
    };
  }

  overlay = doc.createElement('div');
  overlay.id = CONSENT_IDS.overlay;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.display = 'none';

  const card = doc.createElement('div');
  card.id = CONSENT_IDS.card;

  const titleEl = doc.createElement('h3');
  titleEl.id = CONSENT_IDS.title;
  titleEl.textContent = CONSENT_COPY.title;

  const messageEl = doc.createElement('p');
  messageEl.id = CONSENT_IDS.message;
  messageEl.textContent = CONSENT_COPY.message;

  const actions = doc.createElement('div');
  actions.id = CONSENT_IDS.actions;

  const cancelBtn = doc.createElement('button');
  cancelBtn.id = CONSENT_IDS.cancel;
  cancelBtn.className = 'tk-btn';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = doc.createElement('button');
  confirmBtn.id = CONSENT_IDS.confirm;
  confirmBtn.className = 'tk-btn primary';
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'I Confirm';

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);

  card.appendChild(titleEl);
  card.appendChild(messageEl);
  card.appendChild(actions);

  overlay.appendChild(card);
  (doc.body || doc.documentElement).appendChild(overlay);

  return { overlay, card, titleEl, messageEl, confirmBtn, cancelBtn };
}

function _requestConsent(){
  if (_shouldBypassConsent()) return Promise.resolve(true);
  if (_pendingConsent) return _pendingConsent;

  const modal = _ensureConsentModal();
  if (!modal) return Promise.resolve(true);

  const { overlay, titleEl, messageEl, confirmBtn, cancelBtn } = modal;
  if (!overlay || !confirmBtn || !cancelBtn) return Promise.resolve(true);

  titleEl && (titleEl.textContent = CONSENT_COPY.title);
  messageEl && (messageEl.textContent = CONSENT_COPY.message);

  overlay.style.display = 'flex';
  overlay.setAttribute('data-open', 'true');

  const doc = document;

  _pendingConsent = new Promise(resolve => {
    let done = false;
    const cleanup = (result) => {
      if (done) return;
      done = true;
      overlay.style.display = 'none';
      overlay.removeAttribute('data-open');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      doc.removeEventListener && doc.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (ev) => { if (ev.target === overlay) cleanup(false); };
    const onKey = (ev) => { if (ev.key === 'Escape') cleanup(false); };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    doc.addEventListener && doc.addEventListener('keydown', onKey);
  }).finally(() => {
    _pendingConsent = null;
  });

  confirmBtn.focus && confirmBtn.focus();

  return _pendingConsent;
}

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
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
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
  const consentGiven = await _requestConsent();
  if (!consentGiven) return;

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
  const bleed = 3;

  const paintPage = () => {
    if (typeof doc.setFillColor === 'function') doc.setFillColor(0, 0, 0);
    if (typeof doc.rect === 'function') doc.rect(-bleed, -bleed, pageW + bleed * 2, pageH + bleed * 2, 'F');
    if (typeof doc.setTextColor === 'function') doc.setTextColor(255, 255, 255);
    if (typeof doc.setDrawColor === 'function') doc.setDrawColor(0, 0, 0);
    if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0);
  };

  paintPage();

  if (typeof doc.setFont === 'function') {
    try {
      doc.setFont('helvetica', 'normal');
    } catch {}
  }

  // AutoTable (vector text; repaint each page background)
  const runAutoTable = (opts) => {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function') return window.jspdf.autoTable(doc, opts);

    // Fallback: simple manual table drawing when AutoTable is unavailable
    const {
      head,
      body,
      startY = 0,
      startX = 0,
      margin = {},
      styles = {},
      headStyles = {},
      columnStyles = {},
      tableLineColor = [0, 0, 0],
      tableLineWidth = 0.2,
      tableWidth,
      didDrawPage,
    } = opts;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginTop = typeof margin.top === 'number' ? margin.top : 0;
    const marginBottom = typeof margin.bottom === 'number' ? margin.bottom : 0;
    const marginLeft = typeof margin.left === 'number' ? margin.left : 0;
    const marginRight = typeof margin.right === 'number' ? margin.right : 0;
    const top = marginTop || startY;
    const left = marginLeft + startX;
    const bottom = marginBottom;
    const padRaw = styles.cellPadding ?? 6;
    const pad = typeof padRaw === 'number' ? padRaw : Math.max(0, padRaw.left ?? padRaw.right ?? padRaw.top ?? padRaw.bottom ?? 6);
    const fontSize = styles.fontSize || 12;
    const lineH = fontSize * 1.15;
    const totalWidth =
      typeof tableWidth === 'number'
        ? tableWidth
        : pageW - left - marginRight;
    const widths = head[0].map((_, i) => columnStyles[i]?.cellWidth || totalWidth / head[0].length);
    const aligns = head[0].map((_, i) => columnStyles[i]?.halign || styles.halign || 'left');
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
        else paintPage();
        y = top;
        if (!isHead) drawRow(head[0], true);
      }
      let x = left;
      for (let i = 0; i < cells.length; i++) {
        const w = widths[i];
        doc.setDrawColor(...tableLineColor);
        doc.setLineWidth(tableLineWidth);
        const fill = isHead ? (headStyles.fillColor ?? styles.fillColor) : styles.fillColor;
        const textCol = isHead ? (headStyles.textColor || styles.textColor) : styles.textColor;
        if (fill) {
          doc.setFillColor(...fill);
          doc.rect(x, y, w, rowH, 'F');
        }
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
    let primed = false;
    runAutoTable({
      head: [['Category', 'Partner A', 'Match %', 'Partner B']],
      body,
      startY: -bleed,
      startX: -bleed,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      tableWidth: pageW + bleed * 2,
      horizontalPageBreak: true,
      theme: 'plain',
      styles: {
        fontSize: 11,
        cellPadding: 8,
        textColor: [255, 255, 255],
        fillColor: null,
        lineColor: [0, 0, 0],
        lineWidth: 0,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        minCellHeight: 18
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: null,
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0,
        cellPadding: 10
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0,
      didAddPage: paintPage,
      willDrawCell: () => {
        if (!primed) {
          primed = true;
          if (typeof doc.setDrawColor === 'function') doc.setDrawColor(0, 0, 0);
          if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0);
        }
      }
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
