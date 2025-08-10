// -------- CONFIG
const PDF_DEBUG=false;                // true = show overlay instead of saving
const ORIENTATION="landscape";        // "portrait" | "landscape"
const STAR_MIN=90;                    // ⭐ for match ≥ 90
const RED_FLAG_MAX=50;                // 🚩 for match ≤ 50 (or 4/5 vs no-answer rule below)
const SHORT_TARGET_CHARS=28, SHORT_MAX_WORDS=4;

// -------- SAFETY: libs
function assertLibsOrThrow(){
  const jsPDFCtor=(window.jspdf&&window.jspdf.jsPDF)||(window.jsPDF&&window.jsPDF.jsPDF);
  if(!window.html2canvas) throw new Error("html2canvas missing");
  if(!jsPDFCtor) throw new Error("jsPDF missing");
  return jsPDFCtor;
}

// -------- PDF-only CSS (clone only; web untouched)
(function injectCss(){
  if(document.querySelector("style[data-pdf-style]")) return;
  const css=`
  .pdf-export{background:#000!important;color:#fff!important;padding:18px!important}
  .pdf-export *{max-width:none!important}
  .pdf-export table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
  .pdf-export th,.pdf-export td{padding:7px 10px!important;vertical-align:top!important;border:none!important;color:#fff!important;background:transparent!important}
  /* Final 5-column layout: Category | Partner A | Match | Flag | Partner B */
  .pdf-export tr>*:nth-child(1){width:58%!important;text-align:left!important;white-space:normal!important;word-break:break-word!important}
  .pdf-export tr>*:nth-child(2){width:10%!important;text-align:center!important;white-space:nowrap!important}
  .pdf-export tr>*:nth-child(3){width:10%!important;text-align:center!important;white-space:nowrap!important}
  .pdf-export tr>*:nth-child(4){width:4%!important; text-align:center!important; white-space:nowrap!important} /* Flag slot */
  .pdf-export tr>*:nth-child(5){width:10%!important;text-align:center!important;white-space:nowrap!important}
  .pdf-export thead th{font-weight:800!important;white-space:nowrap!important}
  `;
  const s=document.createElement("style"); s.setAttribute("data-pdf-style","true"); s.textContent=css; document.head.appendChild(s);
})();

/* =============== PDF: prevent cut-off rows + add space at next page =============== */
/* 1) CSS that keeps rows intact and styles our spacer breaks (PDF clone only) */
(function injectPdfBreakCSS(){
  if (document.querySelector('style[data-pdf-breaks]')) return;
  const css = `
    .pdf-export tr, .pdf-export thead, .pdf-export tbody { break-inside: avoid !important; page-break-inside: avoid !important; }
    .pdf-export .pdf-soft-break { width:100% !important; }
  `;
  const s=document.createElement('style');
  s.setAttribute('data-pdf-breaks','true');
  s.textContent=css;
  document.head.appendChild(s);
})();

