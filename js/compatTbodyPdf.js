/*
 * Self-healing compatibility report exporter.
 *
 * Guarantees that clicking a "Download PDF" button will generate a PDF of the
 * compatibility table even if libraries or DOM elements are missing initially.
 *
 * Features
 *  - Dynamically loads jsPDF and AutoTable if absent.
 *  - Builds rows from #compatTbody or from window.partnerAData/window.partnerBData.
 *  - Recomputes Match% and Flag icons (★ ⚑ 🚩).
 *  - Ensures a download button exists; creates one if not found.
 *  - Re-binds on DOM mutations for SPA-style pages.
 *  - Provides detailed console diagnostics.
 */
(function () {
  /* ---------------------------- 0. Dependencies ---------------------------- */
  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });

  async function ensureLibs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      );
      console.log('[PDF] jsPDF loaded');
    }

    const autoMissing = !(
      (window.jspdf && window.jspdf.autoTable) ||
      (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable)
    );
    if (autoMissing) {
      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
      );
      console.log('[PDF] AutoTable loaded');
    }
  }

  /* ---------------------------- 1. Data helpers ---------------------------- */
  const THRESH = Object.freeze({ star: 90, flag: 60, low: 30 });
  const ICON = Object.freeze({ star: '★', flag: '⚑', low: '🚩', blank: '' });

  const toNum = (v) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) ? n : null;
  };

  const pct = (a, b) => {
    const A = toNum(a);
    const B = toNum(b);
    if (A == null || B == null) return null;
    return Math.round(100 - (Math.abs(A - B) / 5) * 100);
  };

  const flagFor = (p) =>
    p == null
      ? ICON.blank
      : p >= THRESH.star
        ? ICON.star
        : p >= THRESH.flag
          ? ICON.flag
          : p <= THRESH.low
            ? ICON.low
            : ICON.blank;

  const detectScale = (arr) => {
    const vals = (arr || [])
      .map((x) => x?.score)
      .filter((x) => typeof x === 'number');
    if (!vals.length) return 1;
    const mx = Math.max(...vals), mn = Math.min(...vals);
    if (mx <= 5 && mn >= 0) return 1;
    if (mx <= 1 && mn >= 0) return 5;
    if (mx <= 7) return 5 / 7;
    if (mx <= 10) return 5 / 10;
    if (mx <= 100) return 5 / 100;
    return 5 / Math.max(5, mx);
  };

  /* ---------------------------- 2. Row builders --------------------------- */
  function rowsFromTbody() {
    const tbody = document.querySelector('#compatTbody');
    if (!tbody) {
      console.warn('[PDF] #compatTbody not found');
      return [];
    }

    const out = [];
    for (const tr of tbody.querySelectorAll('tr')) {
      const tds = tr.querySelectorAll('td');
      if (!tds.length) continue;
      const cat = tds[0]?.textContent?.trim() || tr.getAttribute('data-kink-id') || '';
      const aTxt =
        tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? '';
      const bTxt =
        tr.querySelector('td[data-cell="B"]')?.textContent ??
        tds[tds.length - 1]?.textContent ??
        '';
      const A = toNum(aTxt);
      const B = toNum(bTxt);
      const P = pct(A, B);
      out.push([cat || '—', A ?? '—', P == null ? '—' : `${P}%`, flagFor(P), B ?? '—']);
    }
    console.log(`[PDF] rowsFromTbody: ${out.length}`);
    return out;
  }

  function rowsFromMemory() {
    const A =
      window.partnerAData?.items ||
      (Array.isArray(window.partnerAData) ? window.partnerAData : null);
    const B =
      window.partnerBData?.items ||
      (Array.isArray(window.partnerBData) ? window.partnerBData : null);
    if (!A && !B) {
      console.warn('[PDF] partnerAData/partnerBData are missing');
      return [];
    }

    const sA = detectScale(A || []);
    const sB = detectScale(B || []);
    const mA = new Map((A || []).map((i) => [i.id || i.label, i]));
    const mB = new Map((B || []).map((i) => [i.id || i.label, i]));
    const union = new Map();
    (A || []).forEach((i) => union.set(i.id || i.label, i.label || i.id));
    (B || []).forEach((i) => union.set(i.id || i.label, i.label || i.id));

    const out = [];
    for (const [id, label] of union) {
      const a = mA.get(id);
      const b = mB.get(id);
      const Ar = typeof a?.score === 'number' ? a.score : null;
      const Br = typeof b?.score === 'number' ? b.score : null;
      const P = Ar == null || Br == null ? null : pct(Ar * sA, Br * sB);
      out.push([label || id || '—', Ar ?? '—', P == null ? '—' : `${P}%`, flagFor(P), Br ?? '—']);
    }
    console.log(`[PDF] rowsFromMemory: ${out.length}`);
    return out;
  }

  function gatherRows() {
    const fromTable = rowsFromTbody();
    return fromTable.length ? fromTable : rowsFromMemory();
  }

  /* --------------------------- 3. AutoTable glue --------------------------- */
  function runAutoTable(doc, opts) {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === 'function')
      return window.jspdf.autoTable(doc, opts);
    throw new Error('AutoTable not available');
  }

  /* ----------------------------- 4. Exporter ------------------------------- */
  async function exportPDF(ev) {
    ev?.preventDefault?.();
    try {
      await ensureLibs();

      const rows = gatherRows();
      console.log(`[PDF] rows to export: ${rows.length}`, rows[0]);
      if (!rows.length) {
        alert('No data rows found (table or memory). Load both surveys first.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(20);
      doc.text(
        'Talk Kink • Compatibility Report',
        doc.internal.pageSize.width / 2,
        48,
        { align: 'center' },
      );

      runAutoTable(doc, {
        head: [['Category', 'Partner A', 'Match', 'Flag', 'Partner B']],
        body: rows,
        startY: 70,
        styles: { fontSize: 11, cellPadding: 6, overflow: 'linebreak' },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'left', cellWidth: 560 },
          1: { halign: 'center', cellWidth: 80 },
          2: { halign: 'center', cellWidth: 90 },
          3: { halign: 'center', cellWidth: 60 },
          4: { halign: 'center', cellWidth: 80 },
        },
      });

      doc.save('compatibility-report.pdf');
    } catch (err) {
      console.error('[PDF] Export failed:', err);
      alert('PDF export failed: ' + err.message);
    }
  }

  /* ------------------------- 5. Button management ------------------------- */
  const BUTTON_SELECTORS = [
    '#downloadBtn',
    '#downloadPdfBtn',
    '[data-download-pdf]',
    'button[aria-label="Download PDF"]',
    'a[role="button"][href="#download-pdf"]',
  ];

  function ensureDownloadButton() {
    for (const sel of BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // No existing button — create one in bottom-right corner
    const btn = document.createElement('button');
    btn.id = 'downloadBtn';
    btn.textContent = 'Download Compatibility Report (PDF)';
    btn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999';
    document.body.appendChild(btn);
    console.warn('[PDF] No download button found; created one (#downloadBtn) in bottom-right.');
    return btn;
  }

  function bind() {
    const btn = ensureDownloadButton();
    btn.removeEventListener('click', exportPDF);
    btn.addEventListener('click', exportPDF);
    console.log('[PDF] Exporter bound to:', btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // Rebind on SPA re-renders
  const mo = new MutationObserver(() => bind());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Expose for manual triggering if needed
  window.downloadCompatibilityPDF = exportPDF;
})();

