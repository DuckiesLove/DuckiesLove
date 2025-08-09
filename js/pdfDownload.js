/* Black PDF, full width, with Category + Flag/Star and robust data mapping */
const PDF_DEBUG_SHOW_CLONE=false;
const STRIP_IMAGES_IN_PDF=true;
const PDF_ORIENTATION='landscape';
const STAR_MIN=90;          // ⭐ ≥ 90%
const RED_FLAG_MAX=50;      // 🚩 ≤ 50% or “4/5 vs no-answer”

function assertLibsOrThrow(){
  const jsPDFCtor=(window.jspdf&&window.jspdf.jsPDF)||(window.jsPDF&&window.jsPDF.jsPDF);
  if(!window.html2canvas)throw new Error('html2canvas missing (load CDN first)');
  if(!jsPDFCtor)throw new Error('jsPDF missing (load CDN first)');
  return jsPDFCtor;
}

/* PDF-only CSS (applies only to the clone) */
(function(){
  if(document.querySelector('style[data-pdf-style]'))return;
  const css=`
  .pdf-export{background:#000!important;color:#fff!important;padding:16px!important;margin:0!important}
  .pdf-export, .pdf-export * { max-width:none!important; }
  .pdf-export .compat-section{break-inside:avoid-page!important;page-break-inside:avoid!important;margin:0 0 10pt 0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:transparent!important;color:#fff!important}
  .pdf-export thead th{font-weight:800!important;text-align:center!important;white-space:nowrap!important}
  .pdf-export th,.pdf-export td{border:none!important;padding:7px 10px!important;line-height:1.25!important;vertical-align:middle!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export td{text-align:center!important;white-space:nowrap!important}
  .pdf-export .col-cat{width:18%!important;text-align:left!important;white-space:nowrap!important}
  .pdf-export .col-desc{width:54%!important;text-align:left!important;white-space:normal!important}
  .pdf-export .col-flag{width:6%!important}
  .pdf-export .col-a,.pdf-export .col-match,.pdf-export .col-b{width:7%!important}
  `;
  const s=document.createElement('style'); s.setAttribute('data-pdf-style','true'); s.textContent=css; document.head.appendChild(s);
})();

