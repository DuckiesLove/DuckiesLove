/* assets/js/compatPdf.js  — clean restart
   - Centers title, timestamp, and category
   - Full-width table (no big white margins)
   - Tight 4% Flag column, label widened
   - Minimal, predictable API: window.TKPDF.download(opts)
*/
(() => {
  const CDN_JSPDF   = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  const CDN_AUTOTBL = "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

  const THEME = {
    pageBg: [10,10,12],
    rule:   [0,255,255],
    bodyFill: [10,10,12],
    bodyText: [235,235,235],
    grid: [34,34,42],
    headFill: [0,0,0],
    headText: [0,255,255],
  };

  // Print region (tight to remove white space)
  const MARGINS = { left: 56, right: 56, top: 54, bottom: 46 };

  // Column widths as % of table area: label, A, match, flag, B
  const COLW = [56, 12, 16, 4, 12];

  // ---- Loader --------------------------------------------------------------
  async function loadJsPDF() {
    if (window.jspdf?.jsPDF && window.jspdf?.jsPDF?.prototype?.autoTable) return window.jspdf.jsPDF;
    if (!window.jspdf?.jsPDF)           await injectScript(CDN_JSPDF);
    if (!window.jspdf?.jsPDF?.prototype?.autoTable) await injectScript(CDN_AUTOTBL);
    return window.jspdf.jsPDF;
  }
  function injectScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // ---- Data plumbing -------------------------------------------------------
  function pickSources(opts = {}) {
    const mine    = opts.mine    ?? window.talkkinkMine    ?? window.talkkinkSurvey ?? ls("talkkink:mine") ?? ls("talkkink:survey") ?? ls("tk_compat.mine") ?? null;
    const partner = opts.partner ?? window.talkkinkPartner ?? ls("talkkink:partner") ?? ls("tk_compat.partner") ?? null;
    return { mine, partner };
    function ls(k){ try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } }
  }

  // Expect: [{category:"Behavioral Play", rows:[{label,a,matchPct,flagIcon,b}, ...]}]
  function normalize(data) {
    if (Array.isArray(data) && data.length && data[0]?.rows) return data; // already normalized
    if (Array.isArray(data)) {
      const byCat = new Map();
      for (const r of data) {
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

  // ---- PDF building --------------------------------------------------------
  function cyanRule(doc, x1, x2, y) {
    doc.setDrawColor(...THEME.rule);
    doc.setLineWidth(0.75);
    doc.line(x1, y, x2, y);
  }

  function makeColumnStyles() {
    const [c0,c1,c2,c3,c4] = COLW.map(x => `${x}%`);
    return {
      0: { cellWidth: c0, halign: 'left'   },
      1: { cellWidth: c1, halign: 'center' },
      2: { cellWidth: c2, halign: 'center' },
      3: { cellWidth: c3, halign: 'center' }, // tight flag
      4: { cellWidth: c4, halign: 'center' },
    };
  }

  function headerRow() {
    return [['Item','Partner A','Match','Flag','Partner B']];
  }

  function bodyRows(section) {
    return section.rows.map(r => [
      r.label,
      r.a,
      typeof r.matchPct === 'number' ? `${r.matchPct}%` : (r.matchPct || ''),
      r.flagIcon ?? '▶',
      r.b
    ]);
  }

  async function buildPdf(opts = {}) {
    const jsPDF = await loadJsPDF();
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

    // Background color (dark sheet)
    doc.setFillColor(...THEME.pageBg);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');

    const pageW  = doc.internal.pageSize.getWidth();
    const leftX  = MARGINS.left;
    const rightX = pageW - MARGINS.right;
    const centerX= pageW / 2;

    // Title + timestamp (centered)
    let y = MARGINS.top;
    doc.setTextColor(255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
    doc.text('TalkKink Compatibility', centerX, y, { align: 'center' });

    y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(180);
    doc.text(`Generated: ${new Date().toLocaleString()}`, centerX, y, { align: 'center' });
    y += 10; cyanRule(doc, leftX, rightX, y); y += 16;

    // Resolve & normalize data
    const { mine, partner } = pickSources(opts);
    const primary     = normalize(mine ?? []);
    const partnerNorm = partner ? normalize(partner) : null;

    // Render each category
    for (const sec of primary) {
      const section = { category: sec.category, rows: bodyRowsFromTwo(sec, partnerNorm) };
      // Category header centered
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255);
      doc.text(section.category, centerX, y, { align: 'center' });
      y += 12;

      doc.autoTable({
        head: headerRow(),
        body: section.rows,
        startY: y,
        margin: { top: 0, left: MARGINS.left, right: MARGINS.right, bottom: 0 },
        tableWidth: (rightX - leftX),
        styles: {
          fillColor: THEME.bodyFill,
          textColor: THEME.bodyText,
          lineColor: THEME.grid,
          lineWidth: 0.25,
          valign: 'middle'
        },
        headStyles: {
          fillColor: THEME.headFill,
          textColor: THEME.headText,
          lineColor: THEME.grid,
          fontStyle: 'bold'
        },
        columnStyles: makeColumnStyles(),
        didDrawPage: () => {}
      });

      y = doc.lastAutoTable.finalY + 24;
      if (y > doc.internal.pageSize.getHeight() - (MARGINS.bottom + 120)) {
        doc.addPage();
        doc.setFillColor(...THEME.pageBg);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
        y = MARGINS.top;
      }
    }

    const name = 'talkkink-compatibility-results.pdf';
    doc.save(name);
  }

  // Merge “mine” + “partner” into table rows (two-column numbers)
  function bodyRowsFromTwo(section, partnerAll) {
    const rowsA = section.rows ?? [];
    if (rowsA.length && Array.isArray(rowsA[0])) return rowsA;

    const partnerSec = partnerAll?.find(s => s.category === section.category);
    const rowsB = partnerSec?.rows ?? [];
    const mapB = new Map(rowsB.map(r => [r.label, r]));

    const out = [];
    for (const r of section.rows) {
      const m = typeof r.matchPct === 'number' ? `${r.matchPct}%` : (r.matchPct || '');
      const pb = mapB.get(r.label);
      out.push([r.label, r.a ?? '', m, r.flagIcon ?? '▶', pb?.b ?? r.b ?? '']);
    }
    return out;
  }

  // ---- Public API + UI binding --------------------------------------------
  window.TKPDF = {
    download: (opts={}) => buildPdf(opts).catch(err => {
      console.error('[TKPDF] export failed:', err);
      alert('PDF export failed. See console for details.');
    }),
    __COLW__: COLW,
    __MARGINS__: MARGINS
  };

  function bindUI() {
    const btn = document.querySelector('#downloadPdfBtn, #btnDownloadPdf')
           || [...document.querySelectorAll('button, a')].find(el => /download pdf/i.test(el.textContent));
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault?.(); window.TKPDF.download(); });
  }
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', bindUI) : bindUI();
})();
