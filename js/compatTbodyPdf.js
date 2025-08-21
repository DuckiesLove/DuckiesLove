/*
 * SolidPDFExport
 * One-box fix for white PDF: builds rows from #compatTbody and exports via jsPDF+AutoTable.
 * Requires jsPDF 2.5.1 and jsPDF-AutoTable 3.8.3 loaded before this script.
 */
(function SolidPDFExport(){
  const BTN_SELECTOR = "#downloadBtn";   // download button
  const TBODY_SELECTOR = "#compatTbody"; // table body containing data rows
  const THRESH = { star: 90, flag: 60, low: 30 };   // percent thresholds
  const ICON   = { star: "★", flag: "⚑", low: "🚩", blank: "" };

  // numeric helper
  const n = v => { const x = Number(String(v ?? "").trim()); return Number.isFinite(x) ? x : null; };
  // compute percentage match from A and B scores (0-5 scale assumed)
  const pct = (a,b) => { const A=n(a), B=n(b); if (A==null||B==null) return null; return Math.round(100-(Math.abs(A-B)/5)*100); };
  // pick flag icon based on percent
  const flag = p => p==null ? ICON.blank : (p>=THRESH.star?ICON.star : (p>=THRESH.flag?ICON.flag : (p<=THRESH.low?ICON.low:ICON.blank)));

  function rowsFromCompatTbody(){
    const tbody = document.querySelector(TBODY_SELECTOR);
    if (!tbody) { console.warn("[PDF] No tbody found at", TBODY_SELECTOR); return []; }

    const trs = Array.from(tbody.querySelectorAll('tr[data-kink-id], tr')); // be forgiving
    const rows = [];
    for (const tr of trs){
      const tds = tr.querySelectorAll("td");
      if (!tds.length) continue;
      const category = tds[0].textContent.trim();
      const aTxt = tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? "";
      const bTxt = tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? "";
      const A = n(aTxt), B = n(bTxt);
      const P = pct(A,B);
      rows.push([
        category || "—",
        (A==null ? "—" : A),
        (P==null ? "—" : `${P}%`),
        flag(P),
        (B==null ? "—" : B)
      ]);
    }
    return rows;
  }

  function runAutoTable(doc, opts){
    if (typeof doc.autoTable === "function") return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === "function") return window.jspdf.autoTable(doc, opts);
    throw new Error("jsPDF-AutoTable not found. Include the plugin before this script.");
  }

  function exportPDF(){
    if (!(window.jspdf && window.jspdf.jsPDF)) {
      alert("Missing jsPDF. Add the jsPDF script before this exporter.");
      return;
    }

    const rows = rowsFromCompatTbody();
    console.log(`[PDF] Found ${rows.length} rows from ${TBODY_SELECTOR}.`, rows[0]);
    if (!rows.length){
      alert("No data rows found in the table body. Make sure #compatTbody has rows before exporting.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });

    doc.setFontSize(20);
    doc.text("Talk Kink • Compatibility Report", doc.internal.pageSize.width/2, 48, { align: "center" });

    runAutoTable(doc, {
      head: [["Category","Partner A","Match","Flag","Partner B"]],
      body: rows,
      startY: 70,
      styles: { fontSize: 11, cellPadding: 6, overflow: "linebreak" },
      headStyles: { fillColor:[0,0,0], textColor:[255,255,255], fontStyle:"bold" },
      columnStyles: {
        0: { halign:"left",   cellWidth: 560 },
        1: { halign:"center", cellWidth: 80  },
        2: { halign:"center", cellWidth: 90  },
        3: { halign:"center", cellWidth: 60  },
        4: { halign:"center", cellWidth: 80  }
      },
      didDrawPage: data => { if (data.pageNumber > 1) doc.setFontSize(12); }
    });

    doc.save("compatibility-report.pdf");
  }

  function bind(){
    const btn = document.querySelector(BTN_SELECTOR)
             || document.getElementById("downloadPdfBtn")
             || document.querySelector("[data-download-pdf]");
    if (btn) {
      btn.onclick = exportPDF; // override any existing handler
      console.log("[PDF] Export bound to button:", btn);
    } else {
      window.downloadCompatibilityPDF = exportPDF;
      console.warn("[PDF] Button not found; call window.downloadCompatibilityPDF() to export.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
