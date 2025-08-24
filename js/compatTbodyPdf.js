(function(){
  /* ===== Config ===== */
  const BTN_SELECTORS = ["#downloadBtn", "#downloadPdfBtn", "[data-download-pdf]"];
  const ICON   = { star: "⭐", red:"🚩", white:"⚑", blank: "" };

  /* ===== Helpers ===== */
  const toNum = v => {
    const t = String(v ?? "").trim();
    if (t === "" || t === "-") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const matchPct = (a,b) => {
    const A=toNum(a), B=toNum(b);
    if (A==null||B==null) return null;
    return Math.round(100 - Math.abs(A-B)*20);
  };
  const flagFor = (a,b,pct) => {
    if (pct != null && pct >= 90) return ICON.star;
    if ((a != null && a <= 1) || (b != null && b <= 1)) return ICON.red;
    if ((a === 5 && b < 5) || (b === 5 && a < 5)) return ICON.white;
    return ICON.blank;
  };
  const dedupeCategory = text => {
    if (!text) return "";
    const mid = Math.floor(text.length / 2);
    const first = text.slice(0, mid).trim();
    const second = text.slice(mid).trim();
    return first === second ? first : text;
  };
  function runAutoTable(doc, opts){
    if (typeof doc.autoTable === "function") return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === "function") return window.jspdf.autoTable(doc, opts);
    throw new Error("jsPDF-AutoTable not available.");
  }
  async function ensureLibs(){
    const load = src => new Promise((res, rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("Failed to load "+src));document.head.appendChild(s);});
    if (!(window.jspdf && window.jspdf.jsPDF)) await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    if (!((window.jspdf&&window.jspdf.autoTable)||(window.jsPDF&&window.jsPDF.API&&window.jsPDF.API.autoTable)))
      await load("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
  }

  /* ===== Row collectors (more aggressive) ===== */

  // A) Preferred: rows that explicitly carry data-kink-id (anywhere in the document)
  function rowsFromDataKinkId(){
    const trs = Array.from(document.querySelectorAll('tr[data-kink-id]'));
    const out = [];
    for (const tr of trs){
      const tds = tr.querySelectorAll("td");
      if (!tds.length) continue;

      const category = dedupeCategory(tds[0]?.textContent?.trim() || tr.getAttribute("data-kink-id") || "");
      const aTxt = tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? "";
      const bTxt = tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? "";

      const A = toNum(aTxt), B = toNum(bTxt), pct = matchPct(A,B);
      const flag = flagFor(A,B,pct);
      out.push([category || "—", (A ?? "—"), (pct==null ? "—" : `${pct}%`), flag, (B ?? "—")]);
    }
    return out;
  }

  // B) Fallback: ANY table row with >= 3 tds (first=category, last=B, second=A)
  function rowsFromAnyTable(){
    const trs = Array.from(document.querySelectorAll("table tr")).filter(tr => tr.querySelectorAll("td").length >= 3);
    const out = [];
    for (const tr of trs){
      const tds = tr.querySelectorAll("td");
      const category = dedupeCategory(tds[0]?.textContent?.trim());
      if (!category) continue; // skip empty/section rows

      const aTxt = tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? "";
      const bTxt = tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? "";
      const A = toNum(aTxt), B = toNum(bTxt), pct = matchPct(A,B);
      const flag = flagFor(A,B,pct);
      out.push([category, (A ?? "—"), (pct==null ? "—" : `${pct}%`), flag, (B ?? "—")]);
    }
    return out;
  }

  // C) Memory fallback
  function rowsFromMemory(){
    const A = (window.partnerAData?.items) || (Array.isArray(window.partnerAData) ? window.partnerAData : null);
    const B = (window.partnerBData?.items) || (Array.isArray(window.partnerBData) ? window.partnerBData : null);
    if (!A && !B) return [];

    const mA = new Map((A||[]).map(i=>[(i.id||i.label), i]));
    const mB = new Map((B||[]).map(i=>[(i.id||i.label), i]));
    const keys = new Map(); (A||[]).forEach(i=>keys.set(i.id||i.label, i.label||i.id)); (B||[]).forEach(i=>keys.set(i.id||i.label, i.label||i.id));

    const out = [];
    for (const [id,label] of keys){
      const a=mA.get(id), b=mB.get(id);
      const Araw = toNum(a?.score), Braw = toNum(b?.score);
      const pct = matchPct(Araw, Braw);
      const flag = flagFor(Araw,Braw,pct);
      out.push([label || id || "—", (Araw ?? "—"), (pct==null ? "—" : `${pct}%`), flag, (Braw ?? "—")]);
    }
    return out;
  }

  // Collect rows with a brief retry (in case your UI renders after the click)
  function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
  async function collectRows(){
    // Try explicit data-kink-id first
    let rows = rowsFromDataKinkId();
    if (rows.length) { console.log("[PDF] Using rowsFromDataKinkId:", rows.length); return rows; }

    // Retry once after calling updateComparison (if present)
    if (typeof window.updateComparison === "function") { try { window.updateComparison(); } catch {} }
    await delay(100);
    rows = rowsFromDataKinkId();
    if (rows.length) { console.log("[PDF] Using rowsFromDataKinkId after retry:", rows.length); return rows; }

    // Fallback to any table rows
    rows = rowsFromAnyTable();
    if (rows.length) { console.log("[PDF] Using rowsFromAnyTable:", rows.length); return rows; }

    // Memory fallback
    rows = rowsFromMemory();
    if (rows.length) { console.log("[PDF] Using rowsFromMemory:", rows.length); return rows; }

    return [];
  }

  /* ===== Exporter ===== */
  async function exportPDF(e){
    e?.preventDefault?.();
    try{
      await ensureLibs();

      const rows = await collectRows();
      if (!rows.length){
        alert("No data rows found to export. Make sure the comparison table is visible or the partner data is loaded.");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Light page background with dark text
      doc.setFillColor(255,255,255);
      doc.rect(0,0,doc.internal.pageSize.width,doc.internal.pageSize.height,'F');
      doc.setTextColor(0,0,0);
      doc.setFontSize(16);
      doc.text("Talk Kink • Compatibility Report", 14, 15);

      runAutoTable(doc, {
        head: [["Category","Partner A","Match","Flag","Partner B"]],
        body: rows,
        startY: 20,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellWidth: 'wrap',
          halign: 'center',
          valign: 'middle',
          fillColor: [255,255,255],
          textColor: [0,0,0],
          fontStyle: 'normal'
        },
        headStyles: { fillColor:[255,255,255], textColor:[0,0,0], fontStyle:'bold' },
        columnStyles: {
          0:{ cellWidth:70, halign:'left' },
          1:{ cellWidth:20 },
          2:{ cellWidth:20 },
          3:{ cellWidth:15 },
          4:{ cellWidth:20 }
        },
        didParseCell: data => {}
      });

      doc.save("compatibility_report.pdf");
    }catch(err){
      console.error("[PDF] Export failed:", err);
      alert("PDF export failed: " + err.message);
    }
  }

  /* ===== Bind to your existing button ===== */
  function bind(){
    for (const sel of BTN_SELECTORS){
      const btn = document.querySelector(sel);
      if (btn){
        btn.removeEventListener("click", exportPDF);
        btn.addEventListener("click", exportPDF);
        console.log("[PDF] Bound to", sel);
        return;
      }
    }
    console.warn("[PDF] Download button not found. Looking for:", BTN_SELECTORS.join(", "));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  // Keep binding alive for SPA re-renders
  const mo = new MutationObserver(bind);
  mo.observe(document.documentElement, { childList:true, subtree:true });
})();
