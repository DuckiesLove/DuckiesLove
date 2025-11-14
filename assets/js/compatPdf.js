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

  const TK_ACCENT = [0, 214, 199];

  function safeString(val) {
    if (val == null) return '';
    const str = String(val).trim();
    return (str === 'null' || str === 'undefined') ? '' : str;
  }

  function coerceScore(val) {
    if (val == null || (typeof val === 'string' && !val.trim())) return null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const parsed = Number(String(val).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
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

  function normalizeCompatRow(row) {
    let item;
    let aRaw;
    let bRaw;
    let matchRaw;

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
    const matchDisplay = matchPercent != null ? `${matchPercent}%` : safeString(matchRaw);
    const status = tk_flagStatus(aScore, bScore, matchPercent);

    return {
      item: safeString(item),
      a: aScore != null ? String(aScore) : safeString(aRaw),
      match: matchDisplay,
      flag: status,
      b: bScore != null ? String(bScore) : safeString(bRaw),
      matchPercent,
      aScore,
      bScore,
    };
  }

  function tk_drawHeader(doc, title, generatedAt, accent = TK_ACCENT) {
    const pageW = doc.internal.pageSize.getWidth();

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    const tW = doc.getTextWidth(title);
    doc.text(title, (pageW - tW) / 2, 80);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const sub = `Generated: ${generatedAt}`;
    const sW = doc.getTextWidth(sub);
    doc.text(sub, (pageW - sW) / 2, 104);

    doc.setDrawColor(...accent);
    doc.setLineWidth(2.5);
    const pad = 84;
    doc.line(pad, 118, pageW - pad, 118);

    return 118 + 36;
  }

  function tk_flagStatus(a, b, matchPercent) {
    const pct = Number.isFinite(matchPercent) ? matchPercent : Number(matchPercent);
    if (Number.isFinite(pct) && pct >= 90) return 'star';
    if (Number.isFinite(pct) && pct <= 30) return 'red';

    const aNum = Number.isFinite(a) ? a : Number(a);
    const bNum = Number.isFinite(b) ? b : Number(b);
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) return '';

    const oneIsFive = aNum === 5 || bNum === 5;
    if (oneIsFive && Math.abs(aNum - bNum) >= 1) return 'warn';
    return '';
  }

  function tk_drawFlagMarker(doc, data, status) {
    if (!status) return;

    const { x, y, height, width } = data.cell;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) * 0.22;

    const fill = (r, g, b) => doc.setFillColor(r, g, b);

    if (status === 'star') {
      fill(...TK_ACCENT);
      doc.setLineWidth(0);

      const spikes = 5;
      const outerR = r * 1.15;
      const innerR = r * 0.5;
      let rot = Math.PI * 1.5;
      const step = Math.PI / spikes;

      doc.beginPath();
      doc.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        doc.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        doc.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
      }
      doc.lineTo(cx, cy - outerR);
      if (typeof doc.closePath === 'function') doc.closePath();
      doc.fill();
      return;
    }

    if (status === 'warn') {
      fill(255, 204, 0);
      doc.setLineWidth(0);
      doc.beginPath();
      doc.moveTo(cx, cy - r);
      doc.lineTo(cx + r, cy);
      doc.lineTo(cx, cy + r);
      doc.lineTo(cx - r, cy);
      if (typeof doc.closePath === 'function') doc.closePath();
      doc.fill();
      return;
    }

    if (status === 'red') {
      fill(255, 66, 66);
      doc.setLineWidth(0);
      doc.circle(cx, cy, r, 'F');
    }
  }

  function tk_renderSectionTable(doc, sectionTitle, rows, startY) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    const pageW = doc.internal.pageSize.getWidth();
    const titleW = doc.getTextWidth(sectionTitle);
    doc.text(sectionTitle, (pageW - titleW) / 2, startY);

    const body = rows.map((r) => {
      const coerce = (val) => {
        const num = Number(val);
        return Number.isFinite(num) ? num : null;
      };
      const aNum = coerce(r.a);
      const bNum = coerce(r.b);
      const mNum = coerce(r.matchPercent);
      const matchDisplay =
        Number.isFinite(mNum) && mNum != null ? `${Math.round(mNum)}%` : r.match;
      return {
        item: r.item,
        a: aNum != null ? String(aNum) : r.a,
        match: matchDisplay,
        flag: tk_flagStatus(aNum, bNum, mNum),
        b: bNum != null ? String(bNum) : r.b,
      };
    });

    const columns = [
      { header: 'Item', dataKey: 'item' },
      { header: 'Partner A', dataKey: 'a' },
      { header: 'Match', dataKey: 'match' },
      { header: 'Flag', dataKey: 'flag' },
      { header: 'Partner B', dataKey: 'b' },
    ];

    doc.autoTable({
      columns,
      body,
      startY: startY + 24,
      margin: { left: 70, right: 70 },
      styles: {
        font: 'helvetica',
        fontSize: 12,
        halign: 'left',
        valign: 'middle',
        minCellHeight: 20,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        textColor: [230, 230, 230],
        fillColor: [25, 25, 28],
        lineColor: [30, 255, 255],
        lineWidth: 1.2,
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [0, 255, 245],
        fillColor: [28, 28, 32],
        lineColor: [40, 40, 45],
        lineWidth: 1.4,
        halign: 'center',
      },
      columnStyles: {
        item: { cellWidth: 320, halign: 'left' },
        a: { cellWidth: 80, halign: 'center' },
        match: { cellWidth: 80, halign: 'center' },
        flag: { cellWidth: 60, halign: 'center' },
        b: { cellWidth: 80, halign: 'center' },
      },
      theme: 'grid',
      overflow: 'linebreak',
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.dataKey === 'flag') {
          data.cell.text = [];
          data.cell.styles.textColor = [25, 25, 28];
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.dataKey === 'flag') {
          const flag = data.row?.raw?.flag;
          if (flag) tk_drawFlagMarker(doc, data, flag);
        }
      },
    });
  }

  function renderWithAutoTable(doc, rows) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(18, 19, 20);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);

    const normalizedRows = rows
      .map(normalizeCompatRow)
      .filter((r) => r.item || r.a || r.b || r.match);
    const headerY = tk_drawHeader(
      doc,
      'TalkKink Compatibility Report',
      new Date().toLocaleString(),
      TK_ACCENT,
    );

    tk_renderSectionTable(doc, 'Compatibility Overview', normalizedRows, headerY);
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
  const DL_BTN = '#downloadBtn, #downloadPdfBtn, [data-download-pdf]';

  function inject(src, key) {
    return new Promise((resolve, reject) => {
      const existing = key ? document.querySelector(`script[data-lib="${key}"]`) : null;
      if (existing && existing.dataset.loaded === '1') return resolve();
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('load fail ' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src; s.defer = true; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      if (key) s.dataset.lib = key;
      s.onload  = () => { if (key) s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('load fail ' + src));
      document.head.appendChild(s);
    });
  }

  const hasJsPDF     = () => !!(window.jspdf?.jsPDF) || !!window.jsPDF;
  const hasAutoTable = () => {
    const api = (window.jspdf?.jsPDF?.API) || (window.jsPDF?.API);
    return !!(api && (api.autoTable || api.__autoTable__));
  };

  async function loadFromCDN() {
    if (!hasJsPDF()) await inject(CDN.JSPDF, 'jspdf');
    // Bridge UMD -> legacy global so older code works
    if (!window.jsPDF && window.jspdf?.jsPDF) window.jsPDF = window.jspdf.jsPDF;

    if (!hasAutoTable()) await inject(CDN.AUTOTABLE, 'jspdf-autotable');

    // Ensure plugin is visible on both constructors
    const ctor   = window.jspdf?.jsPDF;
    const legacy = window.jsPDF;
    const at = (legacy?.API?.autoTable) || (ctor?.API?.autoTable);
    if (at) {
      if (ctor)   { ctor.API   = ctor.API   || {}; ctor.API.autoTable   = at; }
      if (legacy) { legacy.API = legacy.API || {}; legacy.API.autoTable = at; }
    }

    if (!hasJsPDF())     throw new Error('jsPDF not available');
    if (!hasAutoTable()) throw new Error('autoTable not available');

    return window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
  }

  // ---- HARD OVERRIDES: your old functions will now resolve to CDN loader
  window.tkLoadPdfLibs    = async () => ({ jsPDF: await loadFromCDN() });
  window.ensurePdfLibs    = async () =>      loadFromCDN();
  window.ensureAutoTable  = async () => true;

  // ---- Optional: enable the button once libs are ready
  function setBtnState(ready) {
    const btn = document.querySelector(DL_BTN);
    if (!btn) return;
    btn.disabled = !ready;
    btn.title = ready ? 'Download your compatibility PDF' : 'Loading PDF libraries…';
  }

  (async () => {
    try {
      setBtnState(false);
      await loadFromCDN();
      setBtnState(true);
      console.info('[compat-pdf] CDN libs ready');
    } catch (err) {
      console.error('[compat-pdf] Loader error:', err);
      setBtnState(false);
    }
  })();

  // Safety: if any code still tries to add /vendor/jspdf.plugin.autotable.min.js, rewrite it to CDN.
  const VENDOR_AT_RE = /\/vendor\/jspdf\.plugin\.autotable\.min\.js(?:\?.*)?$/i;
  const origAppend = HTMLHeadElement.prototype.appendChild;
  HTMLHeadElement.prototype.appendChild = function (node) {
    if (node && node.tagName === 'SCRIPT' && VENDOR_AT_RE.test(node.src)) {
      node.src = CDN.AUTOTABLE;
    }
    return origAppend.apply(this, arguments);
  };
})();
