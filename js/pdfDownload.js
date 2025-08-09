/*
Black-background PDF exporter for compatibility report.
- Clones #pdf-container
- Forces black background and white text
- Strips header emoji
- Removes "Flag" column in clone only
- Forces table/thead/tbody/tr/td display
- Uses html2canvas + jsPDF with adaptive scale + tiling
- Logs diagnostic messages with [pdf] DIAG
*/

const PDF_DEBUG_SHOW_CLONE = false;   // set true to preview the clone overlay
const STRIP_IMAGES_IN_PDF   = true;   // remove <img> in clone to avoid CORS/tainted canvas

/* ---------- DIAG ---------- */
const DIAG = (m,o)=>console.log('[pdf] DIAG:', m, o??'');

// Load html2canvas and jsPDF if missing. Avoids relying on html2pdf bundle
// which may not expose the globals we need.
let __pdfLibsPromise;
function loadScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error('Failed to load '+src));
    document.head.appendChild(s);
  });
}
async function ensurePdfLibs(){
  const hasH2c = !!window.html2canvas;
  const hasJsPDF = !!((window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF));
  if (hasH2c && hasJsPDF) return;
  if (!__pdfLibsPromise){
    __pdfLibsPromise = (async()=>{
      if (!document?.head) throw new Error('document.head missing');
      const tasks=[];
      if (!hasH2c) tasks.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'));
      if (!hasJsPDF) tasks.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'));
      await Promise.all(tasks);
    })();
  }
  await __pdfLibsPromise;
}

(async function envCheck(){
  try{ await ensurePdfLibs(); }catch(e){ DIAG('lib load failed', e); }
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
  DIAG('env', {
    html2canvas: !!window.html2canvas,
    jsPDF: !!jsPDFCtor
  });
})();

