/*
================================================================================
KINK COMPATIBILITY — RELIABLE BLACK PDF EXPORTER (ALL-IN-ONE)
================================================================================
WHAT THIS DOES
- Clones #pdf-container so your live page stays untouched
- Forces TRUE BLACK background + WHITE text in the clone
- Removes emoji/icons from headers and decorative lines/boxes
- Hardens table layout so rows/columns don't collapse into one long line
- Waits for fonts + table rows before capture (prevents white/blank PDF)
- Uses ADAPTIVE SCALE to avoid memory crashes
- Falls back to TILED RENDERING for tall pages; stitches tiles into a PDF
- Wires a button with id="downloadBtn" or [data-download-pdf] to run export

HOW TO USE (copy/paste these steps to Codex if needed)
1) Ensure your HTML wraps the report with:
   <div id="pdf-container"> ... all your tables/sections ... </div>

2) Ensure you have a button:
   <button id="downloadBtn">Download PDF</button>
   // or: <button data-download-pdf>Download PDF</button>

3) Include this file as /js/pdfDownload.js and import it, OR paste this whole
   script at the end of <body>. It auto-loads html2pdf if missing.

4) Click the button. If you want to SEE the clone overlay before saving, set
   PDF_DEBUG_SHOW_CLONE = true (below), click, verify, then set it back to false.

NOTES
- If your site has super heavy images, consider lazy-loading or removing them
  from the cloned DOM via [data-hide-in-pdf].
- If you still crash on mobile, lower MAX_MP or raise tiling (targetSlicePx).
================================================================================
*/

const PDF_DEBUG_SHOW_CLONE = false; // Set true to preview clone overlay before saving
const STRIP_IMAGES_IN_PDF = true; // Toggle if remote images have no CORS headers

// Log availability of PDF-related libraries
function logPdfEnv(tag = '[pdf]') {
  const hasH2P = !!window.html2pdf;
  const jsPDFCtor =
    (window.jspdf && window.jspdf.jsPDF) ||
    (window.jsPDF && window.jsPDF.jsPDF) ||
    window.jsPDF;
  const hasH2C = !!window.html2canvas;
  console.log(`${tag} libs: html2pdf=${hasH2P} html2canvas=${hasH2C} jsPDF=${!!jsPDFCtor}`);
  return { jsPDFCtor, hasH2P, hasH2C };
}

// --- Ensure html2pdf (bundles html2canvas + jsPDF) is available ---
function ensureHtml2Pdf() {
  if (typeof window !== 'undefined' && !window.html2pdf && document?.head) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html2pdf.js@0.9.3/dist/html2pdf.bundle.min.js';
    s.defer = true;
    document.head.appendChild(s);
  }
}
ensureHtml2Pdf();

