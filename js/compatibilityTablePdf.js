(function () {
  /* ------------------ load libs ------------------ */
  function inject(src){
    return new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`)) return res();
      const s=document.createElement("script");
      s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error("Failed "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    if(!(window.jspdf && window.jspdf.jsPDF)) throw new Error("jsPDF not ready");
    if(!((window.jspdf && window.jspdf.autoTable) || (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable))){
      await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    }
  }
  function runAutoTable(doc, opts){
    if(typeof doc.autoTable==="function") return doc.autoTable(opts);
    return window.jspdf.autoTable(doc, opts);
  }

  /* ------------------ helpers ------------------ */
  const tidy = s => String(s||"").replace(/\s+/g," ").trim();
  const toNum = v => {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : null;
    };
  const pctMatch = (a,b)=> {
    if(a==null || b==null) return null;
    return Math.round(100 - (Math.abs(a-b)/5)*100);
  };
  const flagFor = p => p==null ? "" : (p>=90 ? "★" : (p>=60 ? "⚑" : "🚩"));

  // Build rows from window.partnerAData / window.partnerBData (preferred)
  function rowsFromData(){
    const rawA = (window.partnerAData?.items) || (Array.isArray(window.partnerAData) ? window.partnerAData : null);
    const rawB = (window.partnerBData?.items) || (Array.isArray(window.partnerBData) ? window.partnerBData : null);
    if(!rawA && !rawB) return [];

    const map = new Map(); // key -> {label, A, B}
    const put = (arr, isA) => (arr||[]).forEach(it=>{
      const key = it.id || it.label || "";
      const label = tidy(it.label || it.id || "");
      const score = toNum(it.score ?? it.value ?? it.rating);
      if(!map.has(key)) map.set(key, { label, A: null, B: null });
      if(isA) map.get(key).A = score; else map.get(key).B = score;
    });
    put(rawA, true);
    put(rawB, false);

    // Sort alphabetically by label to keep stable
    return [...map.values()]
      .sort((x,y)=>x.label.localeCompare(y.label, undefined, {sensitivity:"base"}))
      .map(row=>{
        const p = pctMatch(row.A, row.B);
        return [row.label || "—", row.A ?? "—", p==null ? "—" : `${p}%`, flagFor(p), row.B ?? "—"];
      });
  }

  // Fallback: read from the DOM table if needed
  function rowsFromDOM(){
    const table = document.getElementById("compatibilityTable") || document.querySelector("table");
    if(!table) return [];
    const trs = [...table.querySelectorAll("tbody tr")].filter(tr=>tr.querySelectorAll("td").length);
    const out = [];
    for(const tr of trs){
      const tds = [...tr.querySelectorAll("td")];
      out.push([
        tidy(tds[0]?.textContent),
        tidy(tds[1]?.textContent),
        tidy(tds[2]?.textContent),
        tidy(tds[3]?.textContent),
        tidy(tds[4]?.textContent)
      ]);
    }
    return out;
  }

  // Clamp text to at most 2 lines for Category
  function clampTwoLines(doc, text, availWidth, fontSize, ellipsis="…"){
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, availWidth);
    if (lines.length <= 2) return lines;
    // recompute 2nd line to fit with ellipsis
    const secondFull = [lines[1], ...lines.slice(2)].join(" ");
    let second = doc.splitTextToSize(secondFull, availWidth)[0] || lines[1];
    while (doc.getTextWidth(second + ellipsis) > availWidth && second.length > 0){
      second = second.slice(0,-1);
    }
    return [lines[0], second + ellipsis];
  }

  /* ------------------ export ------------------ */
  async function exportCompatibilityPDF(){
    await ensureLibs();
    const { jsPDF } = window.jspdf;

    let rows = rowsFromData();
    if (!rows.length) rows = rowsFromDOM();
    if (!rows.length){
      alert("No survey data found. Load Partner A and B first.");
      return;
    }

    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Layout metrics
    const M_LEFT=56, M_RIGHT=56, START_Y=84;  // slightly tighter margins
    const INNER_W = pageW - M_LEFT - M_RIGHT;

    // Fixed column widths (sum = INNER_W). Category big; others compact.
    const wCat   = Math.floor(INNER_W * 0.54);
    const wA     = Math.floor(INNER_W * 0.10);
    const wMatch = Math.floor(INNER_W * 0.12);
    const wFlag  = Math.floor(INNER_W * 0.08);
    const wB     = INNER_W - (wCat + wA + wMatch + wFlag);

    const PAD = 8;             // cell padding
    const CAT_FS = 16;         // category font size
    const LINE_H = 1.2;        // line height multiplier

    // Full-page black background
    doc.setFillColor(0,0,0);
    doc.rect(0,0,pageW,pageH,"F");

    // Title
    doc.setTextColor(255,255,255);
    doc.setFontSize(28);
    doc.text("Talk Kink • Compatibility Report", pageW/2, 48, { align:"center" });

    runAutoTable(doc, {
      head: [["Category","Partner A","Match","Flag","Partner B"]],
      body: rows,
      startY: START_Y,
      theme: "plain",
      margin: { left: M_LEFT, right: M_RIGHT },
      tableWidth: INNER_W,
      styles: {
        fontSize: 12,
        cellPadding: PAD,
        overflow: "linebreak",
        halign: "center",
        valign: "middle",
        textColor: [255,255,255],
        fillColor: [0,0,0],
      },
      headStyles: {
        fontStyle: "bold",
        textColor: [255,255,255],
        fillColor: [0,0,0],
        halign: "center"
      },
      columnStyles: {
        0: { cellWidth: wCat,   halign: "left",  fontStyle: "bold" },
        1: { cellWidth: wA,     halign: "center" },
        2: { cellWidth: wMatch, halign: "center" },
        3: { cellWidth: wFlag,  halign: "center" },
        4: { cellWidth: wB,     halign: "center" }
      },
      didParseCell: data => {
        // Paint every cell black/white
        data.cell.styles.fillColor = [0,0,0];
        data.cell.styles.textColor = [255,255,255];

        // Force Category to 2 lines, deduped, with ellipsis
        if (data.section === "body" && data.column.index === 0){
          const clean = tidy(data.cell.text);
          const avail = wCat - (PAD * 2);
          const clamped = clampTwoLines(data.doc, clean, avail, CAT_FS);
          data.cell.text = clamped;
          data.cell.styles.fontSize = CAT_FS;
          data.cell.styles.lineHeight = LINE_H;
        }
      },
      willDrawCell: data => {
        const c = data.cell;
        data.doc.setFillColor(0,0,0);
        data.doc.rect(c.x, c.y, c.width, c.height, "F");
      }
    });

    doc.save("compatibility-report.pdf");
  }

  // Button binding
  function bind(){
    let btn = document.querySelector("#downloadBtn,#downloadPdfBtn,[data-download-pdf]");
    if(!btn){
      btn = document.createElement("button");
      btn.id = "downloadBtn";
      btn.textContent = "Download Compatibility PDF";
      btn.style.cssText = "margin:16px 0;padding:10px 14px;border-radius:8px;border:1px solid #0ff;background:#001014;color:#0ff;cursor:pointer;";
      document.body.appendChild(btn);
    }
    btn.onclick = exportCompatibilityPDF;
    window.exportCompatibilityPDF = exportCompatibilityPDF; // optional manual trigger
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
