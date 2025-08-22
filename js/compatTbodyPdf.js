(function () {
  /* ---------------- 0) Loader ---------------- */
  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.crossOrigin="anonymous";s.referrerPolicy="no-referrer";s.onload=res;s.onerror=()=>rej(new Error("Failed to load "+src));document.head.appendChild(s);});}
  async function ensureLibs(){
    if(!(window.jspdf && window.jspdf.jsPDF)){
      console.log("[PDF] Loading jsPDF…");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
    const hasAuto = (window.jspdf && window.jspdf.autoTable) || (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);
    if(!hasAuto){
      console.log("[PDF] Loading jsPDF-AutoTable…");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    }
    console.log("[PDF] Libraries ready");
  }

  /* ---------------- 1) Helpers ---------------- */
  const THRESH={star:90,flag:60,low:30};
  const ICON={star:"★",flag:"⚑",low:"🚩",blank:""};
  const toNum=v=>{const n=Number(String(v??"").trim());return Number.isFinite(n)?n:null;};
  const matchPct=(a,b)=>{const A=toNum(a),B=toNum(b);if(A==null||B==null)return null;return Math.round(100-(Math.abs(A-B)/5)*100);};
  const iconFor=p=>p==null?ICON.blank:(p>=THRESH.star?ICON.star:(p>=THRESH.flag?ICON.flag:(p<=THRESH.low?ICON.low:ICON.blank)));
  const scaleOf=arr=>{const vals=(arr||[]).map(x=>x?.score).filter(x=>typeof x==="number");if(!vals.length)return 1;const mx=Math.max(...vals),mn=Math.min(...vals);if(mx<=5&&mn>=0)return 1;if(mx<=1&&mn>=0)return 5;if(mx<=7)return 5/7;if(mx<=10)return 5/10;if(mx<=100)return 5/100;return 5/Math.max(5,mx);};

  /* ---------------- 2) Collect rows ---------------- */
  function rowsFromTbody(){
    const tbody = document.querySelector("#compatTbody");
    if(!tbody){ console.warn("[PDF] #compatTbody not found"); return []; }
    const out=[];
    for(const tr of tbody.querySelectorAll("tr")){
      const tds=tr.querySelectorAll("td"); if(!tds.length) continue;
      const cat = tds[0]?.textContent?.trim() || tr.getAttribute("data-kink-id") || "";
      const aTxt = tr.querySelector('td[data-cell="A"]')?.textContent ?? tds[1]?.textContent ?? "";
      const bTxt = tr.querySelector('td[data-cell="B"]')?.textContent ?? tds[tds.length-1]?.textContent ?? "";
      const A=toNum(aTxt), B=toNum(bTxt), P=matchPct(A,B);
      out.push([cat||"—", (A??"—"), (P==null?"—":`${P}%`), iconFor(P), (B??"—")]);
    }
    console.log("[PDF] rowsFromTbody:", out.length);
    return out;
  }

  function rowsFromMemory(){
    const A=(window.partnerAData?.items)||(Array.isArray(window.partnerAData)?window.partnerAData:null);
    const B=(window.partnerBData?.items)||(Array.isArray(window.partnerBData)?window.partnerBData:null);
    if(!A&&!B){ console.warn("[PDF] partnerAData/partnerBData missing"); return []; }
    const sA=scaleOf(A||[]), sB=scaleOf(B||[]);
    const mA=new Map((A||[]).map(i=>[(i.id||i.label),i]));
    const mB=new Map((B||[]).map(i=>[(i.id||i.label),i]));
    const union=new Map(); (A||[]).forEach(i=>union.set(i.id||i.label,i.label||i.id)); (B||[]).forEach(i=>union.set(i.id||i.label,i.label||i.id));
    const out=[];
    for(const [id,label] of union){
      const a=mA.get(id), b=mB.get(id);
      const Ar=(typeof a?.score==="number")?a.score:null;
      const Br=(typeof b?.score==="number")?b.score:null;
      const P=(Ar==null||Br==null)?null:matchPct(Ar*sA,Br*sB);
      out.push([label||id||"—",(Ar??"—"),(P==null?"—":`${P}%`),iconFor(P),(Br??"—")]);
    }
    console.log("[PDF] rowsFromMemory:", out.length);
    return out;
  }

  function selfTestRows(){
    console.warn("[PDF] SELF-TEST MODE — exporting demo rows so you can verify downloads.");
    return [
      ["Choosing outfit for a scene", 5, "100%", "★", 5],
      ["Styling hair (braiding, etc.)", 1, "100%", "★", 1],
      ["Creating themed looks", 0, "100%", "★", 0]
    ];
  }

  function runAutoTable(doc, opts){
    if (typeof doc.autoTable === "function") return doc.autoTable(opts);
    if (window.jspdf && typeof window.jspdf.autoTable === "function") return window.jspdf.autoTable(doc, opts);
    throw new Error("AutoTable not available");
  }

  /* ---------------- 3) Exporter ---------------- */
  async function exportPDF(ev){
    ev?.preventDefault?.();
    try{
      await ensureLibs();

      let rows = rowsFromTbody();
      if(!rows.length) rows = rowsFromMemory();
      if(!rows.length) rows = selfTestRows();

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({orientation:"landscape", unit:"pt", format:"a4"});

      doc.setFontSize(20);
      doc.text("Talk Kink • Compatibility Report", doc.internal.pageSize.width/2, 48, {align:"center"});

      runAutoTable(doc, {
        head: [["Category","Partner A","Match","Flag","Partner B"]],
        body: rows,
        startY: 70,
        styles: { fontSize: 11, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fillColor: [0,0,0], textColor: [255,255,255], fontStyle: "bold" },
        columnStyles: {
          0: { halign:"left",   cellWidth: 560 },
          1: { halign:"center", cellWidth: 80  },
          2: { halign:"center", cellWidth: 90  },
          3: { halign:"center", cellWidth: 60  },
          4: { halign:"center", cellWidth: 80  }
        }
      });

      doc.save("compatibility-report.pdf");
    }catch(err){
      console.error("[PDF] Export failed:", err);
      alert("PDF export failed: "+err.message);
    }
  }

  /* ---------------- 4) Button binding (creates one if missing) ---------------- */
  function getOrCreateButton(){
    const candidates=[
      "#downloadBtn","#downloadPdfBtn","[data-download-pdf]",
      'button[aria-label="Download PDF"]','a[role="button"][href="#download-pdf"]'
    ];
    for(const sel of candidates){ const el=document.querySelector(sel); if(el) return el; }
    // create button if none
    const btn=document.createElement("button");
    btn.id="downloadBtn";
    btn.textContent="Download Compatibility Report (PDF)";
    btn.style.cssText="position:fixed;right:16px;bottom:16px;z-index:999999;padding:.6rem 1rem;border-radius:.5rem";
    document.body.appendChild(btn);
    console.warn("[PDF] No download button found; created one (#downloadBtn) at bottom-right.");
    return btn;
  }

  function bind(){
    const btn = getOrCreateButton();
    btn.removeEventListener("click", exportPDF);
    btn.addEventListener("click", exportPDF, { passive: true });
    console.log("[PDF] Exporter bound →", btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  // Rebind if the app re-renders DOM
  const mo = new MutationObserver(() => bind());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Manual trigger if you want to call from dev console
  window.downloadCompatibilityPDF = exportPDF;
})();