/* ---------- PDF-only CSS applied to the CLONE via .pdf-export ---------- */
(function injectPdfCSS(){
  if (document.querySelector('style[data-pdf-style]')) return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:24px!important;margin:0!important}
  .pdf-export .compat-section{break-inside: avoid-page!important; page-break-inside: avoid!important; margin: 0 0 18pt 0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:transparent!important;color:#fff!important}
  .pdf-export th,.pdf-export td{border:none!important;background:transparent!important;color:#fff!important;padding:6px 8px!important;line-height:1.25!important;vertical-align:top!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export tr{page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export .section-title,.pdf-export .category-header,.pdf-export .compat-category{border:none!important;box-shadow:none!important;background:transparent!important;padding:6px 0!important}
  .pdf-export .category-emoji,.pdf-export .category-header .emoji,.pdf-export .section-title .emoji{display:none!important}
  `;
  const el = document.createElement('style');
  el.setAttribute('data-pdf-style','true');
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ---------- helpers ---------- */
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
    if (Date.now()-t0>6000) { DIAG('timeout waiting for table rows'); break; }
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

function removeFlagColumn(root){
  root.querySelectorAll('table').forEach(table=>{
    const ths = Array.from(table.querySelectorAll('thead th'));
    if (!ths.length) return;
    const idx = ths.findIndex(th => th.textContent.trim().toLowerCase() === 'flag');
    if (idx === -1) return;
    ths[idx]?.remove();
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells = tr.querySelectorAll('td, th');
      cells[idx]?.remove();
    });
  });
}

function stripProblemImages(root){
  if (!STRIP_IMAGES_IN_PDF) return;
  root.querySelectorAll('img').forEach(img => img.remove());
}

function materializeIndicators(root){
  // A) Convert pseudo-element content to real text
  root.querySelectorAll('*').forEach(el => {
    const before = getComputedStyle(el, '::before').content;
    const after = getComputedStyle(el, '::after').content;
    const addTxt = (txt, cls) => {
      if (!txt || txt === 'none' || txt === 'normal' || txt === '""') return;
      const t = txt.replace(/^"(.*)"$/, '$1');
      const span = document.createElement('span');
      span.textContent = t;
      if (cls) span.className = cls;
      span.style.marginLeft = '4px';
      el.appendChild(span);
    };
    addTxt(before, 'pseudo-before');
    addTxt(after, 'pseudo-after');
  });

  // B) Replace class/data markers with textual symbols
  root.querySelectorAll('td, th').forEach(td => {
    if (td.textContent.trim()) return;
    const c = td.classList;
    if (c.contains('yes') || td.dataset.state === 'yes') {
      td.textContent = '✓';
      td.style.textAlign = 'center';
    } else if (c.contains('no') || td.dataset.state === 'no') {
      td.textContent = '✗';
      td.style.textAlign = 'center';
    } else if (c.contains('dash') || td.dataset.state === 'dash' || c.contains('empty')) {
      td.textContent = '–';
      td.style.textAlign = 'center';
    }
  });
}

function enhancePdfClone(root){
  // 1) Style headers to avoid wrapping
  const ths = root.querySelectorAll('th');
  ths.forEach(th => {
    th.style.whiteSpace = 'nowrap';
    th.style.textOverflow = 'ellipsis';
    th.style.overflow = 'hidden';
    th.style.fontWeight = '600';
    th.style.textAlign = 'center';
    th.style.verticalAlign = 'middle';
  });

  // 2) Apply column width heuristics
  root.querySelectorAll('table').forEach(table => {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const cols = Array.from(headerRow.children);
    const n = cols.length;
    if (n < 3) return;
    const widths = n === 4 ? ['64%','12%','12%','12%'] :
                   n === 5 ? ['55%','15%','10%','10%','10%'] :
                             null;
    if (widths) {
      cols.forEach((th,i) => th.style.width = widths[i]);
      Array.from(table.tBodies || []).forEach(tb => {
        Array.from(tb.rows || []).forEach(tr => {
          Array.from(tr.cells || []).forEach((td,i) => { if (widths[i]) td.style.width = widths[i]; });
        });
      });
    }
  });

  // 3) Turn indicator styles into real text
  materializeIndicators(root);

  // 4) Prevent row splitting across pages
  root.querySelectorAll('tr').forEach(tr => {
    tr.style.pageBreakInside = 'avoid';
    tr.style.breakInside = 'avoid';
  });
}

function makeClone(){
  const src=document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');
  const r=src.getBoundingClientRect();
  DIAG('container', { width:r.width, height:r.height, scrollW:src.scrollWidth, scrollH:src.scrollHeight });

  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});

  const clone=src.cloneNode(true);
  clone.classList.add('pdf-export');
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());

  stripHeaderEmoji(clone);
  removeFlagColumn(clone);
  stripProblemImages(clone);
  forceTableDisplay(clone);

  shell.appendChild(clone);
  document.body.appendChild(shell);

  if (PDF_DEBUG_SHOW_CLONE){
    Object.assign(shell.style,{position:'fixed',inset:'0',zIndex:'999999'});
    const banner=document.createElement('div');
    banner.textContent='PDF CLONE PREVIEW — press ESC to close';
    Object.assign(banner.style,{position:'sticky',top:'0',padding:'8px 12px',background:'#111',color:'#fff',fontSize:'12px',zIndex:'1000000'});
    shell.prepend(banner);
    window.addEventListener('keydown',e=>{ if(e.key==='Escape') shell.remove(); });
  }
  return { shell, clone };
}

function measure(el){
  const r=el.getBoundingClientRect();
  const width  = Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
  const height = Math.ceil(Math.max(el.scrollHeight, r.height));
  if (width===0 || height===0) throw new Error('Zero-size clone (display:none or empty content)');
  DIAG('clone size', { width, height });
  return { width, height };
}

function plan(width, height){
  const MAX_MP=16, defaultScale=2;
  let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6;
  if (mp>MAX_MP) scale=Math.max(1, Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2200;
  const renderedH=height*scale;
  const slices=Math.ceil(renderedH/targetSlicePx);
  DIAG('render plan', { scale, slices });
  return { scale, slices, targetSlicePx };
}

async function renderTile(root, width, sliceCssHeight, yOffset, scale){
  const h2c = window.html2canvas;
  return await h2c(root, {
    backgroundColor:'#000',
    scale,
    useCORS:true,
    allowTaint:true,
    scrollX:0, scrollY:0,
    windowWidth:width,
    windowHeight:sliceCssHeight,
    height:sliceCssHeight,
    y:yOffset
  });
}

/* =========================== MAIN EXPORTER =========================== */
export async function downloadCompatibilityPDF(){
  try{
    await ensurePdfLibs();
    const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF?.jsPDF;
    if (!window.html2canvas) return alert('Could not generate PDF: html2canvas missing (bundle not loaded?).');
    if (!jsPDFCtor)         return alert('Could not generate PDF: jsPDF missing (bundle not loaded?).');

    const container=document.getElementById('pdf-container');
    if(!container){ alert('PDF container not found'); return; }

    stripHeaderEmoji(document);
    await waitUntilReady(container);

    const { shell, clone } = makeClone();
    enhancePdfClone(clone);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const { width, height } = measure(clone);
    const { scale, slices, targetSlicePx } = plan(width, height);

    const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation:'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();

    if (slices <= 1){
      const canvas = await renderTile(clone, width, height, 0, scale);
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const ratio = canvas.height / canvas.width;
      pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW * ratio, undefined, 'FAST');
    } else {
      const cssSliceH = Math.ceil(targetSlicePx / scale);
      let y = 0;
      for (let i=0;i<slices;i++){
        const remaining = height - y;
        const sliceH = Math.min(cssSliceH, remaining);
        const canvas = await renderTile(clone, width, sliceH, y, scale);
        const img = canvas.toDataURL('image/jpeg', 0.9);
        const ratio = canvas.height / canvas.width;
        if (i>0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW * ratio, undefined, 'FAST');
        y += sliceH;
      }
    }

    pdf.save('kink-compatibility.pdf');
    if (!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){
    console.error('[pdf] ERROR:', err);
    alert('Could not generate PDF.\n' + (err?.message || err?.toString() || 'Unknown error') + '\nSee console for [pdf] DIAG lines.');
  }
}

export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;
export { downloadCompatibilityPDF as default };

if (typeof window !== 'undefined') {
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
}