// --- Inject minimal PDF styles (applied to the CLONE via .pdf-export) ---
function injectPdfCSS() {
  if (!document?.head || document.querySelector('style[data-pdf-style]')) return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:24px!important;margin:0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:transparent!important;color:#fff!important}
  .pdf-export th,.pdf-export td{border:none!important;background:transparent!important;color:#fff!important;padding:6px 8px!important;line-height:1.25!important;vertical-align:top!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export tr{page-break-inside:avoid!important;break-inside:avoid!important}
  .section-title,.category-header,.compat-category{border:none!important;box-shadow:none!important;background:transparent!important;padding:6px 0!important}
  .category-emoji,.category-header .emoji,.section-title .emoji{display:none!important}
  `;
  const style = document.createElement('style');
  style.setAttribute('data-pdf-style','true');
  style.textContent = css;
  document.head.appendChild(style);
}
injectPdfCSS();

// --- Helpers ---
function stripHeaderEmoji(root = document) {
  const re=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root.querySelectorAll('.section-title,.category-header,.compat-category,th').forEach(n=>{
    const text=(n.textContent||'').replace(re,'').trim();
    if (text) n.textContent=text;
  });
}

function stripProblemImages(root) {
  if (!STRIP_IMAGES_IN_PDF) return;
  root.querySelectorAll('img').forEach(img => {
    img.remove();
  });
}

async function waitUntilRenderReady(container){
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch(_){} }
  const t0=Date.now();
  while(true){
    const hasRows=[...container.querySelectorAll('table tbody')].some(tb=>tb.children?.length>0);
    if (hasRows) break;
    if (Date.now()-t0>6000) { console.warn('[pdf] timeout waiting for table rows'); break; }
    await new Promise(r=>setTimeout(r,100));
  }
  // let layout settle
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}

// Guard against resets that break table layout
function forceTableDisplay(root){
  root.querySelectorAll('table').forEach(el=>el.style.display='table');
  root.querySelectorAll('thead').forEach(el=>el.style.display='table-header-group');
  root.querySelectorAll('tbody').forEach(el=>el.style.display='table-row-group');
  root.querySelectorAll('tr').forEach(el=>el.style.display='table-row');
  root.querySelectorAll('td,th').forEach(el=>el.style.display='table-cell');
}

// Build black shell + clone
function makePdfClone(){
  const src=document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');

  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});

  const clone=src.cloneNode(true);
  clone.classList.add('pdf-export');
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(el=>el.remove());
  stripHeaderEmoji(clone);
  stripProblemImages(clone);

  shell.appendChild(clone);
  document.body.appendChild(shell);

  if (PDF_DEBUG_SHOW_CLONE) {
    Object.assign(shell.style,{position:'fixed',inset:'0',zIndex:'999999'});
    const banner=document.createElement('div');
    banner.textContent='PDF CLONE PREVIEW — press ESC to close';
    Object.assign(banner.style,{position:'sticky',top:'0',padding:'8px 12px',background:'#111',color:'#fff',fontSize:'12px',zIndex:'1000000'});
    shell.prepend(banner);
    window.addEventListener('keydown',e=>{ if(e.key==='Escape') shell.remove(); });
  }

  return { shell, clone };
}

function computeCaptureSize(el){
  const r = el.getBoundingClientRect();
  const width  = Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
  const height = Math.ceil(Math.max(el.scrollHeight, r.height));
  return { width, height };
}

/* Choose safe scale and tiling plan to avoid OOM crashes */
function chooseScaleAndTiling(width, height){
  const MAX_MP = 16;           // cap total pixels (~16 megapixels)
  const defaultScale = 2;
  let scale = defaultScale;
  let mp = (width * height * scale * scale) / 1e6;
  if (mp > MAX_MP) {
    scale = Math.max(1, Math.sqrt((MAX_MP * 1e6) / (width * height)));
  }
  const targetSlicePx = 2200;  // rendered pixels per vertical slice
  const renderedH = height * scale;
  const slices = Math.ceil(renderedH / targetSlicePx);
  return { scale, slices, targetSlicePx };
}

/* Render one vertical tile using html2canvas directly */
async function renderTileToCanvas(root, width, sliceCssHeight, yOffset, scale){
  const h2c = window.html2canvas;
  if (!h2c) {
    console.error('[pdf] html2canvas not found (should be bundled with html2pdf).');
    throw new Error('html2canvas missing');
  }
  return await h2c(root, {
    backgroundColor: '#000',
    scale,
    useCORS: true,
    scrollX: 0, scrollY: 0,
    windowWidth: width,
    windowHeight: sliceCssHeight,
    height: sliceCssHeight,
    y: yOffset
  });
}

/* =============================== MAIN EXPORTER =============================== */
export async function downloadCompatibilityPDF(){
  try{
    const src=document.getElementById('pdf-container');
    if(!src){ alert('PDF container not found'); return; }

    stripHeaderEmoji(document);
    await waitUntilRenderReady(src);

    const { shell, clone } = makePdfClone();
    forceTableDisplay(clone);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    // Wait for library
    if (!window.html2pdf) {
      await new Promise((res,rej)=>{
        let t=0, h=setInterval(()=>{
          if(window.html2pdf){ clearInterval(h); res(); }
          else if((t+=100)>8000){ clearInterval(h); rej(new Error('html2pdf not loaded')); }
        },100);
      });
    }

    const { width, height } = computeCaptureSize(clone);
    const { scale, slices, targetSlicePx } = chooseScaleAndTiling(width, height);
    console.log('[pdf] size=', width, 'x', height, ' scale=', scale.toFixed(2), ' slices=', slices);

    const { jsPDFCtor } = logPdfEnv();
    if (!jsPDFCtor) {
      console.error('[pdf] jsPDF not found: window.jspdf.jsPDF OR window.jsPDF.jsPDF missing.');
      alert('Could not generate PDF: jsPDF library missing.');
      return;
    }
    const pdf = new jsPDFCtor({ unit: 'pt', format: 'letter', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const h2c = window.html2canvas;
    if (!h2c) {
      console.error('[pdf] html2canvas not found (should be bundled with html2pdf).');
      alert('Could not generate PDF: html2canvas missing.');
      return;
    }

    if (slices <= 1) {
      // Single-shot render
      const canvas = await h2c(clone, {
        backgroundColor: '#000',
        scale,
        useCORS: true,
        scrollX: 0, scrollY: 0,
        windowWidth: width
      });
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const ratio = canvas.height / canvas.width;
      const imgW = pageW;
      const imgH = imgW * ratio;
      pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH, undefined, 'FAST');
    } else {
      // Tiled render (multi-page)
      const cssSliceH = Math.ceil(targetSlicePx / scale);
      let y = 0;
      for (let i = 0; i < slices; i++) {
        const remaining = height - y;
        const sliceH = Math.min(cssSliceH, remaining);
        const canvas = await renderTileToCanvas(clone, width, sliceH, y, scale);
        const img = canvas.toDataURL('image/jpeg', 0.9);
        const ratio = canvas.height / canvas.width;
        const imgW = pageW;
        const imgH = imgW * ratio;
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, imgW, imgH, undefined, 'FAST');
        y += sliceH;
      }
    }

    pdf.save('kink-compatibility.pdf');
    if (!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){
    console.error('[pdf] generation failed:', err);
    alert('Could not generate PDF. See console for details.');
  }
}

// Aliases (keep your older calls working)
export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;

// Wire button automatically on DOM ready
function wireBtn(){
  const btn=document.getElementById('downloadBtn')||document.querySelector('[data-download-pdf]');
  if(!btn){ console.warn('[pdf] No download button found. Add id="downloadBtn" or data-download-pdf.'); return; }
  const fresh=btn.cloneNode(true); btn.replaceWith(fresh);
  fresh.addEventListener('click', downloadCompatibilityPDF);
}
if (typeof window !== 'undefined') {
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
  window.addEventListener('DOMContentLoaded', wireBtn);
}
