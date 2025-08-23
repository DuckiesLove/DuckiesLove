(function () {
  /* ---------- lazy-load deps if missing ---------- */
  function load(src){
    return new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`)) return res();
      const s=document.createElement("script");
      s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    if(!(window.jspdf && window.jspdf.jsPDF)){
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
    if(!((window.jspdf&&window.jspdf.autoTable)||(window.jsPDF&&window.jsPDF.API&&window.jsPDF.API.autoTable))){
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    }
  }
  function runAutoTable(doc, opts){
    if(typeof doc.autoTable==="function") return doc.autoTable(opts);
    return window.jspdf.autoTable(doc, opts);
  }

  /* ---------- helpers ---------- */
  const tidy = s => String(s||"").replace(/\s+/g," ").trim();
  const toNum = v => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : null; };
  const pct = (a,b)=> (a==null||b==null) ? null : Math.round(100 - (Math.abs(a-b)/5)*100);
  const flag = p => p==null ? "" : (p>=90 ? "★" : (p>=60 ? "⚑" : "🚩"));

  // clamp Category to 2 lines with ellipsis
  function clamp2(doc, text, width, fontSize){
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, width);
    if(lines.length<=2) return lines;
    const merged = [lines[1], ...lines.slice(2)].join(" ");
    let second = doc.splitTextToSize(merged, width)[0] || lines[1];
    while(doc.getTextWidth(second + "…") > width && second.length>0){ second = second.slice(0,-1); }
    return [lines[0], second + "…"];
  }

  // build rows **from data** (preferred, avoids duplicated DOM text)
  function rowsFromData(){
    const A=(window.partnerAData?.items) || (Array.isArray(window.partnerAData)?window.partnerAData:null);
    const B=(window.partnerBData?.items) || (Array.isArray(window.partnerBData)?window.partnerBData:null);
    if(!A && !B) return [];

    const map=new Map(); // key -> {label,A,B}
    const put=(arr,isA)=> (arr||[]).forEach(it=>{
      const key = it.id || it.label || "";
      const label = tidy(it.label || it.id || "");
      const score = toNum(it.score ?? it.value ?? it.rating);
      if(!map.has(key)) map.set(key,{label,A:null,B:null});
      if(isA) map.get(key).A = score; else map.get(key).B = score;
    });
    put(A,true); put(B,false);

    return [...map.values()]
      .sort((x,y)=>x.label.localeCompare(y.label,undefined,{sensitivity:"base"}))
      .map(r=>{ const p=pct(r.A,r.B); return [r.label||"—", r.A??"—", p==null?"—":`${p}%`, flag(p), r.B??"—"]; });
  }

  // last-resort fallback (DOM) if data missing
  function rowsFromDOM(){
    const table=document.getElementById("compatibilityTable") || document.querySelector("table");
    if(!table) return [];
    const trs=[...table.querySelectorAll("tbody tr")].filter(tr=>tr.querySelectorAll("td").length);
    return trs.map(tr=>{
      const tds=[...tr.querySelectorAll("td")];
      return [tidy(tds[0]?.textContent), tidy(tds[1]?.textContent), tidy(tds[2]?.textContent), tidy(tds[3]?.textContent), tidy(tds[4]?.textContent)];
    });
  }

  async function exportCompatibilityPDF(){
    await ensureLibs();
    const { jsPDF } = window.jspdf;

    let rows = rowsFromData();
    if(!rows.length) rows = rowsFromDOM();
    if(!rows.length){ alert("No survey data found. Load Partner A and Partner B first."); return; }

    // --- PAGE & LAYOUT ---
    const doc = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    const M = { top: 64, left: 52, right: 52, bottom: 48 };
    const INNER_W = W - M.left - M.right;

    // column widths (sum <= INNER_W). Category wide; others locked.
    const wCat   = Math.floor(INNER_W * 0.59);
    const wA     = 72;
    const wMatch = 88;
    const wFlag  = 64;
    const wB     = INNER_W - (wCat + wA + wMatch + wFlag);
    const BODY_FS = 12;
    const CAT_FS  = 16;

    // black page
    doc.setFillColor(0,0,0); doc.rect(0,0,W,H,"F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(28);
    doc.text("Talk Kink • Compatibility Report", W/2, 42, {align:"center"});

    runAutoTable(doc, {
      head: [["Category","Partner A","Match","Flag","Partner B"]],
      body: rows,
      startY: M.top,
      margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
      theme: "plain",
      tableWidth: INNER_W,
      styles: {
        fontSize: BODY_FS,
        overflow: "linebreak",
        cellPadding: 8,
        halign: "center",
        valign: "middle",
        textColor: [255,255,255],
        fillColor: [0,0,0],
      },
      headStyles: {
        fontSize: 14,
        fontStyle: "bold",
        textColor: [255,255,255],
        fillColor: [0,0,0],
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: wCat,   halign: "left"  },
        1: { cellWidth: wA,     halign: "center"},
        2: { cellWidth: wMatch, halign: "center"},
        3: { cellWidth: wFlag,  halign: "center"},
        4: { cellWidth: wB,     halign: "center"},
      },
      didParseCell: data => {
        // enforce black fill & white text everywhere
        data.cell.styles.fillColor = [0,0,0];
        data.cell.styles.textColor = [255,255,255];

        // clamp Category to TWO lines, larger font
        if(data.section==="body" && data.column.index===0){
          const clean = tidy(Array.isArray(data.cell.text)?data.cell.text.join(" "):data.cell.text);
          const usable = wCat - (data.cell.styles.cellPadding*2);
          const clamped = clamp2(data.doc, clean, usable, CAT_FS);
          data.cell.text = clamped;
          data.cell.styles.fontSize = CAT_FS;
          data.cell.styles.lineHeight = 1.18;
        }
      },
      willDrawCell: (data) => {
        const c = data.cell;
        data.doc.setFillColor(0,0,0);
        data.doc.rect(c.x, c.y, c.width, c.height, "F");
      },
      // prevent AutoTable from auto-squeezing widths (keeps alignment)
      horizontalPageBreak: true
    });

    doc.save("compatibility-report.pdf");
  }

  // bind to existing button (or create one)
  function bind(){
    let btn = document.querySelector("#downloadBtn,#downloadPdfBtn,[data-download-pdf]");
    if(!btn){
      btn = document.createElement("button");
      btn.id = "downloadBtn";
      btn.textContent = "Download Compatibility PDF";
      btn.style.cssText="margin:14px 0;padding:10px 14px;border-radius:10px;border:1px solid #0ff;background:#001014;color:#0ff;cursor:pointer;";
      document.body.appendChild(btn);
    }
    btn.addEventListener("click", exportCompatibilityPDF);
    window.exportCompatibilityPDF = exportCompatibilityPDF; // optional manual trigger
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
