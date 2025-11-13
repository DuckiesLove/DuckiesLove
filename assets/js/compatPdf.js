/**
 * TalkKink Compatibility PDF — legacy-left layout (title centered, table left-aligned)
 * Drop this whole file in as compatPdf.js (or paste into your existing file).
 * It defensively loads jsPDF + autoTable if missing, then renders the old-good layout.
 */

(() => {
  // ------------------------------
  // Config
  // ------------------------------
  const PDF_LAYOUT = 'legacy-left'; // 'legacy-left' | 'centered' (we want legacy-left)
  const LOCAL = {
    jspdf: [
      '/vendor/jspdf.umd.min.js',
      '/js/vendor/jspdf.umd.min.js',
      '/assets/js/vendor/jspdf.umd.min.js',
    ],
    autotable: [
      '/vendor/jspdf.plugin.autotable.min.js',
      '/js/vendor/jspdf.plugin.autotable.min.js',
      '/assets/js/vendor/jspdf.plugin.autotable.min.js',
    ],
  };
  const CDN = {
    jspdf: [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
    ],
    autotable: [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
      'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    ],
  };
  const SELECTORS = {
    downloadBtn: '#downloadPdfBtn', // change if your button has a different id
  };

  // Column model (letter landscape)
  const COLS = [
    { key: 'item',  header: 'Item',      w: 240 },
    { key: 'a',     header: 'Partner A', w:  80 },
    { key: 'match', header: 'Match',     w:  90 },
    { key: 'b',     header: 'Partner B', w:  90 },
    { key: 'flag',  header: 'Flag',      w:  60 },
  ];

  // ------------------------------
  // Script loaders (defensive)
  // ------------------------------
  function injectScriptOnce(src, dataKey) {
    return new Promise((resolve, reject) => {
      // Already present?
      if (dataKey) {
        const existing = document.querySelector(`script[data-lib="${dataKey}"]`);
        if (existing && existing.dataset.loaded === '1') return resolve();
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
          return;
        }
      }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      if (dataKey) s.dataset.lib = dataKey;
      s.defer = true;
      s.onload = () => { if (dataKey) s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => {
        // Remove failed tag so fallbacks can insert their own script element.
        try { s.remove(); } catch (_) {}
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(s);
    });
  }

  function jsPdfPresent() {
    return !!(window.jspdf && window.jspdf.jsPDF) || !!window.jsPDF;
  }

  function autoTablePresent(jsPDF) {
    const api =
      (jsPDF && jsPDF.API && (jsPDF.API.autoTable || jsPDF.API.__autoTable__)) ||
      (window.jsPDF && window.jsPDF.API && (window.jsPDF.API.autoTable || window.jsPDF.API.__autoTable__)) ||
      (window.jspdf && window.jspdf.autoTable);
    return !!api;
  }

  async function loadWithFallback(sources, dataKey) {
    let lastError = null;
    for (const src of sources) {
      try {
        await injectScriptOnce(src, dataKey);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;
  }

  async function ensureJsPDF() {
    if (jsPdfPresent()) {
      return window.jspdf?.jsPDF || window.jsPDF;
    }

    const attempts = [...LOCAL.jspdf, ...CDN.jspdf];
    try {
      await loadWithFallback(attempts, 'jspdf');
    } catch (err) {
      throw new Error(`jsPDF failed to load: ${err?.message || err}`);
    }

    if (!jsPdfPresent()) {
      throw new Error('jsPDF not available after local/CDN attempts');
    }

    return window.jspdf?.jsPDF || window.jsPDF;
  }

  async function ensureAutoTable(jsPDF) {
    // autoTable augments the jsPDF prototype; check presence
    if (autoTablePresent(jsPDF)) return true;

    const attempts = [...LOCAL.autotable, ...CDN.autotable];
    try {
      await loadWithFallback(attempts, 'jspdf-autotable');
    } catch (err) {
      throw new Error(`autoTable failed to load: ${err?.message || err}`);
    }

    return autoTablePresent(jsPDF);
  }

  let libsReadyPromise = null;

  function ensurePdfLibsReady() {
    if (!libsReadyPromise) {
      libsReadyPromise = (async () => {
        const jsPDF = await ensureJsPDF();
        const hasAutoTable = await ensureAutoTable(jsPDF).catch(() => false);

        try {
          const doc = new jsPDF();
          if (!doc) throw new Error('constructor returned undefined');
        } catch (err) {
          throw new Error(`jsPDF constructor test failed: ${err?.message || err}`);
        }

        return { jsPDF, hasAutoTable };
      })().catch(err => {
        libsReadyPromise = null;
        throw err;
      });
    }

    return libsReadyPromise;
  }

  // ------------------------------
  // Helpers
  // ------------------------------
  function mm(v) { return v; } // using 'pt' by default; keep as identity

  function truncateToWidth(doc, text, width) {
    if (!text) return '';
    if (doc.getTextWidth(String(text)) <= width) return String(text);
    const ell = '…';
    let s = String(text);
    while (s.length && doc.getTextWidth(s + ell) > width) s = s.slice(0, -1);
    return s + ell;
  }

  function centerText(doc, text, y, fontSize = 12, font = ['helvetica', 'bold']) {
    const [fam, style] = font;
    doc.setFont(fam, style);
    doc.setFontSize(fontSize);
    const pageW = doc.internal.pageSize.getWidth();
    const tw = doc.getTextWidth(text);
    doc.text(text, (pageW - tw) / 2, y);
  }

  // ------------------------------
  // Renderer (autoTable version — preferred)
  // ------------------------------
  function renderWithAutoTable(doc, rows) {
    // Page background (dark mode like your screenshot)
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);

    // Title (centered)
    centerText(doc, 'TalkKink Compatibility Report', 70, 32, ['helvetica', 'bold']);

    // Subtitle (centered)
    centerText(doc, 'Compatibility Overview', 110, 18, ['helvetica', 'bold']);

    // Prepare data for autoTable
    const columns = COLS.map((c, idx) => ({
      header: c.header,
      dataKey: String(idx),
    }));
    const body = rows.map(r => ([
      r.item ?? '',
      String(r.a ?? ''),
      String(r.match ?? ''),
      String(r.b ?? ''),
      String(r.flag ?? ''),
    ]));

    // Left align body; center the head; fixed widths to match legacy
    doc.autoTable({
      columns,
      body,
      startY: 140,
      margin: { left: 40, right: 40 },
      styles: {
        font: 'helvetica',
        fontSize: 11,
        halign: 'left',           // BODY LEFT
        valign: 'middle',
        cellPadding: 3,
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        lineColor: [160, 160, 160],
        lineWidth: 0.5,
      },
      headStyles: {
        halign: 'center',         // HEAD CENTER
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        lineColor: [160, 160, 160],
        lineWidth: 0.75,
      },
      columnStyles: {
        0: { cellWidth: COLS[0].w, halign: 'left' },
        1: { cellWidth: COLS[1].w, halign: 'left' },
        2: { cellWidth: COLS[2].w, halign: 'left' },
        3: { cellWidth: COLS[3].w, halign: 'left' },
        4: { cellWidth: COLS[4].w, halign: 'left' },
      },
      theme: 'grid',
      overflow: 'linebreak',      // wrap long items rather than expanding cells
      didParseCell: (data) => {
        // Ensure legacy-left: if some global default tries to center, we override
        if (data.section === 'body') data.cell.styles.halign = 'left';
      },
      didDrawPage: () => {
        // Ensure fonts/colors persist after headers
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
      },
    });
  }

  // ------------------------------
  // Renderer (fallback if autoTable missing)
  // ------------------------------
  function renderFallback(doc, rows) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 40;
    const startY = 140;

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);

    centerText(doc, 'TalkKink Compatibility Report', 70, 32, ['helvetica', 'bold']);
    centerText(doc, 'Compatibility Overview', 110, 18, ['helvetica', 'bold']);

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    let x = marginL;
    const headers = COLS.map(c => c.header);
    headers.forEach((h, i) => {
      doc.text(h, x, startY);
      x += COLS[i].w;
    });

    // Body
    doc.setFont('helvetica', 'normal');
    let y = startY + 18;
    rows.forEach(r => {
      x = marginL;
      const vals = [r.item ?? '', String(r.a ?? ''), String(r.match ?? ''), String(r.b ?? ''), String(r.flag ?? '')];
      vals.forEach((v, i) => {
        const txt = truncateToWidth(doc, v, COLS[i].w - 6);
        doc.text(txt, x, y);
        x += COLS[i].w;
      });
      y += 16;
    });

    // Border around table
    const tableW = COLS.reduce((sum, c) => sum + c.w, 0);
    const rowsCount = rows.length;
    const tableH = (rowsCount + 2) * 16; // rough height
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.75);
    doc.rect(marginL - 6, startY - 26, tableW + 12, Math.max(60, tableH), 'S');
  }

  // ------------------------------
  // Public: generate + download
  // ------------------------------
  async function generateCompatibilityPDF(rows) {
    const { jsPDF, hasAutoTable } = await ensurePdfLibsReady();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

    // Choose the left-aligned legacy look
    if (PDF_LAYOUT !== 'legacy-left') {
      // (Optional: add centered logic if you ever need it again)
    }

    const hasAT = hasAutoTable;
    if (hasAT) {
      renderWithAutoTable(doc, rows);
    } else {
      // Fallback table drawing if autoTable couldn't be loaded
      renderFallback(doc, rows);
    }

    doc.save('compatibility.pdf');
  }

  // ------------------------------
  // Wire up button (optional)
  // ------------------------------
  function setupButton() {
    const btn = document.querySelector(SELECTORS.downloadBtn);
    if (!btn) return;

    // Disable until libs are ready
    btn.disabled = true;

    ensurePdfLibsReady()
      .then(() => {
        btn.disabled = false;
      })
      .catch(err => {
        console.error('[compat-pdf] PDF libs unavailable', err);
        btn.disabled = true;
        btn.title = 'PDF temporarily unavailable (libs failed to load)';
      });

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Ensure libs ready (caches after first pass)
        await ensurePdfLibsReady();

        // You likely already have your processed rows ready.
        // Example stub (replace with your real rows):
        const rows = window.talkkinkCompatRows || [
          { item: 'Giving: General', a: 0, match: '100%', b: 0, flag: '+P' },
          { item: 'Receiving: Service', a: 5, match: '100%', b: 5, flag: '+P' },
          // ...etc
        ];
        await generateCompatibilityPDF(rows);
      } catch (err) {
        console.error('[compat-pdf] Failed to generate compatibility PDF', err);
      }
    });
  }

  // Expose a direct API too (so you can call from elsewhere)
  window.TKCompatPDF = {
    download: generateCompatibilityPDF,
    ensureLibs: ensurePdfLibsReady,
  };

  // Auto-init when DOM ready (safe if button not present)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButton, { once: true });
  } else {
    setupButton();
  }
})();

