/* ========================================================================
 * New TalkKink compatibility PDF generator
 * ===================================================================== */
(function () {
  const CDN = {
    JSPDF: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    AUTOTABLE: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  };

  let storedRows = [];
  let libsPromise = null;

  function injectScriptOnce(src, key) {
    return new Promise((resolve, reject) => {
      const existing = key ? document.querySelector(`script[data-lib="${key}"]`) : null;
      if (existing && existing.dataset.loaded === '1') return resolve();
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('load fail ' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      if (key) s.dataset.lib = key;
      s.onload = () => {
        if (key) s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = () => reject(new Error('load fail ' + src));
      document.head.appendChild(s);
    });
  }

  function hasJsPDF() {
    return !!(window.jspdf && window.jspdf.jsPDF) || !!window.jsPDF;
  }

  function hasAutoTable() {
    const api =
      (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API) ||
      (window.jsPDF && window.jsPDF.API);
    if (!api) return false;
    return !!(api.autoTable || api.__autoTable__);
  }

  async function ensureLibs() {
    if (libsPromise) return libsPromise;

    libsPromise = (async () => {
      if (!hasJsPDF()) {
        await injectScriptOnce(CDN.JSPDF, 'jspdf');
      }
      if (!window.jsPDF && window.jspdf && window.jspdf.jsPDF) {
        window.jsPDF = window.jspdf.jsPDF;
      }

      if (!hasAutoTable()) {
        await injectScriptOnce(CDN.AUTOTABLE, 'jspdf-autotable');
      }

      const ctor = window.jspdf && window.jspdf.jsPDF;
      const legacy = window.jsPDF;
      const at =
        (legacy && legacy.API && (legacy.API.autoTable || legacy.API.__autoTable__)) ||
        (ctor && ctor.API && (ctor.API.autoTable || ctor.API.__autoTable__));
      if (at) {
        if (ctor) {
          ctor.API = ctor.API || {};
          ctor.API.autoTable = at;
        }
        if (legacy) {
          legacy.API = legacy.API || {};
          legacy.API.autoTable = at;
        }
      }

      if (!hasJsPDF()) throw new Error('jsPDF not available after CDN load');
      if (!hasAutoTable()) throw new Error('autoTable not available after CDN load');

      return { jsPDF: window.jsPDF || (window.jspdf && window.jspdf.jsPDF) };
    })();

    return libsPromise;
  }

  function safeString(val) {
    if (val == null) return '';
    const s = String(val).trim();
    if (s === 'null' || s === 'undefined') return '';
    return s;
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

  function normalizeRow(row) {
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

    return {
      item: safeString(item),
      a: aScore != null ? String(aScore) : safeString(aRaw),
      b: bScore != null ? String(bScore) : safeString(bRaw),
      match: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
    };
  }

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map(normalizeRow)
      .filter((r) => r.item || r.a || r.b || r.match);
  }

  function drawHeader(doc, sectionTitle) {
    const pageW = doc.internal.pageSize.getWidth();
    const accent = [0, 214, 199];

    doc.setFillColor(18, 19, 20);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    const title = 'Talk Kink Compatibility Survey';
    const tW = doc.getTextWidth(title);
    doc.text(title, (pageW - tW) / 2, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const sub = 'Generated: ' + new Date().toLocaleString();
    const sW = doc.getTextWidth(sub);
    doc.text(sub, (pageW - sW) / 2, 94);

    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(2.5);
    const pad = 84;
    doc.line(pad, 108, pageW - pad, 108);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    const secW = doc.getTextWidth(sectionTitle);
    doc.text(sectionTitle, (pageW - secW) / 2, 140);

    return 160;
  }

  async function generateCompatibilityPDF(rows) {
    const data = normalizeRows(rows);
    if (!data.length) throw new Error('No compatibility rows available.');

    const { jsPDF } = await ensureLibs();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const startY = drawHeader(doc, 'Behavioral Play');

    const columns = [
      { header: 'Item', dataKey: 'item' },
      { header: 'Partner A', dataKey: 'a' },
      { header: 'Match', dataKey: 'match' },
      { header: 'Partner B', dataKey: 'b' },
    ];

    doc.autoTable({
      columns,
      body: data,
      startY,
      margin: { left: 60, right: 60 },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 11,
        textColor: [230, 230, 230],
        fillColor: [25, 25, 28],
        lineColor: [40, 40, 45],
        lineWidth: 0.8,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        halign: 'left',
        valign: 'middle',
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [0, 255, 245],
        fillColor: [28, 28, 32],
        lineColor: [40, 40, 45],
        lineWidth: 0.9,
        halign: 'center',
      },
      columnStyles: {
        item: { halign: 'left' },
        a: { halign: 'center' },
        match: { halign: 'center' },
        b: { halign: 'center' },
      },
      tableWidth: 'auto',
      overflow: 'linebreak',
      pageBreak: 'auto',
    });

    doc.save('compatibility.pdf');
  }

  function setStoredRows(rows) {
    storedRows = Array.isArray(rows) ? rows.slice() : [];
  }

  window.TKCompatPDF = {
    notifyRowsUpdated(rows) {
      setStoredRows(rows);
    },
    async download(rows) {
      const payload = Array.isArray(rows) && rows.length ? rows : storedRows;
      if (!payload || !payload.length) {
        throw new Error('No rows supplied to TKCompatPDF.download()');
      }
      return generateCompatibilityPDF(payload);
    },
    ensureLibs,
  };
})();
