/* Black PDF export with Category + Flag/Star columns (clone-only; web untouched) */
const PDF_DEBUG_SHOW_CLONE = false;     // set true to preview the clone overlay
const STRIP_IMAGES_IN_PDF = true;       // remove <img> in clone to avoid CORS issues
const PDF_ORIENTATION = 'landscape';
const STAR_MIN = 90;     // ⭐ threshold
const RED_FLAG_MAX = 50; // 🚩 if match ≤ this

function assertLibsOrThrow(){
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
  if (!window.html2canvas) throw new Error('html2canvas missing (load CDN before this file).');
  if (!jsPDFCtor)         throw new Error('jsPDF missing (load CDN before this file).');
  return jsPDFCtor;
}

/* PDF-only CSS — applies ONLY to the cloned .pdf-export tree */
(function injectPdfCSS(){
  if (document.querySelector('style[data-pdf-style]')) return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:16px!important;margin:0!important}
  .pdf-export, .pdf-export * { max-width:none!important; }
  .pdf-export .compat-section{break-inside:avoid-page!important;page-break-inside:avoid!important;margin:0 0 12pt 0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:transparent!important;color:#fff!important}
  .pdf-export th,.pdf-export td{border:none!important;background:transparent!important;color:#fff!important;padding:6px 8px!important;line-height:1.25!important;vertical-align:middle!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export thead th{white-space:nowrap!important;text-align:center!important;font-weight:700!important}
  .pdf-export td:not(:first-child){text-align:center!important;white-space:nowrap!important}
  /* column hints for wide layout */
  .pdf-export .col-cat{width:18%!important;text-align:left!important;white-space:nowrap!important}
  .pdf-export .col-desc{width:52%!important;text-align:left!important;white-space:normal!important}
  .pdf-export .col-flag,.pdf-export .col-a,.pdf-export .col-match,.pdf-export .col-b{width:auto!important}
  `;
  const style=document.createElement('style');
  style.setAttribute('data-pdf-style','true');
  style.textContent=css;
  document.head.appendChild(style);
})();

/* ----- small helpers (read/normalize data) ----- */
function stripHeaderEmoji(root=document){
  const re=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root.querySelectorAll('.section-title,.category-header,.compat-category,th').forEach(n=>{
    const t=(n.textContent||'').replace(re,'').trim();
    if (t) n.textContent=t;
  });
}
async function waitUntilReady(container){
  if (document.fonts?.ready) { try{ await document.fonts.ready; }catch(_){} }
  const t0=Date.now();
  while(true){
    const hasRows=[...container.querySelectorAll('table tbody')].some(tb=>tb.children?.length>0);
    if (hasRows) break;
    if (Date.now()-t0>6000) break;
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
function stripProblemImages(root){
  if (!STRIP_IMAGES_IN_PDF) return;
  root.querySelectorAll('img').forEach(img => img.remove());
}
function findCellByHeader(tr, re){
  const table = tr.closest('table'); const head = table?.querySelector('thead tr'); if (!head) return null;
  const ths = Array.from(head.children);
  const idx = ths.findIndex(th => re.test((th.textContent||'').trim()));
  if (idx === -1) return null;
  return tr.querySelectorAll('td,th')[idx] || null;
}
function parsePercentFromCell(cell){
  if (!cell) return null;
  const m=(cell.textContent||'').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function parseScore1to5(cell){
  if (!cell) return null;
  const raw=(cell.textContent||'').trim();
  if (!raw || raw==='-' || raw==='–' || /^n\/?a$/i.test(raw)) return null;
  const n=Number(raw); return Number.isFinite(n)?n:null;
}
function getMatchPercent(tr){
  if (tr.dataset.match){ const n=Number(tr.dataset.match); if (Number.isFinite(n)) return n; }
  return parsePercentFromCell(findCellByHeader(tr, /match/i));
}
function getPartnerScores(tr){
  const a=parseScore1to5(findCellByHeader(tr, /partner\s*a/i));
  const b=parseScore1to5(findCellByHeader(tr, /partner\s*b/i));
  return { a, b };
}
/* Your red-flag rules */
function isRedFlagRow(tr){
  if (tr.classList.contains('red-flag') || tr.dataset.flag==='red') return true;
  const pct=getMatchPercent(tr); if (pct!=null && pct<=RED_FLAG_MAX) return true;
  const {a,b}=getPartnerScores(tr);
  const oneHigh = x => x!=null && x>=4;
  const noAns   = x => x==null;
  if ((oneHigh(a)&&noAns(b)) || (oneHigh(b)&&noAns(a))) return true;
  return false;
}

function getFlagOrStar(match, scoreA, scoreB){
  if (match != null && match >= STAR_MIN) return '⭐';
  const high = v => v != null && v >= 4;
  const missing = v => v == null || v === '' || v === 0;
  if (match != null && (match <= RED_FLAG_MAX || ((high(scoreA) || high(scoreB)) && (missing(scoreA) || missing(scoreB))))) {
    return '🚩';
  }
  return '';
}

/* ----- Category + Flag/Star columns (clone-only) ----- */
function nearestCategoryNameFor(table){
  let p=table.previousElementSibling;
  while (p && !/H\d/i.test(p.tagName) && !p.classList.contains('section-title') && !p.classList.contains('category-header') && !p.classList.contains('compat-category')) {
    p=p.previousElementSibling;
  }
  return (p && (p.textContent||'').trim()) || '';
}
function ensureCategoryColumn(table){
  const headRow=table.querySelector('thead tr'); if(!headRow) return;
  const ths = Array.from(headRow.children);
  const hasCat = ths.some(th => /^category$/i.test((th.textContent||'').trim()));
  if (hasCat) return;
  const th=document.createElement('th'); th.textContent='Category';
  headRow.insertBefore(th, ths[0]||null);
  table.querySelectorAll('tbody tr').forEach(tr=>{
    const td=document.createElement('td'); td.className='col-cat';
    const first=tr.querySelector('td,th'); tr.insertBefore(td, first||null);
  });
  const name = nearestCategoryNameFor(table);
  if (name) table.querySelectorAll('tbody tr .col-cat').forEach(td => td.textContent=name);
}
function ensureFlagColumn(table){
  const headRow=table.querySelector('thead tr'); if(!headRow) return;
  const ths = Array.from(headRow.children);
  const hasFlag = ths.some(th => /^flag$/i.test((th.textContent||'').trim()));
  if (hasFlag) return;
  const catExists = ths.some(th => /^category$/i.test((th.textContent||'').trim()));
  const insertAfter = catExists ? 1 : 0; // after Category & Description
  const th=document.createElement('th'); th.textContent='Flag';
  headRow.insertBefore(th, ths[insertAfter+1] || null);
  table.querySelectorAll('tbody tr').forEach(tr=>{
    const cells=tr.querySelectorAll('td,th');
    const td=document.createElement('td'); td.className='col-flag';
    tr.insertBefore(td, cells[insertAfter+1] || null);
  });
}
function populateFlagsAndStars(table){
  const headRow=table.querySelector('thead tr'); const ths=Array.from(headRow.children);
  const flagIdx = ths.findIndex(th => /^flag$/i.test((th.textContent||'').trim()));
  if (flagIdx===-1) return;
  table.querySelectorAll('tbody tr').forEach(tr=>{
    const flagCell = tr.querySelectorAll('td,th')[flagIdx]; if (!flagCell) return;
    const pct = getMatchPercent(tr);
    const {a,b} = getPartnerScores(tr);
    flagCell.textContent = getFlagOrStar(pct, a, b);
    flagCell.style.textAlign='center';
  });
}
function normalizeGlyphs(root){
  root.querySelectorAll('td,th').forEach(td=>{
    const raw=td.textContent.trim();
    if (raw==='-'){ td.textContent='–'; td.style.textAlign='center'; }
  });
  root.querySelectorAll('th,td').forEach(el=>{
    const txt=el.textContent.trim();
    if (txt.length<=14 || el.tagName==='TH'){
      el.style.whiteSpace='nowrap'; el.style.textOverflow='ellipsis'; el.style.overflow='hidden';
    }
  });
}

/* ----- Clone builder (does not alter live DOM layout) ----- */
function makeClone(){
  const src=document.getElementById('pdf-container'); if(!src) throw new Error('#pdf-container not found');
  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});
  const clone=src.cloneNode(true); clone.classList.add('pdf-export');

  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());
  stripHeaderEmoji(clone); stripProblemImages(clone); forceTableDisplay(clone);

  // add Category + Flag columns and fill
  clone.querySelectorAll('table').forEach(t=>{
    ensureCategoryColumn(t);
    ensureFlagColumn(t);
    populateFlagsAndStars(t);
  });
  normalizeGlyphs(clone);

  shell.appendChild(clone); document.body.appendChild(shell);
  if (PDF_DEBUG_SHOW_CLONE){
    Object.assign(shell.style,{position:'fixed',inset:'0',zIndex:'999999'});
    const banner=document.createElement('div');
    banner.textContent='PDF CLONE PREVIEW — press ESC to close';
    Object.assign(banner.style,{position:'sticky',top:'0',padding:'8px 12px',background:'#111',color:'#fff',fontSize:'12px',zIndex:'1000000'});
    shell.prepend(banner); window.addEventListener('keydown',e=>{ if(e.key==='Escape') shell.remove(); });
  }
  return { shell, clone };
}

/* ----- sizing/tiling & render ----- */
function measure(el){
  const r=el.getBoundingClientRect();
  const width=Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
  const height=Math.ceil(Math.max(el.scrollHeight, r.height));
  if (width===0 || height===0) throw new Error('Zero-size clone (display:none or empty content)');
  return { width, height };
}
function plan(width, height){
  const MAX_MP=18, defaultScale=2;
  let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6;
  if (mp>MAX_MP) scale=Math.max(1, Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2400, renderedH=height*scale, slices=Math.ceil(renderedH/targetSlicePx);
  return { scale, slices, targetSlicePx };
}
async function renderTile(root, width, sliceCssHeight, yOffset, scale){
  return await html2canvas(root,{
    backgroundColor:'#000', scale, useCORS:true, allowTaint:true,
    scrollX:0, scrollY:0, windowWidth:width, windowHeight:sliceCssHeight,
    height:sliceCssHeight, y:yOffset
  });
}

/* ----- Main export ----- */
export async function downloadCompatibilityPDF(){
  const jsPDFCtor = assertLibsOrThrow();
  try{
    const container=document.getElementById('pdf-container');
    if(!container) throw new Error('PDF container (#pdf-container) not found.');
    await waitUntilReady(container);

    const { shell, clone } = makeClone();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const { width, height } = measure(clone);
    const { scale, slices, targetSlicePx } = plan(width, height);

    const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation:PDF_ORIENTATION });
    const pageW = pdf.internal.pageSize.getWidth();

    if (slices <= 1){
      const canvas = await renderTile(clone, width, height, 0, scale);
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const ratio = canvas.height / canvas.width;
      pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW*ratio, undefined, 'FAST');
    } else {
      const cssSliceH = Math.ceil(targetSlicePx/scale);
      let y=0;
      for (let i=0;i<slices;i++){
        const remaining=height-y, sliceH=Math.min(cssSliceH, remaining);
        const canvas=await renderTile(clone, width, sliceH, y, scale);
        const img=canvas.toDataURL('image/jpeg', 0.9);
        const ratio=canvas.height/canvas.width;
        if (i>0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW*ratio, undefined, 'FAST');
        y+=sliceH;
      }
    }
    pdf.save('kink-compatibility.pdf');
    if (!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){
    console.error('[pdf] ERROR:', err);
    alert('Could not generate PDF.\n' + (err?.message || err) + '\nSee console for details.');
  }
}

/* Aliases + global */
export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;
if (typeof window !== 'undefined') window.downloadCompatibilityPDF = downloadCompatibilityPDF;