// -------- helpers
function stripEmoji(root=document){
  const re=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root.querySelectorAll(".section-title,.category-header,.compat-category,th").forEach(n=>{
    const t=(n.textContent||"").replace(re,"").trim(); if(t) n.textContent=t;
  });
}
async function waitReady(container){
  if(document.fonts?.ready){try{await document.fonts.ready;}catch(_){}}
  const t0=Date.now();
  while(true){
    const has=[...container.querySelectorAll("table tbody")].some(tb=>tb.children?.length>0);
    if(has)break;
    if(Date.now()-t0>6000)break;
    await new Promise(r=>setTimeout(r,100));
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
function forceTableDisplay(root){
  root.querySelectorAll("table").forEach(e=>e.style.display="table");
  root.querySelectorAll("thead").forEach(e=>e.style.display="table-header-group");
  root.querySelectorAll("tbody").forEach(e=>e.style.display="table-row-group");
  root.querySelectorAll("tr").forEach(e=>e.style.display="table-row");
  root.querySelectorAll("td,th").forEach(e=>e.style.display="table-cell");
}

// -------- 1) Table normalization: ensure first col is the label (Category), remove any old Flag column
function fixOneTable(table){
  const head=table.querySelector("thead tr"); if(!head) return;
  const rows=table.querySelectorAll("tbody tr"); if(!rows.length) return;

  // remove any pre-existing Flag/Flag-Star header+col (avoid duplicates)
  const hdrs=[...head.children].map(th=>(th.textContent||"").trim().toLowerCase());
  const idxFlag=hdrs.findIndex(h=>/^flag(\/star)?$/.test(h));
  if(idxFlag>-1){ head.children[idxFlag].remove(); rows.forEach(tr=>tr.children[idxFlag]?.remove()); }

  // indices we care about
  const idxCat = hdrs.findIndex(h=>h==="category");
  const idxA   = hdrs.findIndex(h=>/partner\s*a/.test(h));
  const idxM   = hdrs.findIndex(h=>/\bmatch\b/.test(h));
  const idxB   = hdrs.findIndex(h=>/partner\s*b/.test(h));

  // find a likely description column (the non-A/M/B column with text)
  const banned=new Set([idxCat,idxA,idxM,idxB].filter(i=>i>=0));
  let idxDesc=-1;
  for(let i=0;i<hdrs.length;i++){
    if(banned.has(i)) continue;
    let hits=0;
    for(const tr of rows){ const c=tr.children[i]; if(c&&c.textContent.trim()){hits++; if(hits>=Math.ceil(rows.length*0.1)) break; } }
    if(hits){ idxDesc=i; break; }
  }

  const catIndex = idxCat>=0 ? idxCat : 0;
  if(idxDesc>=0 && idxDesc!==catIndex){
    head.children[idxDesc]?.remove();
    rows.forEach(tr=>{
      const cat=tr.children[catIndex], desc=tr.children[idxDesc];
      if(cat&&desc){
        const t=desc.textContent.trim();
        if(t) cat.textContent = cat.textContent.trim() ? (cat.textContent+" — "+t) : t;
        desc.remove();
      }
    });
  }
}

// -------- 2) Insert a narrow Flag cell AFTER the Match % (no header text)
function insertFlagColumn(root){
  root.querySelectorAll("table").forEach(table=>{
    const head=table.querySelector("thead tr"); if(!head) return;
    const hdrs=[...head.children].map(th=>(th.textContent||"").trim().toLowerCase());
    const idxM = hdrs.findIndex(h=>/\bmatch\b/.test(h));
    if(idxM===-1) return;

    // insert blank header after Match
    const th=document.createElement("th"); th.textContent=""; // icon-only column
    head.insertBefore(th, head.children[idxM+1]||null);

    // insert blank td after Match in each row
    table.querySelectorAll("tbody tr").forEach(tr=>{
      const td=document.createElement("td"); td.className="flag-cell"; td.textContent="";
      tr.insertBefore(td, tr.children[idxM+1]||null);
    });
  });
}

// -------- 3) Populate Flag cells from values (⭐/🚩 rules)
function numberFromCell(cell){
  if(!cell) return null;
  const t=cell.textContent.trim();
  if(!t || t==="-" || t==="–" || /^n\/?a$/i.test(t)) return null;
  const n=parseInt(t.replace("%",""),10);
  return Number.isFinite(n)?n:null;
}
function scoreFrom(table, tr, headerRe){
  const ths=[...table.querySelector("thead tr").children];
  const idx=ths.findIndex(th=>headerRe.test((th.textContent||"").trim().toLowerCase()));
  if(idx===-1) return null;
  const c=tr.children[idx]; if(!c) return null;
  const raw=c.textContent.trim(); if(!raw || raw==="-" || raw==="–") return null;
  const n=Number(raw); return Number.isFinite(n)?n:null;
}
function populateFlags(root){
  root.querySelectorAll("table").forEach(table=>{
    const ths=[...table.querySelector("thead tr").children];
    const idxMatch = ths.findIndex(th=>/\bmatch\b/.test((th.textContent||"").trim().toLowerCase()));
    if(idxMatch===-1) return;
    table.querySelectorAll("tbody tr").forEach(tr=>{
      const match = numberFromCell(tr.children[idxMatch]);
      const a = scoreFrom(table,tr,/partner\s*a/);
      const b = scoreFrom(table,tr,/partner\s*b/);

      let icon="";
      if(match!=null && match>=STAR_MIN) icon="⭐";
      const oneHigh = x=>x!=null && x>=4, noAns = x=>x==null || x===0;
      if( (match!=null && match<=RED_FLAG_MAX) || (oneHigh(a)&&noAns(b)) || (oneHigh(b)&&noAns(a)) ){
        icon="🚩";
      }
      const flagCell = tr.querySelector(".flag-cell") || tr.children[idxMatch+1];
      if(flagCell) flagCell.textContent = icon;
    });
  });
}

// -------- 4) Shorten labels across the whole survey (PDF only)
const STOPWORDS=new Set(["a","an","the","and","or","for","to","of","by","on","in","as","with","their","my","our","his","her","its","at","from","into","over","under","than","that","this","those","these","etc","e.g.","eg"]);
function stripParen(s){ return s.replace(/\([^)]*\)/g," ").replace(/\[[^\]]*\]/g," ").replace(/\s+/g," ").trim(); }
function compress(txt, target=SHORT_TARGET_CHARS, maxWords=SHORT_MAX_WORDS){
  const words=stripParen(txt).split(/\s+/);
  const keep=[]; for(const w of words){ if(!STOPWORDS.has(w.toLowerCase())) keep.push(w); if(keep.length>=maxWords) break; }
  const out=(keep.length?keep:words.slice(0,2)).join(" ");
  return out.length<txt.length ? (out.length>target?out.slice(0,target-1).replace(/\s+\S*$/i,"")+"…":out+"…") : out;
}
function shortenSurveyLabels(root){
  root.querySelectorAll("table tbody tr").forEach(tr=>{
    const first=tr.children[0]; if(!first) return;
    const full=(first.textContent||"").trim(); if(!full || full.length<=18) return;
    first.textContent = compress(full);
  });
}

