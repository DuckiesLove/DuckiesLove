(function () {
  const LOG=(...a)=>console.log("[TK-PDF]",...a);
  const ERR=(...a)=>console.error("[TK-PDF]",...a);
  const BTN_SELECTORS=["#downloadBtn","#downloadPdfBtn","[data-download-pdf]"];

  /* ------------------ Lazy-load libs ------------------ */
  function inject(src){
    return new Promise((res,rej)=>{
      if(document.querySelector(`script[src="${src}"]`)) return res();
      const s=document.createElement("script");s.src=src;s.async=true;
      s.onload=res;s.onerror=()=>rej(new Error("Failed to load "+src));
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    await new Promise(r=>setTimeout(r,25));
    if(!(window.jspdf&&window.jspdf.jsPDF)) throw new Error("jsPDF not ready");
    if(!((window.jspdf&&window.jspdf.autoTable)||(window.jsPDF&&window.jsPDF.API&&window.jsPDF.API.autoTable))){
      await inject("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    }
  }
  function runAutoTable(doc,opts){
    if(typeof doc.autoTable==="function") return doc.autoTable(opts);
    return window.jspdf.autoTable(doc,opts);
  }

  /* ------------------ DOM helpers ------------------ */
  function getOrCreateButton(){
    for(const sel of BTN_SELECTORS){const el=document.querySelector(sel);if(el)return el;}
    const btn=document.createElement("button");
    btn.id="downloadPdfBtn";
    btn.textContent="Download Compatibility Report (PDF)";
    btn.style.cssText="margin:16px 0;padding:10px 14px;font-size:14px;border-radius:8px;border:1px solid #0ff;background:#001014;color:#0ff;cursor:pointer;";
    const table=getTable();(table?.parentElement||document.body).appendChild(btn);
    return btn;
  }
  function getTable(){
    return document.getElementById("compatibilityTable")
      || document.querySelector('table[aria-label*="compatibility" i]')
      || document.querySelector("table");
  }

  /* ------------------ Data extraction ------------------ */
  const tidy = s => (s||"").replace(/\s+/g," ").trim();
  const toNum = v => { const n = Number(String(v??"").trim()); return Number.isFinite(n)?n:null; };
  const pctFrom = (a,b) => (a==null||b==null) ? null : Math.round(100 - (Math.abs(a-b)/5)*100);
  const flagFor = p => p==null ? "" : (p>=90 ? "★" : (p>=60 ? "⚑" : "⚑"));

  function dedupeCategory(s){
    const t=tidy(s);
    if(!t) return t;
    const seedLen=Math.min(48, Math.max(8, Math.floor(t.length/4)));
    const seed=t.slice(0,seedLen);
    const again=t.indexOf(seed, seedLen);
    return again>0 ? tidy(t.slice(0,again)) : t;
  }
  function findHeaderIdx(table){
    let ths=[...table.querySelectorAll("thead th")];
    if(!ths.length) ths=[...table.querySelectorAll("tr th")];
    const labs=ths.map(th=>tidy(th.textContent).toLowerCase());
    const f=k=>labs.findIndex(x=>x.includes(k));
    return {
      cat: (f("category")>-1?f("category"):0),
      a:   (f("partner a")>-1?f("partner a"):1),
      b:   (f("partner b")>-1?f("partner b"):labs.length-1)
    };
  }
  function collectRows(){
    const table=getTable();if(!table){ERR("No table found.");return[];}
    const idx=findHeaderIdx(table);
    let trs=[...table.querySelectorAll("tbody tr")];
    if(!trs.length)trs=[...table.querySelectorAll("tr")].filter(tr=>tr.querySelectorAll("td").length);
    const out=[];
    for(const tr of trs){
      const tds=[...tr.querySelectorAll("td")];if(!tds.length)continue;
      const catCell=tds[idx.cat]||tds[0];
      const aCell=tr.querySelector('td[data-cell="A"]')||tds[idx.a]||tds[1];
      const bCell=tr.querySelector('td[data-cell="B"]')||tds[idx.b]||tds[tds.length-1];
      const category=dedupeCategory(catCell?.textContent||tr.getAttribute("data-kink-id")||"");
      const A=toNum(aCell?.textContent);const B=toNum(bCell?.textContent);const P=pctFrom(A,B);
      out.push([category||"—",(A??"—"),(P==null?"N/A":`${P}%`),flagFor(P),(B??"—")]);
    }
    return out;
  }

  /* ------------------ Export ------------------ */
  async function exportPDF(){
    try{
      await ensureLibs();
      const { jsPDF }=window.jspdf;
      const rows=collectRows();
      if(!rows.length){alert("No data rows found to export.");return;}
      const doc=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
      doc.setFillColor(0,0,0);
      doc.rect(0,0,doc.internal.pageSize.width,doc.internal.pageSize.height,"F");
      doc.setTextColor(255,255,255);doc.setFontSize(26);
      doc.text("Talk Kink • Compatibility Report",72,70);
      runAutoTable(doc,{
        head:[["Category","Partner A","Match","Flag","Partner B"]],
        body:rows,
        startY:100,
        theme:"plain",
        styles:{fontSize:14,fillColor:[0,0,0],textColor:[255,255,255],halign:"center",valign:"middle"},
        headStyles:{fillColor:[0,0,0],textColor:[255,255,255],fontStyle:"bold",halign:"center"},
        columnStyles:{0:{cellWidth:540,halign:"left",fontStyle:"bold"},1:{cellWidth:100},2:{cellWidth:110},3:{cellWidth:70},4:{cellWidth:100}},
        margin:{left:60,right:60},
        didParseCell:function(data){data.cell.styles.fillColor=[0,0,0];data.cell.styles.textColor=[255,255,255];},
        willDrawCell:function(data){const {cell,doc}=data;doc.setFillColor(0,0,0);doc.rect(cell.x,cell.y,cell.width,cell.height,"F");}
      });
      doc.save("compatibility-report.pdf");
    }catch(e){ERR(e);alert("PDF export failed: "+e.message);}
  }

  window.exportCompatibilityPDF=exportPDF;
  function bind(){const btn=getOrCreateButton();btn.removeEventListener("click",exportPDF);btn.addEventListener("click",exportPDF);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();
