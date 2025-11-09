/*
================================================================================
BLACK PDF EXPORT (sections intact, no Flag column) + HARD DIAGNOSTICS
================================================================================
HOW TO USE
1) Your page MUST contain: <div id="pdf-container">…</div>
2) Add a button: <button id="downloadBtn">Download PDF</button>
   (or any element with [data-download-pdf])
3) Paste this whole file. Click the button.
4) If it fails, copy the first red error + lines starting with “[pdf] DIAG”.

Toggles
- PDF_DEBUG_SHOW_CLONE = true  → shows a full-screen black preview of the clone.
- STRIP_IMAGES_IN_PDF = true   → removes <img> in the clone (fixes CORS/tainted).
================================================================================
*/

const PDF_DEBUG_SHOW_CLONE = false;
const STRIP_IMAGES_IN_PDF = true;

/* ---------- ensure html2pdf bundle ---------- */
(function ensureHtml2Pdf(){
  if (typeof window !== 'undefined' && !window.html2pdf && document?.head) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html2pdf.js@0.9.3/dist/html2pdf.bundle.min.js';
    s.defer = true;
    document.head.appendChild(s);
  }
})();

/* ---------- inject PDF-only CSS (applies to the CLONE via .pdf-export) ---------- */
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
  .pdf-export .col-category{text-align:left!important;white-space:normal!important}
  .pdf-export .col-a,.pdf-export .col-match,.pdf-export .col-b{text-align:center!important;white-space:nowrap!important}
  `;
  const style = document.createElement('style');
  style.setAttribute('data-pdf-style','true');
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ---------- helpers ---------- */
const diag = (m, o) => console.log('[pdf] DIAG:', m, o ?? '');

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
    if (Date.now()-t0>6000) { diag('timeout waiting for table rows'); break; }
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

function alignCategoryColumn(root){
  root.querySelectorAll('table').forEach(table=>{
    const head = table.querySelector('thead tr');
    if(!head) return;
    const headers = [...head.children];
    const idx = headers.findIndex(th => /^category$/i.test((th.textContent || '').trim()));
    if(idx > -1){
      headers[idx].classList.add('col-category');
      table.querySelectorAll('tbody tr').forEach(tr => {
        const cells = tr.children;
        if(cells[idx]) cells[idx].classList.add('col-category');
      });
    }
  });
}

function stripProblemImages(root){
  if (!STRIP_IMAGES_IN_PDF) return;
  root.querySelectorAll('img').forEach(img => img.remove());
}

function makeClone(){
  const src=document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');
  const r=src.getBoundingClientRect();
  diag('container', { width:r.width, height:r.height, scrollW:src.scrollWidth, scrollH:src.scrollHeight });

  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});

  const clone=src.cloneNode(true);
  clone.classList.add('pdf-export');
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());

  stripHeaderEmoji(clone);
  removeFlagColumn(clone);
  alignCategoryColumn(clone);
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
  diag('clone size', { width, height });
  return { width, height };
}

function plan(width, height){
  const MAX_MP=16;         // cap total rendered pixels
  const defaultScale=2;
  let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6;
  if (mp>MAX_MP) scale=Math.max(1, Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2200;
  const renderedH=height*scale;
  const slices=Math.ceil(renderedH/targetSlicePx);
  diag('render plan', { scale, slices });
  return { scale, slices, targetSlicePx };
}

async function renderTile(root, width, sliceCssHeight, yOffset, scale, html2canvasFn){
  return await html2canvasFn(root, {
    // Force a black canvas background so the export has no white margins.
    backgroundColor:'#000000',
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
    const container=document.getElementById('pdf-container');
    if(!container){ alert('PDF container not found'); return; }

    stripHeaderEmoji(document);
    await waitUntilReady(container);

    // wait for bundle
    if (!window.html2pdf) {
      await new Promise((res,rej)=>{
        let t=0,h=setInterval(()=>{
          if(window.html2pdf){ clearInterval(h); res(); }
          else if((t+=100)>8000){ clearInterval(h); rej(new Error('html2pdf not loaded')); }
        },100);
      });
    }
    const html2canvasFn = window.html2canvas;
    const jsPDFCtor =
      (window.jspdf && window.jspdf.jsPDF) ||
      (window.jsPDF && window.jsPDF.jsPDF) ||
      window.jsPDF;
    diag('libs', { html2pdf:!!window.html2pdf, html2canvas:!!html2canvasFn, jsPDF:!!jsPDFCtor });
    if (!jsPDFCtor) { alert('Could not generate PDF: jsPDF missing'); return; }
    if (!html2canvasFn) { alert('Could not generate PDF: html2canvas missing'); return; }

    const { shell, clone } = makeClone();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const { width, height } = measure(clone);
    const { scale, slices, targetSlicePx } = plan(width, height);

    const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation:'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();

    if (slices <= 1){
      const canvas = await html2canvasFn(clone, {
        // Force a black canvas background so the export has no white margins.
        backgroundColor:'#000000', scale, useCORS:true, allowTaint:true,
        scrollX:0, scrollY:0, windowWidth:width
      });
      const img = canvas.toDataURL('image/png');
      const ratio = canvas.height / canvas.width;
      pdf.addImage(img, 'PNG', 0, 0, pageW, pageW * ratio);
    } else {
      const cssSliceH = Math.ceil(targetSlicePx / scale);
      let y = 0;
      for (let i=0;i<slices;i++){
        const remaining = height - y;
        const sliceH = Math.min(cssSliceH, remaining);
        const canvas = await renderTile(clone, width, sliceH, y, scale, html2canvasFn);
        const img = canvas.toDataURL('image/png');
        const ratio = canvas.height / canvas.width;
        if (i>0) pdf.addPage();
        pdf.addImage(img, 'PNG', 0, 0, pageW, pageW * ratio);
        y += sliceH;
      }
    }

    pdf.save('kink-compatibility.pdf');
    if (!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){
    console.error('[pdf] ERROR:', err);
    alert('Could not generate PDF.\n\n' +
      (err?.message || err?.toString() || 'Unknown error') +
      '\n\nOpen console and copy the latest “[pdf] DIAG …” lines.');
  }
}

/* ---------- aliases + auto-wire button ---------- */
export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;

(function wireBtn(){
  const find = () => document.getElementById('downloadBtn') || document.querySelector('[data-download-pdf]');
  const run = () => {
    const b = find(); if (!b) return diag('no download button');
    const fresh = b.cloneNode(true); b.replaceWith(fresh);
    fresh.addEventListener('click', downloadCompatibilityPDF);
  };
  (document.readyState === 'loading') ? window.addEventListener('DOMContentLoaded', run) : run();
})();
