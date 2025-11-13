/**
 * TalkKink Compatibility PDF — legacy-left layout (title centered, table left-aligned)
 * Defensive loader that auto-enables the download button when the table rows + libs are ready.
 */

(() => {
  const CFG = {
    pdfKillSwitch: false,
    selectors: { downloadBtn: '#downloadPdfBtn' },
    columns: [
      { key: 'item', header: 'Item', w: 240 },
      { key: 'a', header: 'Partner A', w: 80 },
      { key: 'match', header: 'Match', w: 90 },
      { key: 'b', header: 'Partner B', w: 90 },
      { key: 'flag', header: 'Flag', w: 60 },
    ],
    local: {
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
    },
    cdn: {
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
    },
  };

  console.info('[compat] kill-switch ' + (CFG.pdfKillSwitch ? 'enabled' : 'disabled'));

  let libsReady = false;
  let libsReadyPromise = null;
  let rowsReady = false;
  let cachedRows = [];
  let enablingErrored = false;

  function injectScriptOnce(src, dataKey) {
    return new Promise((resolve, reject) => {
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
      s.onload = () => {
        if (dataKey) s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => {
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

  async function ensureJsPDF() {
    if (jsPdfPresent()) {
      return window.jspdf?.jsPDF || window.jsPDF;
    }

    const attempts = [...CFG.local.jspdf, ...CFG.cdn.jspdf];
    for (const src of attempts) {
      try {
        await injectScriptOnce(src, 'jspdf');
        if (jsPdfPresent()) break;
      } catch (err) {
        console.warn('[compat-pdf] jsPDF load failed for', src, err);
      }
    }

    if (!jsPdfPresent()) {
      throw new Error('jsPDF not available after local/CDN attempts');
    }

    return window.jspdf?.jsPDF || window.jsPDF;
  }

  async function ensureAutoTable(jsPDF) {
    if (autoTablePresent(jsPDF)) return true;

    const attempts = [...CFG.local.autotable, ...CFG.cdn.autotable];
    for (const src of attempts) {
      try {
        await injectScriptOnce(src, 'jspdf-autotable');
        if (autoTablePresent(jsPDF)) return true;
      } catch (err) {
        console.warn('[compat-pdf] autoTable load failed for', src, err);
      }
    }

    return autoTablePresent(jsPDF);
  }

  function ensurePdfLibsReady() {
    if (!libsReadyPromise) {
      libsReadyPromise = (async () => {
        const jsPDF = await ensureJsPDF();
        const hasAutoTable = await ensureAutoTable(jsPDF).catch(() => false);

        try {
          const doc = new jsPDF({ unit: 'pt' });
          if (!doc) throw new Error('constructor returned undefined');
        } catch (err) {
          throw new Error(`jsPDF constructor test failed: ${err?.message || err}`);
        }

        libsReady = true;
        enablingErrored = false;
        setButtonState();

        return { jsPDF, hasAutoTable };
      })().catch(err => {
        libsReady = false;
        enablingErrored = true;
        libsReadyPromise = null;
        setButtonState();
        throw err;
      });
    }

    return libsReadyPromise;
  }

  function centerText(doc, text, y, fontSize = 12, font = ['helvetica', 'bold']) {
    const [fam, style] = font;
    doc.setFont(fam, style);
    doc.setFontSize(fontSize);
    const pageW = doc.internal.pageSize.getWidth();
    const tw = doc.getTextWidth(text);
    doc.text(text, (pageW - tw) / 2, y);
  }

  function truncateToWidth(doc, text, width) {
    if (!text) return '';
    const s = String(text);
    if (doc.getTextWidth(s) <= width) return s;
    const ell = '…';
    let out = s;
    while (out.length && doc.getTextWidth(out + ell) > width) out = out.slice(0, -1);
    return out + ell;
  }

  function renderWithAutoTable(doc, rows) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);

    centerText(doc, 'TalkKink Compatibility Report', 70, 32, ['helvetica', 'bold']);
    centerText(doc, 'Compatibility Overview', 110, 18, ['helvetica', 'bold']);

    const columns = CFG.columns.map((c, idx) => ({ header: c.header, dataKey: String(idx) }));
    const body = rows.map(r => ([
      r.item ?? r.label ?? '',
      String(r.a ?? r.partnerA ?? ''),
      String(r.match ?? r.matchPct ?? r.matchText ?? ''),
      String(r.b ?? r.partnerB ?? ''),
      String(r.flag ?? r.flagIcon ?? ''),
    ]));

    doc.autoTable({
      columns,
      body,
      startY: 140,
      margin: { left: 40, right: 40 },
      styles: {
        font: 'helvetica',
        fontSize: 11,
        halign: 'left',
        valign: 'middle',
        cellPadding: 3,
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        lineColor: [160, 160, 160],
        lineWidth: 0.5,
      },
      headStyles: {
        halign: 'center',
        fontStyle: 'bold',
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        lineColor: [160, 160, 160],
        lineWidth: 0.75,
      },
      columnStyles: {
        0: { cellWidth: CFG.columns[0].w, halign: 'left' },
        1: { cellWidth: CFG.columns[1].w, halign: 'left' },
        2: { cellWidth: CFG.columns[2].w, halign: 'left' },
        3: { cellWidth: CFG.columns[3].w, halign: 'left' },
        4: { cellWidth: CFG.columns[4].w, halign: 'left' },
      },
      theme: 'grid',
      overflow: 'linebreak',
      didParseCell: (data) => {
        if (data.section === 'body') data.cell.styles.halign = 'left';
      },
      didDrawPage: () => {
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
      },
    });
  }

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    let x = marginL;
    CFG.columns.forEach((c) => {
      doc.text(c.header, x, startY);
      x += c.w;
    });

    doc.setFont('helvetica', 'normal');
    let y = startY + 18;
    rows.forEach((r) => {
      x = marginL;
      const values = [
        r.item ?? r.label ?? '',
        String(r.a ?? r.partnerA ?? ''),
        String(r.match ?? r.matchPct ?? r.matchText ?? ''),
        String(r.b ?? r.partnerB ?? ''),
        String(r.flag ?? r.flagIcon ?? ''),
      ];
      values.forEach((val, i) => {
        const txt = truncateToWidth(doc, val, CFG.columns[i].w - 6);
        doc.text(txt, x, y);
        x += CFG.columns[i].w;
      });
      y += 16;
    });

    const tableW = CFG.columns.reduce((sum, c) => sum + c.w, 0);
    const tableH = Math.max(60, (rows.length + 2) * 16);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.75);
    doc.rect(marginL - 6, startY - 26, tableW + 12, tableH, 'S');
  }

  async function generateCompatibilityPDF(rows) {
    const data = Array.isArray(rows) ? rows : [];
    const payload = data.length ? data : computeRowsArray();
    if (!payload.length) {
      throw new Error('No compatibility rows available');
    }

    const { jsPDF, hasAutoTable } = await ensurePdfLibsReady();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

    if (hasAutoTable && typeof doc.autoTable === 'function') {
      renderWithAutoTable(doc, payload);
    } else {
      renderFallback(doc, payload);
    }

    doc.save('compatibility.pdf');
  }

  function getBtn() {
    return document.querySelector(CFG.selectors.downloadBtn);
  }

  function computeRowsArray() {
    if (Array.isArray(cachedRows) && cachedRows.length) return cachedRows;
    const winRows = Array.isArray(window.talkkinkCompatRows) ? window.talkkinkCompatRows : [];
    return Array.isArray(winRows) ? winRows : [];
  }

  function computeRowsReady() {
    return computeRowsArray().length > 0;
  }

  function setCachedRows(rows) {
    cachedRows = Array.isArray(rows) ? rows.slice() : [];
    rowsReady = computeRowsReady();
  }

  function readRowsFromStorage() {
    const current = computeRowsArray();
    if (current.length) return current;
    try {
      const raw = localStorage.getItem('talkkink:compatRows');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[compat-pdf] Failed to read cached compatibility rows', err);
      return [];
    }
  }

  function setButtonState() {
    const btn = getBtn();
    if (!btn) return;

    rowsReady = computeRowsReady();
    const canEnable = !CFG.pdfKillSwitch && libsReady && rowsReady && !enablingErrored;
    btn.disabled = !canEnable;

    if (!canEnable) {
      const reasons = [];
      if (CFG.pdfKillSwitch) reasons.push('Kill switch active');
      if (enablingErrored) reasons.push('PDF libraries failed to load');
      if (!libsReady && !enablingErrored) reasons.push('PDF libs not ready');
      if (!rowsReady) reasons.push('Upload both surveys to compare');
      btn.title = 'PDF unavailable: ' + (reasons.join(' · ') || 'unknown');
    } else {
      btn.title = 'Download your compatibility PDF';
    }
  }

  function demoRows() {
    return [
      { item: 'Giving: General', a: 3, match: '100%', b: 3, flag: '+P' },
      { item: 'Receiving: Service', a: 5, match: '100%', b: 5, flag: '⭐' },
      { item: 'Rituals', a: 4, match: '100%', b: 4, flag: '' },
    ];
  }

  function wireClick() {
    const btn = getBtn();
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      const force = e.altKey === true;
      if (btn.disabled && !force) return;
      e.preventDefault();

      try {
        if (!libsReady) await ensurePdfLibsReady();
        let rows = computeRowsArray();
        if (!rows.length) {
          rows = readRowsFromStorage();
          if (rows.length) setCachedRows(rows);
        }
        if (!rows.length && !force) {
          alert('Upload both surveys first.');
          return;
        }
        await generateCompatibilityPDF(rows.length ? rows : demoRows());
      } catch (err) {
        console.error('[compat-pdf] generation failed', err);
        enablingErrored = true;
        setButtonState();
        alert('PDF could not be generated. See console for details.');
      }
    });
  }

  async function generateFromStorage() {
    const rows = readRowsFromStorage();
    if (!rows.length) {
      alert('Upload both surveys first.');
      return;
    }
    setCachedRows(rows);
    await generateCompatibilityPDF(rows);
  }

  function init() {
    const btn = getBtn();
    if (btn) btn.disabled = true;

    if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
      setCachedRows(window.talkkinkCompatRows.slice());
    }

    wireClick();
    setButtonState();

    ensurePdfLibsReady().catch(err => {
      console.error('[compat-pdf] libs failed to load', err);
    });
  }

  window.TKCompatPDF = {
    notifyRowsUpdated(rows) {
      setCachedRows(Array.isArray(rows) ? rows : []);
      setButtonState();
    },
    download(rows) {
      if (Array.isArray(rows) && rows.length) {
        setCachedRows(rows);
      }
      return generateCompatibilityPDF(rows);
    },
    generateFromStorage,
    ensureLibs: ensurePdfLibsReady,
    _forceEnable() {
      libsReady = true;
      rowsReady = true;
      enablingErrored = false;
      CFG.pdfKillSwitch = false;
      setButtonState();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* ========= TALK KINK PDF: CDN-ONLY OVERRIDE (kills /vendor 404s) ========= */
/* Drop this at the bottom of compatPdf.js (or include after it on the page). */

(function () {
  const CDN = {
    JSPDF: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    AUTOTABLE: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  };

  // 1) Kill any old local-first loaders so they cannot request /vendor/...
  window.tkLoadPdfLibs = undefined;
  window.ensurePdfLibs = undefined;

  // 2) Simple CDN injector
  function inject(src, key) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-lib="${key}"]`);
      if (existing && existing.dataset.loaded === '1') return resolve();

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`load fail ${src}`)), { once: true });
      } else {
        const s = document.createElement('script');
        s.src = src;
        s.defer = true;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.dataset.lib = key;
        s.onload = () => { s.dataset.loaded = '1'; resolve(); };
        s.onerror = () => reject(new Error(`load fail ${src}`));
        document.head.appendChild(s);
      }
    });
  }

  const jsPdfPresent = () => !!(window.jspdf && window.jspdf.jsPDF) || !!window.jsPDF;
  const autoTablePresent = () => {
    const api = (window.jspdf?.jsPDF?.API) || (window.jsPDF?.API);
    return !!(api && (api.autoTable || api.__autoTable__));
  };

  // 3) New ensurePdfLibs that ONLY uses CDN
  async function ensurePdfLibsCDN() {
    if (!jsPdfPresent()) await inject(CDN.JSPDF, 'jspdf');
    if (!jsPdfPresent()) throw new Error('jsPDF not available');

    if (!autoTablePresent()) await inject(CDN.AUTOTABLE, 'jspdf-autotable');
    if (!autoTablePresent()) throw new Error('autoTable not available');

    return (window.jspdf?.jsPDF) || window.jsPDF;
  }

  // 4) Replace any click handlers that depended on the old ensurePdfLibs
  //    Keep your existing generateCompatibilityPDF(rows) function.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#downloadPdfBtn');
    if (!btn) return;
    e.preventDefault();

    try {
      await ensurePdfLibsCDN(); // guarantee libs from CDN
      const rows = window.talkkinkCompatRows || [];
      if (!rows.length) {
        alert('Upload both surveys first.');
        return;
      }
      if (window.TKCompatPDF?.download) {
        await window.TKCompatPDF.download(rows);
      } else if (window.generateCompatibilityPDF) {
        await window.generateCompatibilityPDF(rows);
      } else {
        console.warn('[compat-pdf] No generator found. Define TKCompatPDF.download or generateCompatibilityPDF(rows).');
      }
    } catch (err) {
      console.error('[compat-pdf] PDF generation failed', err);
      alert('PDF could not be generated. See console for details.');
    }
  });

  // 5) Optional: enable button once libs load (prevents greyed-out state)
  (async () => {
    const btn = document.querySelector('#downloadPdfBtn');
    if (!btn) return;
    btn.disabled = true;
    try {
      await ensurePdfLibsCDN();
      btn.disabled = false;
      btn.title = 'Download your compatibility PDF';
    } catch (e) {
      btn.disabled = true;
      btn.title = 'PDF unavailable (library load failed)';
    }
  })();

  // Expose, in case other code wants to call it
  window.ensurePdfLibsCDN = ensurePdfLibsCDN;
})();