// -------- 5) Build clone, apply fixes, render
function makeClone(){
  const src=document.getElementById("pdf-container");
  if(!src) throw new Error("#pdf-container not found");

  const shell=document.createElement("div");
  Object.assign(shell.style,{background:"#000",color:"#fff",margin:"0",padding:"0",width:"100%",minHeight:"100vh",overflow:"auto"});

  const clone=src.cloneNode(true);
  clone.classList.add("pdf-export");
  clone.querySelectorAll("[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer").forEach(e=>e.remove());
  stripEmoji(clone); forceTableDisplay(clone);

  // normalize each table (merge description->Category, drop any old Flag col)
  clone.querySelectorAll("table").forEach(fixOneTable);

  // add narrow Flag slot after Match and fill it
  insertFlagColumn(clone);
  populateFlags(clone);

  // shorten long labels uniformly
  shortenSurveyLabels(clone);

  document.body.appendChild(shell); shell.appendChild(clone);

  if(PDF_DEBUG){
    Object.assign(shell.style,{position:"fixed",inset:"0",zIndex:"999999"});
    const b=document.createElement("div"); b.textContent="PDF PREVIEW — ESC to close";
    Object.assign(b.style,{position:"sticky",top:"0",padding:"8px 12px",background:"#111",color:"#fff",fontSize:"12px"});
    shell.prepend(b); window.addEventListener("keydown",e=>{ if(e.key==="Escape") shell.remove(); });
  }
  return { shell, clone };
}
/* -------- soft pagination -------- */
function computePageHeightCss({ clone, pdfWidthPt, pdfHeightPt }){
  const cssWidth = Math.ceil(Math.max(clone.scrollWidth, clone.getBoundingClientRect().width, document.documentElement.clientWidth));
  const pageHeightCss = Math.ceil(cssWidth * (pdfHeightPt / pdfWidthPt));
  return { cssWidth, pageHeightCss };
}

function addSoftRowBreaks(clone, pageHeightCss, topPad = 20) {
  const baseTop = clone.getBoundingClientRect().top;
  const rows = Array.from(clone.querySelectorAll('table tbody tr'));
  let pageEnd = pageHeightCss, guard = 6;

  for (const tr of rows) {
    const r = tr.getBoundingClientRect();
    const top = r.top - baseTop, bottom = top + r.height;

    if (bottom > pageEnd - guard) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-soft-break';
      spacer.style.height = `${Math.max(0, Math.ceil((pageEnd - top) + topPad))}px`;
      tr.parentNode.insertBefore(spacer, tr);
      pageEnd += pageHeightCss;
    } else if ((pageEnd - top) < (r.height + guard)) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-soft-break';
      spacer.style.height = `${topPad}px`;
      tr.parentNode.insertBefore(spacer, tr);
      pageEnd += pageHeightCss;
    }
  }
}

