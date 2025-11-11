/* assets/js/compatPdf.js — single-run TalkKink PDF exporter
   - No white boxes (solid dark body fill)
   - Title / timestamp / category centered
   - Tight 4% Flag column
   - FULL double-load protection:
       * singleton guard
       * button rebind via cloneNode (wipes old listeners)
       * debounced runner (queued = ignored)
*/
(() => {
  // ---- Singleton guard: if an older copy already ran, stop here
  if (window.__TKPDF_SINGLETON__) return;
  window.__TKPDF_SINGLETON__ = true;

  const CDN_JSPDF   = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
  const CDN_AUTOTBL = "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js";

  // Theme (dark)
  const THEME = {
    pageBg:   [10,10,12],
    rule:     [0,255,255],
    bodyFill: [10,10,12],
    bodyText: [235,235,235],
    grid:     [34,34,42],
    headFill: [0,0,0],
    headText: [0,255,255],
  };

  // Tight margins so the table fills the page visually
  const MARGINS = { left: 56, right: 56, top: 54, bottom: 46 };

  // Column widths (%): label, A, match, flag, B
  const COLW = [56, 12, 16, 4, 12];

  // ================= loader =================
  async function loadJsPDF() {
    if (window.jspdf?.jsPDF && window.jspdf?.jsPDF?.prototype?.autoTable) return window.jspdf.jsPDF;
    if (!window.jspdf?.jsPDF) await inject(CDN_JSPDF);
    if (!window.jspdf?.jsPDF?.prototype?.autoTable) await inject(CDN_AUTOTBL);
    return window.jspdf.jsPDF;
  }
  function inject(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }

  // ================= data =================
  function pickSources(opts = {}) {
    const ls = (k)=>{ try { return JSON.parse(localStorage.getItem(k)||"null"); } catch { return null; } };
    const mine    = opts.mine    ?? window.talkkinkMine    ?? window.talkkinkSurvey ?? ls("talkkink:mine") ?? ls("talkkink:survey") ?? ls("tk_compat.mine");
    const partner = opts.partner ?? window.talkkinkPartner ?? ls("talkkink:partner") ?? ls("tk_compat.partner");
    return { mine, partner };
  }
  // Expect normalized: [{category, rows:[{label,a,matchPct,flagIcon,b}]}]
  function normalize(payload) {
    if (!payload) return [{ category: "Survey", rows: [] }];
    if (Array.isArray(payload) && payload.length && payload[0]?.rows) return payload;

    if (Array.isArray(payload)) {
      const map = new Map();
      for (const r of payload) {
        const cat = r.category || "Survey";
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push({
          label:    r.label ?? r.item ?? "",
          a:        r.a ?? r.partnerA ?? r.A ?? "",
          matchPct: r.matchPct ?? r.match ?? "",
          flagIcon: r.flagIcon ?? "▶",
          b:        r.b ?? r.partnerB ?? r.B ?? ""
        });
      }
      return [...map.entries()].map(([category, rows]) => ({ category, rows }));
    }
    return [{ category: "Survey", rows: [] }];
  }
  function rowsFromTwo(sec, partnerAll) {
    const partnerSec = partnerAll?.find(s => s.category === sec.category);
    const mapB = new Map((partnerSec?.rows ?? []).map(r => [r.label, r]));
    return (sec.rows ?? []).map(r => {
      const pb = mapB.get(r.label);
      const m  = typeof r.matchPct === 'number' ? `${r.matchPct}%` : (r.matchPct || '');
      return [r.label, r.a ?? '', m, (r.flagIcon ?? '▶'), pb?.b ?? r.b ?? ''];
    });
  }

  // ================= pdf =================
  async function buildPdf(opts = {}) {
    const jsPDF = await loadJsPDF();
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

    // Paint background dark on every page
    function paintBg() {
      doc.setFillColor(...THEME.pageBg);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
    }
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const leftX  = MARGINS.left;
    const rightX = pageW - MARGINS.right;
    const center = pageW / 2;
    const topY   = 52;
    const tableWidth = pageW - (MARGINS.left + MARGINS.right);
    const generatedStamp = `Generated: ${new Date().toLocaleString()}`;

    function drawOutlinedText(docRef, txt, x, y, opts = {}) {
      const {
        align = 'left',
        size = 28,
        fill = [255, 255, 255],
        stroke = [0, 255, 255],
        width = 0.9,
        font = 'helvetica',
        style = 'bold'
      } = opts;

      docRef.setFont(font, style);
      docRef.setFontSize(size);

      docRef.setDrawColor(...stroke);
      docRef.setLineWidth(width);
      docRef.text(txt, x, y, { align, renderingMode: 'stroke' });

      docRef.setTextColor(...fill);
      docRef.text(txt, x, y, { align, renderingMode: 'fill' });
    }

    function paintPageChrome() {
      paintBg();
      drawOutlinedText(doc, 'TalkKink Compatibility', center, topY, {
        align: 'center',
        size: 36,
        width: 1.2
      });
      drawOutlinedText(doc, generatedStamp, center, topY + 18, {
        align: 'center',
        size: 12,
        width: 0.6,
        style: 'normal'
      });
    }

    paintPageChrome();

    let y = topY + 50;

    const { mine, partner } = pickSources(opts);
    const A = normalize(mine);
    const B = partner ? normalize(partner) : null;

    const colStyles = (([c0,c1,c2,c3,c4]) => ({
      0: { cellWidth: `${c0}%`, halign: 'left'   },
      1: { cellWidth: `${c1}%`, halign: 'center' },
      2: { cellWidth: `${c2}%`, halign: 'center' },
      3: { cellWidth: `${c3}%`, halign: 'center' }, // tight Flag
      4: { cellWidth: `${c4}%`, halign: 'center' },
    }))(COLW);

    const originalAddPage = doc.addPage;
    doc.addPage = function patchedAddPage(...args) {
      const result = originalAddPage.apply(this, args);
      paintPageChrome();
      y = topY + 50;
      return result;
    };

    try {
      for (const sec of A) {
        if (y > pageH - (MARGINS.bottom + 120)) {
          doc.addPage();
        }

        const sectionTitle = sec.category || 'Survey';
        drawOutlinedText(doc, sectionTitle, center, y, {
          align: 'center',
          size: 28,
          width: 1.0
        });

        doc.setDrawColor(...THEME.rule);
        doc.setLineWidth(0.75);
        doc.line(leftX, y + 6, rightX, y + 6);

        const tableStartY = y + 16;

        doc.autoTable({
          head: [['Item','Partner A','Match','Flag','Partner B']],
          body: rowsFromTwo(sec, B),
          startY: tableStartY,
          margin: { top: topY + 66, left: MARGINS.left, right: MARGINS.right, bottom: 0 },
          tableWidth,
        styles: {
          fillColor: THEME.bodyFill,
          textColor: THEME.bodyText,
          lineColor: THEME.grid,
          lineWidth: 0.25,
          valign: 'middle',
          font: 'helvetica',
          fontSize: 12,
          cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
          overflow: 'linebreak',
          lineHeight: 1.2
        },
        headStyles: {
          fillColor: THEME.headFill,
          textColor: THEME.headText,
          lineColor: THEME.grid,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: { top: 8, bottom: 8 },
          minCellHeight: 20,
          overflow: 'hidden',
          wordBreak: 'keepAll'
        },
        columnStyles: colStyles,
        alternateRowStyles: { fillColor: THEME.bodyFill, textColor: THEME.bodyText },
        didParseCell: (d) => {
          if (d.section === 'body') {
            d.cell.styles.fillColor = THEME.bodyFill;
            d.cell.styles.textColor = THEME.bodyText;
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'head') {
            const rawText = Array.isArray(data.cell.text)
              ? data.cell.text.join(' ')
              : String(data.cell.text || '');
            const txt = rawText.trim();
            if (!txt) return;

            const tx = data.cell.textPos?.x ?? (data.cell.x + 4);
            const ty = data.cell.textPos?.y ?? (data.cell.y + data.cell.height / 2 + 3);

            drawOutlinedText(doc, txt, tx, ty, {
              align: 'left',
              size: 12,
              width: 0.55
            });
          }
        }
        });

        y = doc.lastAutoTable.finalY + 24;
      }
    } finally {
      doc.addPage = originalAddPage;
    }

    doc.save('talkkink-compatibility-results.pdf');
  }

  // ================= run guard (stops double execution) =================
  let running = false;
  let inFlight = null;

  async function runOnce(opts = {}) {
    if (running) return inFlight;           // ignore second trigger
    running = true;
    inFlight = (async () => {
      try   { await buildPdf(opts); }
      finally { running = false; inFlight = null; }
    })();
    return inFlight;
  }

  // Expose public API
  window.TKPDF = {
    download: (opts={}) => runOnce(opts),
    __COLW__: COLW,
    __MARGINS__: MARGINS
  };

  // ================= binding (wipe old listeners first) =================
  function rebindDownloadButton() {
    if (window.__TKPDF_BOUND__) return;    // don’t bind twice
    window.__TKPDF_BOUND__ = true;

    // Find the button by id or text
    const findBtn = () =>
      document.querySelector('#downloadPdfBtn, #btnDownloadPdf') ||
      [...document.querySelectorAll('button, a')].find(el => /download pdf/i.test(el.textContent));

    const btn = findBtn();
    if (!btn) return;

    // Clone node to strip any existing handlers (this kills the “double load”)
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);

    // Now bind exactly one handler
    clone.addEventListener('click', (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      runOnce();
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rebindDownloadButton, { once: true });
  } else {
    rebindDownloadButton();
  }
})();
