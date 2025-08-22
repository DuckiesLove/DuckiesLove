(function () {
  /* ---------- CONFIG ---------- */
  const BTN_SELECTORS = ["#downloadBtn", "#downloadPdfBtn", "[data-download-pdf]"];
  const TBODY_SELECTOR = "#compatTbody";
  const THRESH = { star: 90, flag: 60, low: 30 };
  const ICON   = { star: "★", flag: "⚑", low: "🚩", blank: "" }; // Unicode, NOT HTML entities

  /* ---------- helpers ---------- */
  const N = v => { const x = Number(String(v ?? "").trim()); return Number.isFinite(x) ? x : null; };
  const pct = (a,b) => { const A=N(a), B=N(b); if (A==null||B==null) return null; return Math.round(100 - (Math.abs(A-B)/5)*100); };
  const icon = p => p==null ? ICON.blank : (p>=THRESH.star?ICON.star : (p>=THRESH.flag?ICON.flag : (p<=THRESH.low?ICON.low:ICON.blank)));
  const scaleOf = arr => {
    const vals=(arr||[]).map(x=>x?.score).filter(x=>typeof x==="number");
    if(!vals.length) return 1;
    const mx=Math.max(...vals), mn=Math.min(...vals);
    if(mx<=5&&mn>=0) return 1;
    if(mx<=1&&mn>=0) return 5;
    if(mx<=7)  return 5/7;
    if(mx<=10) return 5/10;
    if(mx<=100)return 5/100;
    return 5/Math.max(5,mx);
  };

  /* ---------- rows from DOM (#compatTbody) ---------- */
  function rowsFromTbody(){
    const tbody=document.querySelector(TBODY_SELECTOR);
    if(!tbody) return [];
    const out=[];
    for(const tr of tbody.querySelectorAll("tr")){
      const tds=tr.querySelectorAll("td"); if(!tds.length) continue;
      const cat = tds[0]?.textContent?.trim() || tr.getAttribute("data-kink-id") || "";
      const aTxt= tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? "";
      const bTxt= tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? "";
      const A=N(aTxt), B=N(bTxt), P=pct(A,B);
      out.push([cat||"—", (A??"—"), (P==null?"—":`${P}%`), icon(P), (B??"—")]);
    }
    return out;
  }

  /* ---------- rows from memory (partnerAData/partnerBData) ---------- */
  function rowsFromMemory(){
    const A=(window.partnerAData?.items)||(Array.isArray(window.partnerAData)?window.partnerAData:null);
    const B=(window.partnerBData?.items)||(Array.isArray(window.partnerBData)?window.partnerBData:null);
    if(!A&&!B) return [];
    const sA=scaleOf(A||[]), sB=scaleOf(B||[]);
    const mA=new Map((A||[]).map(i=>[(i.id||i.label),i]));
    const mB=new Map((B||[]).map(i=>[(i.id||i.label),i]));
    const keys=new Map(); (A||[]).forEach(i=>keys.set(i.id||i.label,i.label||i.id)); (B||[]).forEach(i=>keys.set(i.id||i.label,i.label||i.id));
    const out=[];
    for(const [id,label] of keys){
      const a=mA.get(id), b=mB.get(id);
      const Ar=typeof a?.score==="number"?a.score:null;
      const Br=typeof b?.score==="number"?b.score:null;
      const P=(Ar==null||Br==null)?null:pct(Ar*sA,Br*sB);
      out.push([label||id||"—",(Ar??"—"),(P==null?"—":`${P}%`),icon(P),(Br??"—")]);
    }
    return out;
  }

  /* ---------- AutoTable wrapper ---------- */
  function runAutoTable(doc, opts){
    if (typeof doc.autoTable === "function") return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === "function") return window.jspdf.autoTable(doc, opts);
    throw new Error("jsPDF-AutoTable not available. Include the plugin before this script.");
  }

  /* ---------- export ---------- */
  function exportPDF(e){
    e?.preventDefault?.();
    try{
      if(!(window.jspdf && window.jspdf.jsPDF)){ alert("jsPDF not loaded."); return; }

      let rows = rowsFromTbody();
      if(!rows.length) rows = rowsFromMemory();

      if(!rows.length){
        console.warn("[PDF] No rows found in DOM or memory.");
        alert("No data rows found to export. Load both surveys first.");
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({orientation:"landscape", unit:"pt", format:"a4"});

      doc.setFontSize(20);
      doc.text("Talk Kink • Compatibility Report", doc.internal.pageSize.width/2, 48, {align:"center"});

      runAutoTable(doc, {
        head: [["Category","Partner A","Match","Flag","Partner B"]],
        body: rows,
        startY: 70,
        styles: { fontSize: 11, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fillColor:[0,0,0], textColor:[255,255,255], fontStyle:"bold" },
        columnStyles: {
          0:{ halign:"left",   cellWidth: 560 },
          1:{ halign:"center", cellWidth: 80  },
          2:{ halign:"center", cellWidth: 90  },
          3:{ halign:"center", cellWidth: 60  },
          4:{ halign:"center", cellWidth: 80  }
        }
      });

      doc.save("compatibility-report.pdf");
    }catch(err){
      console.error("[PDF] Export failed:", err);
      alert("PDF export failed: " + err.message);
    }
  }

  /* ---------- bind to YOUR existing button ---------- */
  function bindOnce(){
    for (const sel of BTN_SELECTORS){
      const btn = document.querySelector(sel);
      if (btn){
        btn.removeEventListener("click", exportPDF); // avoid double-binding
        btn.addEventListener("click", exportPDF);
        console.log("[PDF] Bound to", sel);
        return true;
      }
    }
    console.warn("[PDF] Download button not found. Expecting one of:", BTN_SELECTORS.join(", "));
    return false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }

  // In case your app re-renders the header/buttons, keep the binding alive.
  const mo = new MutationObserver(() => bindOnce());
  mo.observe(document.body || document.documentElement, { childList:true, subtree:true });
})();
