(function () {
  /* --------- Load jsPDF & AutoTable --------- */
  function inject(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("Failed " + src));
      document.head.appendChild(s);
    });
  }
  async function ensureLibs() {
    await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    if (!(window.jspdf && window.jspdf.jsPDF)) throw new Error("jsPDF not ready");
    if (!((window.jspdf && window.jspdf.autoTable) || (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable))) {
      await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    }
  }
  function runAutoTable(doc, opts) {
    if (typeof doc.autoTable === "function") return doc.autoTable(opts);
    return window.jspdf.autoTable(doc, opts);
  }

  /* --------- Helpers --------- */
  const tidy = s => String(s || "").replace(/\s+/g, " ").trim();
  function dedupeSmart(s) {
    const t = tidy(s); if (!t) return t;
    const m = t.match(/^(.+?)\1+$/); if (m) return m[1];
    const seed = t.slice(0, Math.min(30, Math.floor(t.length / 2)));
    const p = t.indexOf(seed, seed.length);
    return (p > 0) ? t.slice(0, p).trim() : t;
  }
  function getTable() {
    return document.getElementById("compatibilityTable")
      || document.querySelector('table[aria-label*="compatibility" i]')
      || document.querySelector("table");
  }
  function rowsFromTable() {
    const table = getTable(); if (!table) return [];
    const trs = [...table.querySelectorAll("tbody tr")].filter(tr => tr.querySelectorAll("td").length);
    return trs.map(tr => {
      const tds = [...tr.querySelectorAll("td")];
      const cat = dedupeSmart(tds[0]?.textContent || "");
      return [cat, tidy(tds[1]?.textContent), tidy(tds[2]?.textContent), tidy(tds[3]?.textContent), tidy(tds[4]?.textContent)];
    });
  }
  function getOrCreateButton() {
    let btn = document.querySelector("#downloadBtn,#downloadPdfBtn,[data-download-pdf]");
    if (btn) return btn;
    btn = document.createElement("button");
    btn.id = "downloadBtn";
    btn.textContent = "Download Compatibility PDF";
    btn.style.cssText = "margin:16px 0;padding:10px 14px;font-size:14px;border-radius:8px;border:1px solid #0ff;background:#001014;color:#0ff;cursor:pointer;";
    (getTable()?.parentElement || document.body).appendChild(btn);
    return btn;
  }

  /* --------- Export --------- */
  async function exportCompatibilityPDF() {
    await ensureLibs();
    const { jsPDF } = window.jspdf;
    const rows = rowsFromTable();
    if (!rows.length) { alert("No data"); return; }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40, top = 80;
    const innerW = pageW - 2 * margin;

    const wCat = Math.floor(innerW * 0.55);
    const wA = Math.floor(innerW * 0.10);
    const wMatch = Math.floor(innerW * 0.12);
    const wFlag = Math.floor(innerW * 0.08);
    const wB = innerW - (wCat + wA + wMatch + wFlag);

    // Black background
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text("Talk Kink • Compatibility Report", pageW / 2, 50, { align: "center" });

    // Clamp to 2 lines
    function clampTwo(text, avail) {
      const lines = doc.splitTextToSize(text, avail);
      return lines.length <= 2 ? lines : [lines[0], (lines[1] + "…")];
    }

    runAutoTable(doc, {
      head: [["Category", "Partner A", "Match", "Flag", "Partner B"]],
      body: rows,
      startY: top,
      margin: { left: margin, right: margin },
      tableWidth: innerW,
      styles: { fontSize: 12, cellPadding: 6, textColor: [255, 255, 255], fillColor: [0, 0, 0], overflow: "linebreak" },
      headStyles: { fontStyle: "bold", fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: wCat, halign: "left", fontStyle: "bold" },
        1: { cellWidth: wA, halign: "center" },
        2: { cellWidth: wMatch, halign: "center" },
        3: { cellWidth: wFlag, halign: "center" },
        4: { cellWidth: wB, halign: "center" }
      },
      didParseCell: data => {
        if (data.section === "body" && data.column.index === 0) {
          const clamped = clampTwo(dedupeSmart(data.cell.text), wCat - 12);
          data.cell.text = clamped;
        }
      },
      willDrawCell: data => {
        doc.setFillColor(0, 0, 0);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
      }
    });

    doc.save("compatibility-report.pdf");
  }

  // Button
  function bind() {
    const btn = getOrCreateButton();
    btn.removeEventListener("click", exportCompatibilityPDF);
    btn.addEventListener("click", exportCompatibilityPDF);
    window.exportCompatibilityPDF = exportCompatibilityPDF;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