/* ===== helpers ===== */
function stripHeaderEmoji(root=document){
  const re=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root.querySelectorAll('.section-title,.category-header,.compat-category,th').forEach(n=>{
    const t=(n.textContent||'').replace(re,'').trim(); if(t) n.textContent=t;
  });
}
async function waitUntilReady(container){
  if(document.fonts?.ready){try{await document.fonts.ready;}catch(_){}} 
  const t0=Date.now();
  while(true){
    const hasRows=[...container.querySelectorAll('table tbody')].some(tb=>tb.children?.length>0);
    if(hasRows)break;
    if(Date.now()-t0>6000)break;
    await new Promise(r=>setTimeout(r,100));
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
function forceTableDisplay(root){
  root.querySelectorAll('table').forEach(e=>e.style.display='table');
  root.querySelectorAll('thead').forEach(e=>e.style.display='table-header-group');
  root.querySelectorAll('tbody').forEach(e=>e.style.display='table-row-group');
  root.querySelectorAll('tr').forEach(e=>e.style.display='table-row');
  root.querySelectorAll('td,th').forEach(e=>e.style.display='table-cell');
}
function stripProblemImages(root){ if(!STRIP_IMAGES_IN_PDF)return; root.querySelectorAll('img').forEach(i=>i.remove()); }

/* ===== data reading & mapping ===== */
function findCellByHeader(tr,re){
  const head=tr.closest('table')?.querySelector('thead tr'); if(!head) return null;
  const ths=[...head.children]; const idx=ths.findIndex(th=>re.test((th.textContent||'').trim()));
  if(idx===-1) return null;
  return tr.querySelectorAll('td,th')[idx]||null;
}
function numberOrNull(v){ const n=Number(v); return Number.isFinite(n)?n:null; }
function textOrNull(v){ const t=(v??'').toString().trim(); return t.length?t:null; }

function parsePercent(cell){
  if(!cell) return null;
  const m=(cell.textContent||'').match(/\d+(\.\d+)?/);
  return m?Number(m[0]):null;
}
function parseScore1to5(cell){
  if(!cell) return null;
  const raw=(cell.textContent||'').trim();
  if(!raw || raw==='-' || raw==='–' || /^n\/?a$/i.test(raw)) return null; // no answer
  const n=Number(raw); return Number.isFinite(n)?n:null;
}

/* read Partner A/Match/Partner B from EITHER text OR data-* */
function readRowValues(tr){
  // 1) from data-* on the row (preferred)
  let a = numberOrNull(tr.dataset.partnerA ?? tr.dataset.a);
  let b = numberOrNull(tr.dataset.partnerB ?? tr.dataset.b);
  let m = numberOrNull(tr.dataset.match);

  // 2) from cell data-* (e.g., <td class="a" data-val="4"></td>)
  const cellA=findCellByHeader(tr,/partner\s*a/i);
  const cellB=findCellByHeader(tr,/partner\s*b/i);
  const cellM=findCellByHeader(tr,/match/i);

  if(a==null) a = numberOrNull(cellA?.dataset?.val);
  if(b==null) b = numberOrNull(cellB?.dataset?.val);
  if(m==null) m = numberOrNull(cellM?.dataset?.val);

  // 3) from visible text
  if(a==null) a = parseScore1to5(cellA);
  if(b==null) b = parseScore1to5(cellB);
  if(m==null) m = parsePercent(cellM);

  return {a,b,m};
}

/* your red-flag rules */
function isRedFlagRow(tr,{a,b,m}){
  if(tr.classList.contains('red-flag') || tr.dataset.flag==='red') return true;
  if(m!=null && m<=RED_FLAG_MAX) return true;
  const oneHigh = x=>x!=null && x>=4;
  const noAns   = x=>x==null;
  return (oneHigh(a)&&noAns(b)) || (oneHigh(b)&&noAns(a));
}

/* ===== Category + Flag/Star columns (clone only) ===== */
function nearestCategoryNameFor(table){
  let p=table.previousElementSibling;
  while(p && !/H\d/i.test(p.tagName) && !p.classList.contains('section-title') && !p.classList.contains('category-header') && !p.classList.contains('compat-category')) p=p.previousElementSibling;
  return (p && (p.textContent||'').trim()) || '';
}
function ensureCategoryColumn(table){
  const head=table.querySelector('thead tr'); if(!head) return;
  const ths=[...head.children];
  const has=ths.some(th=>/^category$/i.test((th.textContent||'').trim()));
  if(has) return;
  const th=document.createElement('th'); th.textContent='Category';
  head.insertBefore(th, ths[0]||null);
  table.querySelectorAll('tbody tr').forEach(tr=>{
    const td=document.createElement('td'); td.className='col-cat';
    const first=tr.querySelector('td,th'); tr.insertBefore(td, first||null);
  });
  const name=nearestCategoryNameFor(table);
  if(name) table.querySelectorAll('tbody tr .col-cat').forEach(td=>td.textContent=name);
}
function ensureFlagColumn(table){
  const head=table.querySelector('thead tr'); if(!head) return;
  const ths=[...head.children];
  const has=ths.some(th=>/^flag$/i.test((th.textContent||'').trim()));
  if(has) return;
  // place after Category and Description
  const catExists = ths.some(th=>/^category$/i.test((th.textContent||'').trim()));
  const insertAfter = catExists ? 1 : 0;
  const th=document.createElement('th'); th.textContent='Flag';
  head.insertBefore(th, ths[insertAfter+1]||null);
  table.querySelectorAll('tbody tr').forEach(tr=>{
    const cells=tr.querySelectorAll('td,th');
    const td=document.createElement('td'); td.className='col-flag';
    tr.insertBefore(td, cells[insertAfter+1]||null);
  });
}
function populateFlagsStarsAndMapValues(table){
  const head=table.querySelector('thead tr'); if(!head) return;
  const ths=[...head.children];

  const idx = {
    cat : ths.findIndex(th=>/^category$/i.test((th.textContent||'').trim())),
    desc: 0 + (ths.findIndex(th=>/^category$/i.test((th.textContent||'').trim()))>-1 ? 1 : 0),
    flag: ths.findIndex(th=>/^flag$/i.test((th.textContent||'').trim())),
    a   : ths.findIndex(th=>/partner\s*a/i.test((th.textContent||'').trim())),
    match:ths.findIndex(th=>/match/i.test((th.textContent||'').trim())),
    b   : ths.findIndex(th=>/partner\s*b/i.test((th.textContent||'').trim()))
  };

  table.querySelectorAll('tbody tr').forEach(tr=>{
    // Map values into empty cells if they’re not text yet
    const cells=tr.querySelectorAll('td,th');
    const {a,b,m}=readRowValues(tr);

    // Write numbers/percent only if cell has no text
    if(idx.a>-1 && cells[idx.a] && !cells[idx.a].textContent.trim() && a!=null) cells[idx.a].textContent=String(a);
    if(idx.b>-1 && cells[idx.b] && !cells[idx.b].textContent.trim() && b!=null) cells[idx.b].textContent=String(b);
    if(idx.match>-1 && cells[idx.match] && !cells[idx.match].textContent.trim() && m!=null) cells[idx.match].textContent=`${m}%`;

    // Flag/Star
    if(idx.flag>-1 && cells[idx.flag]){
      const red = isRedFlagRow(tr,{a,b,m});
      const star = m!=null && m>=STAR_MIN;
      cells[idx.flag].textContent = red ? '🚩' : (star ? '⭐' : '');
    }
  });
}

/* normalize glyphs and wrapping */
function normalizeGlyphs(root){
  root.querySelectorAll('td,th').forEach(td=>{
    const raw=td.textContent.trim();
    if(raw==='-'){ td.textContent='–'; td.style.textAlign='center'; }
  });
  root.querySelectorAll('th,td').forEach(el=>{
    const short = el.tagName==='TH' || el.textContent.trim().length<=14;
    if(short){ el.style.whiteSpace='nowrap'; el.style.textOverflow='ellipsis'; el.style.overflow='hidden'; }
  });
}

/* ===== clone build ===== */
function makeClone(){
  const src=document.getElementById('pdf-container'); if(!src) throw new Error('#pdf-container not found');
  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});
  const clone=src.cloneNode(true); clone.classList.add('pdf-export');

  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());
  stripHeaderEmoji(clone); stripProblemImages(clone); forceTableDisplay(clone);

  // Category + Flag columns and value mapping
  clone.querySelectorAll('table').forEach(t=>{
    ensureCategoryColumn(t);
    ensureFlagColumn(t);
    populateFlagsStarsAndMapValues(t);
  });
  normalizeGlyphs(clone);

  shell.appendChild(clone); document.body.appendChild(shell);

  if(PDF_DEBUG_SHOW_CLONE){
    Object.assign(shell.style,{position:'fixed',inset:'0',zIndex:'999999'});
    const banner=document.createElement('div'); banner.textContent='PDF CLONE PREVIEW — press ESC to close';
    Object.assign(banner.style,{position:'sticky',top:'0',padding:'8px 12px',background:'#111',color:'#fff',fontSize:'12px',zIndex:'1000000'});
    shell.prepend(banner); window.addEventListener('keydown',e=>{ if(e.key==='Escape') shell.remove(); });
  }
  return {shell,clone};
}

