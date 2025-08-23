(function () {
  /* ---------- load jsPDF & AutoTable ---------- */
  function inject(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = res;
      s.onerror = () => rej(new Error("Failed to load " + src));
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

  /* ---------- table helpers ---------- */
  const tidy = s => (s || "").replace(/\s+/g, " ").trim();

  function getTable() {
    return document.getElementById("compatibilityTable")
      || document.querySelector('table[aria-label*="compatibility" i]')
      || document.querySelector("table");
  }

  function getRowsFromTable() {
    const table = getTable();
    if (!table) return [];
    let trs = [...table.querySelectorAll("tbody tr")];
    if (!trs.length) trs = [...table.querySelectorAll("tr")].filter(tr => tr.querySelectorAll("td").length);
    const out = [];
    for (const tr of trs) {
      const tds = [...tr.querySelectorAll("td")];
      if (!tds.length) continue;
      out.push(tds.map(td => tidy(td.textContent)));
    }
    return out;
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

  /* ---------- export ---------- */
  async function exportCompatibilityPDF() {
    await ensureLibs();
    const { jsPDF } = window.jspdf;

    const rows = getRowsFromTable();
    if (!rows.length) {
      alert("No rows to export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;

    const M_LEFT = 72;   // 1 inch
    const M_RIGHT = 72;  // 1 inch
    const INNER_W = pageW - M_LEFT - M_RIGHT;

    const wCat = Math.floor(INNER_W * 0.50);
    const wA = Math.floor(INNER_W * 0.11);
    const wMatch = Math.floor(INNER_W * 0.13);
    const wFlag = Math.floor(INNER_W * 0.08);
    const wB = INNER_W - (wCat + wA + wMatch + wFlag);

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.text("Talk Kink • Compatibility Report", pageW / 2, 64, { align: "center" });

    runAutoTable(doc, {
      head: [["Category", "Partner A", "Match", "Flag", "Partner B"]],
      body: rows,
      startY: 96,
      theme: "plain",
      margin: { left: M_LEFT, right: M_RIGHT },
      tableWidth: INNER_W,
      styles: {
        fontSize: 14,
        cellPadding: 8,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0]
      },
      headStyles: {
        fontStyle: "bold",
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        halign: "center"
      },
      columnStyles: {
        0: { cellWidth: wCat, halign: "left", fontStyle: "bold" },
        1: { cellWidth: wA, halign: "center" },
        2: { cellWidth: wMatch, halign: "center" },
        3: { cellWidth: wFlag, halign: "center" },
        4: { cellWidth: wB, halign: "center" }
      },
      didParseCell: data => {
        data.cell.styles.fillColor = [0, 0, 0];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.overflow = "linebreak";
      },
      willDrawCell: data => {
        const { cell } = data;
        doc.setFillColor(0, 0, 0);
        doc.rect(cell.x, cell.y, cell.width, cell.height, "F");
      }
    });

    doc.save("compatibility-report.pdf");
  }

  function bind() {
    const btn = getOrCreateButton();
    btn.removeEventListener("click", exportCompatibilityPDF);
    btn.addEventListener("click", exportCompatibilityPDF);
    window.exportCompatibilityPDF = exportCompatibilityPDF;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();

