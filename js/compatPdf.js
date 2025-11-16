/**
 * TalkKink Compatibility PDF – DARK ROWS, NO FLAGS
 * ------------------------------------------------
 * ✔ CDN-only jsPDF + autoTable
 * ✔ Columns: Item | Partner A | Match | Partner B
 * ✔ NO flag column
 * ✔ Uses the match % already computed by comparison logic
 * ✔ No deprecated autoTable options
 * ✔ All rows use the same dark background (no white stripes)
 */

(() => {
  const CFG = {
    pdfKillSwitch: false,
    selectors: { downloadBtn: '#downloadPdfBtn, #downloadBtn, [data-download-pdf]' },

    columns: [
      { key: 'item', header: 'Item', w: 320 },
      { key: 'a', header: 'Partner A', w: 80 },
      { key: 'match', header: 'Match', w: 80 },
      { key: 'b', header: 'Partner B', w: 80 }
    ],

    cdn: {
      jspdf: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ],
      autotable: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js',
        'https://unpkg.com/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js'
      ]
    }
  };

  console.info('[compat] kill-switch ' + (CFG.pdfKillSwitch ? 'enabled' : 'disabled'));

  let libsReady = false;
  let libsReadyPromise = null;
  let cachedRows = [];
  let enablingErrored = false;

  /* ------------------ SCRIPT LOADING (CDN ONLY) ------------------ */

  function injectScriptOnce(src, idKey) {
    return new Promise((resolve, reject) => {
      if (idKey) {
        const existing = document.querySelector(`script[data-lib="${idKey}"]`);
        if (existing && existing.dataset.loaded === '1') return resolve();
      }

      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      if (idKey) s.dataset.lib = idKey;
      s.defer = true;

      s.onload = () => {
        if (idKey) s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => {
        s.remove();
        reject(new Error(`Failed to load ${src}`));
      };

      document.head.appendChild(s);
    });
  }

  function jsPdfPresent() {
    return !!(window.jspdf?.jsPDF || window.jsPDF);
  }

  function autoTablePresent(jsPDF) {
    return !!(
      jsPDF?.API?.autoTable ||
      window.jsPDF?.API?.autoTable ||
      window.jspdf?.autoTable
    );
  }

  async function ensureJsPDF() {
    if (jsPdfPresent()) return window.jspdf?.jsPDF || window.jsPDF;
    for (const src of CFG.cdn.jspdf) {
      try {
        await injectScriptOnce(src, 'jspdf');
        if (jsPdfPresent()) break;
      } catch (e) {}
    }
    if (!jsPdfPresent()) throw new Error('jsPDF failed to load via CDN');
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  async function ensureAutoTable(jsPDF) {
    if (autoTablePresent(jsPDF)) return true;
    for (const src of CFG.cdn.autotable) {
      try {
        await injectScriptOnce(src, 'jspdf-autotable');
        if (autoTablePresent(jsPDF)) return true;
      } catch (e) {}
    }
    return autoTablePresent(jsPDF);
  }

  function ensurePdfLibsReady() {
    if (!libsReadyPromise) {
      libsReadyPromise = (async () => {
        const jsPDF = await ensureJsPDF();
        await ensureAutoTable(jsPDF);
        libsReady = true;
        enablingErrored = false;
        setButtonState();
        return { jsPDF, hasAutoTable: autoTablePresent(jsPDF) };
      })().catch(err => {
        libsReady = false;
        enablingErrored = true;
        libsReadyPromise = null;
        console.error('[compat-pdf] libs failed:', err);
        setButtonState();
      });
    }
    return libsReadyPromise;
  }

  /* ------------------ NORMALIZATION HELPERS ------------------ */

  const ACCENT = [0, 214, 199];

  function safeString(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return s === 'undefined' || s === 'null' ? '' : s;
  }

  // Just ensure a score is turned into a simple string
  function normalizeScore(v) {
    if (v == null) return '';
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return String(n);
    return safeString(v);
  }

  // Ensure the match is a human-friendly percentage string, WITHOUT recalculating
  function normalizeMatch(v) {
    const raw = safeString(v);
    if (!raw) return '';
    if (raw.includes('%')) return raw;
    const n = Number(raw.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n)) return `${n}%`;
    return raw;
  }

  // Handle both array-based and object-based rows
  function normalizeRow(row) {
    let item = '';
    let aRaw;
    let bRaw;
    let matchRaw;

    if (Array.isArray(row)) {
      // Try to auto-detect the format:
      // 1) [item, a, b, match, flag]
      // 2) [item, a, match, flag, b]
      item = row[0];
      const v1 = row[1];
      const v2 = row[2];
      const v3 = row[3];

      if (row.length >= 4) {
        const s2 = safeString(v2);
        const s3 = safeString(v3);

        if (s3.includes('%')) {
          // [item, a, b, match, ...]
          aRaw = v1;
          bRaw = v2;
          matchRaw = v3;
        } else if (s2.includes('%')) {
          // [item, a, match, flag, b]
          aRaw = v1;
          matchRaw = v2;
          bRaw = row[4];
        } else if (row.length >= 5 && safeString(row[3]).includes('%')) {
          // [item, a, b, match, flag] variant
          aRaw = v1;
          bRaw = v2;
          matchRaw = row[3];
        } else if (row.length >= 4) {
          // Fallback guess: [item, a, b, match]
          aRaw = v1;
          bRaw = v2;
          matchRaw = v3;
        } else {
          // Minimal fallback: [item, a, b]
          aRaw = v1;
          bRaw = v2;
          matchRaw = '';
        }
      } else {
        // Worst case, just treat 1 as A and 2 as B
        item = row[0];
        aRaw = row[1];
        bRaw = row[2];
        matchRaw = '';
      }
    } else if (row && typeof row === 'object') {
      item = row.item ?? row.label ?? '';
      aRaw = row.a ?? row.partnerA ?? row.scoreA ?? row.aScore;
      bRaw = row.b ?? row.partnerB ?? row.scoreB ?? row.bScore;
      matchRaw =
        row.matchPercent ??
        row.matchPct ??
        row.match ??
        row.matchText ??
        row.matchValue ??
        '';
    }

    return {
      item: safeString(item),
      a: normalizeScore(aRaw),
      match: normalizeMatch(matchRaw),
      b: normalizeScore(bRaw)
    };
  }

  /* ------------------ PDF RENDERING ------------------ */

  function drawHeader(doc) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    doc.setFillColor(18, 19, 20);
    doc.rect(0, 0, w, h, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    const title = 'TalkKink Compatibility Survey';
    doc.text(title, (w - doc.getTextWidth(title)) / 2, 80);

    doc.setFontSize(12);
    const sub = 'Generated: ' + new Date().toLocaleString();
    doc.text(sub, (w - doc.getTextWidth(sub)) / 2, 104);

    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(2.5);
    doc.line(60, 118, w - 60, 118);

    doc.setFontSize(24);
    const section = 'Behavioral Play';
    doc.text(section, (w - doc.getTextWidth(section)) / 2, 160);

    return 180; // first table Y
  }

  function renderWithAutoTable(doc, rows) {
    const startY = drawHeader(doc);
    const body = rows.map(normalizeRow);

    doc.autoTable({
      startY,
      head: [['Item', 'Partner A', 'Match', 'Partner B']],
      body: body.map(r => [r.item, r.a, r.match, r.b]),
      margin: { left: 60, right: 60 },
      theme: 'grid', // so no striped white rows
      styles: {
        font: 'helvetica',
        fontSize: 12,
        textColor: [230, 230, 230],
        fillColor: [25, 25, 28],
        lineColor: [40, 40, 45],
        lineWidth: 1.1
      },
      headStyles: {
        textColor: [0, 255, 245],
        fillColor: [28, 28, 32],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 320, halign: 'left' },
        1: { cellWidth: 80, halign: 'center' },
        2: { cellWidth: 80, halign: 'center' },
        3: { cellWidth: 80, halign: 'center' }
      },
      // force alternate rows to use the same dark fill (no white boxes)
      alternateRowStyles: {
        fillColor: [25, 25, 28],
        textColor: [230, 230, 230]
      }
    });
  }

  function renderFallback(doc, rows) {
    const startY = drawHeader(doc);
    let y = startY + 20;
    doc.setFontSize(12);
    rows.map(normalizeRow).forEach(r => {
      doc.text(
        `${r.item}  —  A:${r.a}  Match:${r.match}  B:${r.b}`,
        60,
        y
      );
      y += 16;
    });
  }

  /* ------------------ ROW STORAGE ------------------ */

  function computeRows() {
    if (cachedRows.length) return cachedRows;
    if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
      return window.talkkinkCompatRows;
    }
    try {
      const raw = localStorage.getItem('talkkink:compatRows');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setRows(arr) {
    cachedRows = Array.isArray(arr) ? arr.slice() : [];
  }

  /* ------------------ BUTTON STATE ------------------ */

  function getBtn() {
    return document.querySelector(CFG.selectors.downloadBtn);
  }

  function setButtonState() {
    const btn = getBtn();
    if (!btn) return;

    const rows = computeRows();
    const canEnable =
      !CFG.pdfKillSwitch && libsReady && rows.length > 0 && !enablingErrored;

    btn.disabled = !canEnable;
    btn.title = canEnable
      ? 'Download your compatibility PDF'
      : 'Upload both partner surveys first, then wait for the green messages below the buttons.';
  }

  /* ------------------ MAIN GENERATOR ------------------ */

  async function generateCompatibilityPDF(rows) {
    const payload = rows && rows.length ? rows : computeRows();
    if (!payload.length) throw new Error('No compatibility rows available');

    const { jsPDF, hasAutoTable } = await ensurePdfLibsReady();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

    if (hasAutoTable) {
      renderWithAutoTable(doc, payload);
    } else {
      renderFallback(doc, payload);
    }

    doc.save('talkkink-compatibility.pdf');
  }

  /* ------------------ WIRING ------------------ */

  function init() {
    const btn = getBtn();
    if (btn) btn.disabled = true;

    if (Array.isArray(window.talkkinkCompatRows)) {
      setRows(window.talkkinkCompatRows);
    }

    setButtonState();
    ensurePdfLibsReady();

    if (btn) {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const rows = computeRows();
        if (!rows.length) {
          alert(
            'Upload both partner surveys first, then wait for the green messages below the buttons before downloading.'
          );
          return;
        }
        try {
          await generateCompatibilityPDF(rows);
        } catch (err) {
          console.error('[compat-pdf] generation failed', err);
          enablingErrored = true;
          setButtonState();
          alert('PDF could not be generated. See console for details.');
        }
      });
    }
  }

  /* ------------------ PUBLIC API ------------------ */

  window.TKCompatPDF = {
    notifyRowsUpdated(rows) {
      setRows(Array.isArray(rows) ? rows : []);
      setButtonState();
    },
    generateFromStorage() {
      const rows = computeRows();
      if (!rows.length) {
        alert('Upload both partner surveys first.');
        return;
      }
      generateCompatibilityPDF(rows);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
