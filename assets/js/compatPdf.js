/* assets/js/compatPdf.js — clean, single-run exporter
   - No white boxes (solid dark body fill)
   - Centered title, timestamp, and category
   - Tight 4% Flag column, full-width table
   - Debounced/guarded to prevent double runs
*/
(() => {
  // ---- Singleton guard: prevent multiple exporters/bindings ----
  if (window.__TKPDF_SINGLETON__) { return; }
  window.__TKPDF_SINGLETON__ = true;

  const CDN_JSPDF   = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  const CDN_AUTOTBL = "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

  // Theme (dark)
  const THEME = {
    pageBg: [10,10,12],
    rule:   [0,255,255],
    bodyFill: [10,10,12],
    bodyText: [235,235,235],
    grid: [34,34,42],
    headFill: [0,0,0],
    headText: [0,255,255],
  };

  // Tight margins = no big white bands
  const MARGINS = { left: 56, right: 56, top: 54, bottom: 46 };

  // Column widths (% of table width): label, A, match, flag (tight), B
  const COLW = [56, 12, 16, 4, 12];

  // ---- Loader --------------------------------------------------------------
  async function loadJsPDF() {
    if (window.jspdf?.jsPDF && window.jspdf?.jsPDF?.prototype?.autoTable) return window.jspdf.jsPDF;
    if (!window.jspdf?.jsPDF) await injectScript(CDN_JSPDF);
    if (!window.jspdf?.jsPDF?.prototype?.autoTable) await injectScript(CDN_AUTOTBL);
    return window.jspdf.jsPDF;
  }
  function injectScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // ---- Data pick & normalize ----------------------------------------------
  function pickSources(opts = {}) {
    const ls = (k) => { try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } };
    const mine    = opts.mine    ?? window.talkkinkMine    ?? window.talkkinkSurvey ?? ls("talkkink:mine") ?? ls("talkkink:survey") ?? ls("tk_compat.mine");
    const partner = opts.partner ?? window.talkkinkPartner ?? ls("talkkink:partner") ?? ls("tk_compat.partner");
    return { mine, partner };
  }

  // Expect: [{category, rows:[{label,a,matchPct,flagIcon,b}]}]
  function normalize(payload) {
    if (!payload) return [{ category: "Survey", rows: [] }];
    if (Array.isArray(payload) && payload.length && payload[0]?.rows) return payload;

    if (Array.isArray(payload)) {
      const byCat = new Map();
      for (const r of payload) {
        const cat = r.category || "Survey";
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat).push({
          label: r.label ?? r.item ?? "",
          a: r.a ?? r.partnerA ?? r.A ?? "",
          matchPct: r.matchPct ?? r.match ?? "",
          flagIcon: r.flagIcon ?? "▶",
          b: r.b ?? r.partnerB ?? r.B ?? ""
        });
      }
      return [...byCat.entries()].map(([category, rows]) => ({ category, rows }));
    }
    return [{ category: "Survey", rows: [] }];
  }

  // Merge rows for same category by label (A from mine, B from partner)
  function rowsFromTwo(sec, partnerAll) {
    const partnerSec = partnerAll?.find(s => s.category === sec.category);
    const mapB = new Map((partnerSec?.rows ?? []).map(r => [r.label, r]));
    return (sec.rows ?? []).map(r => {
      const pb = mapB.get(r.label);
      const m  = typeof r.matchPct === 'number' ? `${r.matchPct}%` : (r.matchPct || '');
      return [r.label, r.a ?? '', m, (r.flagIcon ?? '▶'), pb?.b ?? r.b ?? ''];
    });
  }

  // ---- PDF builder (no white boxes) ---------------------------------------
  async function buildPdf(opts = {}) {
    const jsPDF = await loadJsPDF();
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

    // Solid dark page background
    doc.setFillColor(...THEME.pageBg);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');

    const pageW  = doc.internal.pageSize.getWidth();
    const leftX  = MARGINS.left;
    const rightX = pageW - MARGINS.right;
    const center = pageW / 2;

    // Title + timestamp centered
    let y = MARGINS.top;
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
    doc.text('TalkKink Compatibility', center, y, { align: 'center' });

    y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, center, y, { align: 'center' });
    y += 10;

    // Cyan rule
    doc.setDrawColor(...THEME.rule); doc.setLineWidth(0.75);
    doc.line(leftX, y, rightX, y); y += 16;

    // Data
    const { mine, partner } = pickSources(opts);
    const A = normalize(mine);
    const B = partner ? normalize(partner) : null;

    // Column styles (percent widths)
    const colStyles = (([c0,c1,c2,c3,c4]) => ({
      0: { cellWidth: `${c0}%`, halign: 'left'   },
      1: { cellWidth: `${c1}%`, halign: 'center' },
      2: { cellWidth: `${c2}%`, halign: 'center' },
      3: { cellWidth: `${c3}%`, halign: 'center' }, // tight flag
      4: { cellWidth: `${c4}%`, halign: 'center' },
    }))(COLW);

    for (const sec of A) {
      // Category centered
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255);
      doc.text(sec.category || 'Survey', center, y, { align: 'center' });
      y += 12;

      // Solid body fill: kill zebra/white boxes via didParseCell
      doc.autoTable({
        head: [['Item','Partner A','Match','Flag','Partner B']],
        body: rowsFromTwo(sec, B),
        startY: y,
        margin: { top: 0, left: MARGINS.left, right: MARGINS.right, bottom: 0 },
        tableWidth: (rightX - leftX),
        styles: {
          fillColor: THEME.bodyFill,
          textColor: THEME.bodyText,
          lineColor: THEME.grid,
          lineWidth: 0.25,
          valign: 'middle',
          font: 'helvetica',
          fontSize: 12
        },
        headStyles: {
          fillColor: THEME.headFill,
          textColor: THEME.headText,
          lineColor: THEME.grid,
          fontStyle: 'bold'
        },
        // Force every body cell to dark fill — no alternate (white) rows:
        alternateRowStyles: { fillColor: THEME.bodyFill, textColor: THEME.bodyText },
        columnStyles: colStyles,
        didParseCell: (data) => {
          if (data.section === 'body') {
            data.cell.styles.fillColor = THEME.bodyFill;
            data.cell.styles.textColor = THEME.bodyText;
          }
        }
      });

      y = doc.lastAutoTable.finalY + 24;
      if (y > doc.internal.pageSize.getHeight() - (MARGINS.bottom + 120)) {
        doc.addPage();
        // redraw dark bg on new page
        doc.setFillColor(...THEME.pageBg);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
        y = MARGINS.top;
      }
    }

    doc.save('talkkink-compatibility-results.pdf');
  }

  // ---- Public API + safe binding (no double run) --------------------------
  let running = false;
  async function runOnce(opts={}) {
    if (running) return;
    running = true;
    try { await buildPdf(opts); }
    finally { running = false; }
  }

  window.TKPDF = {
    download: (opts={}) => runOnce(opts),
    __COLW__: COLW,
    __MARGINS__: MARGINS
  };

  function bindUI() {
    if (window.__TKPDF_BOUND__) return; // do not double-bind
    window.__TKPDF_BOUND__ = true;
    const btn = document.querySelector('#downloadPdfBtn, #btnDownloadPdf')
           || [...document.querySelectorAll('button, a')].find(el => /download pdf/i.test(el.textContent));
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault?.(); runOnce(); });
  }
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', bindUI)
    : bindUI();
})();