/* sizing/tiling + render */
function measure(el){
  const r=el.getBoundingClientRect();
  const width=Math.ceil(Math.max(el.scrollWidth,r.width,document.documentElement.clientWidth));
  const height=Math.ceil(Math.max(el.scrollHeight,r.height));
  if(width===0||height===0) throw new Error('Zero-size clone');
  return {width,height};
}
function plan(width,height){
  const MAX_MP=18, defaultScale=2; let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6; if(mp>MAX_MP) scale=Math.max(1,Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2400, renderedH=height*scale, slices=Math.ceil(renderedH/targetSlicePx);
  return {scale,slices,targetSlicePx};
}
async function renderTile(root,width,sliceCssHeight,yOffset,scale){
  return await html2canvas(root,{backgroundColor:'#000',scale,useCORS:true,allowTaint:true,scrollX:0,scrollY:0,windowWidth:width,windowHeight:sliceCssHeight,height:sliceCssHeight,y:yOffset});
}

/* main */
export async function downloadCompatibilityPDF(){
  const jsPDFCtor=assertLibsOrThrow();
  try{
    const container=document.getElementById('pdf-container'); if(!container) throw new Error('#pdf-container not found');
    await waitUntilReady(container);

    const {shell,clone}=makeClone();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const {width,height}=measure(clone);
    const {scale,slices,targetSlicePx}=plan(width,height);

    const pdf=new jsPDFCtor({unit:'pt',format:'letter',orientation:PDF_ORIENTATION});
    const pageW=pdf.internal.pageSize.getWidth();

    if(slices<=1){
      const canvas=await renderTile(clone,width,height,0,scale);
      const img=canvas.toDataURL('image/jpeg',0.92); const ratio=canvas.height/canvas.width;
      pdf.addImage(img,'JPEG',0,0,pageW,pageW*ratio,undefined,'FAST');
    }else{
      const cssSliceH=Math.ceil(targetSlicePx/scale); let y=0;
      for(let i=0;i<slices;i++){
        const remaining=height-y, sliceH=Math.min(cssSliceH,remaining);
        const canvas=await renderTile(clone,width,sliceH,y,scale);
        const img=canvas.toDataURL('image/jpeg',0.9); const ratio=canvas.height/canvas.width;
        if(i>0) pdf.addPage(); pdf.addImage(img,'JPEG',0,0,pageW,pageW*ratio,undefined,'FAST'); y+=sliceH;
      }
    }
    pdf.save('kink-compatibility.pdf');
    if(!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){ console.error('[pdf] ERROR:',err); alert('Could not generate PDF.\n'+(err?.message||err)+'\nSee console for details.'); }
}

/* aliases + global */
export const exportToPDF=downloadCompatibilityPDF;
export const exportCompatPDF=downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF=downloadCompatibilityPDF;
export const generateCompatibilityPDF=downloadCompatibilityPDF;
if(typeof window!=='undefined') window.downloadCompatibilityPDF=downloadCompatibilityPDF;