function keepCategoryTitlesOnNewPage(clone, pageHeightCss, minHeadingTopSpace = 60, topPad = 24) {
  const baseTop = clone.getBoundingClientRect().top;
  const targets = Array.from(clone.querySelectorAll(
    '.compat-section, .section-title, .category-header, .compat-category, h2, h3'
  ));

  let pageEnd = pageHeightCss, guard = 6;

  for (const el of targets) {
    const r = el.getBoundingClientRect();
    const top = r.top - baseTop;
    const bottom = top + r.height;

    if (bottom > pageEnd - guard) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-soft-break';
      spacer.style.height = `${Math.max(0, Math.ceil((pageEnd - top) + topPad))}px`;
      el.parentNode.insertBefore(spacer, el);
      pageEnd += pageHeightCss;
      continue;
    }

    if ((pageEnd - top) < minHeadingTopSpace) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-soft-break';
      spacer.style.height = `${topPad}px`;
      el.parentNode.insertBefore(spacer, el);
      pageEnd += pageHeightCss;
    }
  }
}

function pageBreakBeforeSections(clone, topPaddingPx = 24){
  clone.querySelectorAll(".compat-section").forEach((sec, i)=>{
    if (i === 0) return;
    const spacer = document.createElement("div");
    spacer.className = "pdf-soft-break";
    spacer.style.height = `${topPaddingPx}px`;
    sec.parentNode.insertBefore(spacer, sec);
  });
}

async function renderMultiPagePDF({ clone, jsPDFCtor, orientation='landscape', jpgQuality=0.95 }) {
  const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const { cssWidth, pageHeightCss } = computePageHeightCss({ clone, pdfWidthPt: pdfW, pdfHeightPt: pdfH });
  pageBreakBeforeSections(clone, 24);
  keepCategoryTitlesOnNewPage(clone, pageHeightCss, 60, 24);
  addSoftRowBreaks(clone, pageHeightCss, 20);

  const totalCssHeight = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));
  const MAX_MP = 18, baseScale = 2;
  let scale = baseScale;
  const firstSliceMP = (cssWidth * pageHeightCss * scale * scale) / 1e6;
  if (firstSliceMP > MAX_MP) {
    scale = Math.max(1, Math.sqrt((MAX_MP*1e6)/(cssWidth*pageHeightCss)));
  }

  let y = 0, page = 0;
  while (y < totalCssHeight) {
    const sliceH = Math.min(pageHeightCss, totalCssHeight - y);
    const canvas = await html2canvas(clone, {
      backgroundColor: '#000',
      scale,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: cssWidth,
      windowHeight: sliceH,
      height: sliceH,
      y
    });
    const img = canvas.toDataURL('image/jpeg', jpgQuality);
    const ratio = canvas.height / canvas.width;
    if (page > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, pdfW, pdfW * ratio, undefined, 'FAST');
    page += 1;
    y += sliceH;
  }
  return pdf;
}

// -------- main
export async function downloadCompatibilityPDF(){
  const jsPDFCtor=assertLibsOrThrow();
  const src=document.getElementById("pdf-container");
  if(!src){ alert("PDF container not found"); return; }
  await waitReady(src);

  const { shell, clone } = makeClone();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  try{
    const pdf = await renderMultiPagePDF({ clone, jsPDFCtor, orientation: ORIENTATION, jpgQuality: 0.95 });
    if(!PDF_DEBUG) pdf.save("kink-compatibility.pdf");
  }catch(err){
    console.error("[pdf] ERROR:",err); alert("Could not generate PDF.\n"+(err?.message||err));
  }finally{
    if(!PDF_DEBUG) document.body.removeChild(shell);
  }
}

// expose
if(typeof window!=='undefined') window.downloadCompatibilityPDF=downloadCompatibilityPDF;

