/*
================================================================================
pdfDownload.js — Black PDF export (sections intact, NO "Flag" column)
Fixes: header wrapping ("Partne r B") + placeholder "-" cells in PDF
Requires (load these BEFORE this file in your HTML):
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

How it works
- Clones #pdf-container (web stays untouched)
- Forces true black background + white text on the clone
- Removes header emoji/icons and the entire "Flag" column (header + cells)
- Prevents header/cell wrapping (nowrap) so "Partner B" won't split
- Materializes marks so html2canvas sees actual characters (✓ ✗ –) instead of CSS/pseudo
- Locks table/row/cell display (no “single long line” bug)
- Adaptive scale + vertical tiling for tall pages (avoids crashes)

Call: downloadCompatibilityPDF()
================================================================================
*/

const PDF_DEBUG_SHOW_CLONE = false; // set true to preview the clone overlay instead of downloading
const STRIP_IMAGES_IN_PDF = true;   // remove <img> in the clone (avoids CORS/taint)

function assertLibsOrThrow() {
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
  if (!window.html2canvas) throw new Error('html2canvas missing (load the CDN script before this file).');
  if (!jsPDFCtor)         throw new Error('jsPDF missing (load the CDN script before this file).');
  return jsPDFCtor;
}

/* ---------- PDF-only CSS (applies only to CLONE via .pdf-export) ---------- */
(function injectPdfCSS(){
  if (document.querySelector('style[data-pdf-style]')) return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:24px!important;margin:0!important}
  .pdf-export .compat-section{break-inside: avoid-page!important; page-break-inside: avoid!important; margin: 0 0 18pt 0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:transparent!important;color:#fff!important}
  .pdf-export th,.pdf-export td{border:none!important;background:transparent!important;color:#fff!important;padding:6px 8px!important;line-height:1.25!important;vertical-align:middle!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export tr{page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export .section-title,.pdf-export .category-header,.pdf-export .compat-category{border:none!important;box-shadow:none!important;background:transparent!important;padding:6px 0!important}
  .pdf-export .category-emoji,.pdf-export .category-header .emoji,.pdf-export .section-title .emoji{display:none!important}
  `;
  const style = document.createElement('style');
  style.setAttribute('data-pdf-style','true');
  style.textContent = css;
  document.head.appendChild(style);
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

/* ---------- NEW: make headers/cells no-wrap + materialize marks ---------- */
function enhancePdfClone(root){
  // A) Prevent header/cell wrapping like "Partne r B"
  root.querySelectorAll('th, td').forEach(el=>{
    // Only keep nowrap for short header/indicator cells; allow long descriptions to wrap
    const isHeader = el.tagName === 'TH';
    const isShort  = el.textContent.trim().length <= 14; // heuristic for indicator cols
    if (isHeader || isShort) {
      el.style.whiteSpace = 'nowrap';
      el.style.textOverflow = 'ellipsis';
      el.style.overflow = 'hidden';
    }
  });

  // Heuristic widths: first column wide; the rest equal narrow columns
  root.querySelectorAll('table').forEach(table=>{
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const cols = Array.from(headRow.children);
    const n = cols.length;
    if (n >= 3) {
      const first = Math.max(40, 100 - (n-1)*15); // e.g., for 4 cols => ~55%
      cols.forEach((th,i)=>{
        th.style.width = (i===0 ? `${first}%` : `${(100-first)/(n-1)}%`);
        th.style.textAlign = i===0 ? 'left' : 'center';
      });
      table.querySelectorAll('tbody tr').forEach(tr=>{
        Array.from(tr.cells).forEach((td,i)=>{
          td.style.width = (i===0 ? `${first}%` : `${(100-first)/(n-1)}%`);
          if (i>0) td.style.textAlign = 'center';
        });
      });
    }
  });

  // B) Turn pseudo-content/background icons into real characters
  materializeIndicators(root);
}

/* Convert empty/placeholder cells to real glyphs so html2canvas captures them. */
function materializeIndicators(root){
  // 1) If cells contain a single "-" (placeholder), convert to an en-dash centered
  root.querySelectorAll('td, th').forEach(td=>{
    const raw = td.textContent.trim();
    if (raw === '-') {
      td.textContent = '–'; // en-dash, more robust visually
      td.style.textAlign = 'center';
    }
  });

  // 2) If you use classes/data-state, convert to ✓ ✗ –
  root.querySelectorAll('td, th').forEach(td=>{
    if (td.textContent.trim()) return;
    const st = td.dataset.state;
    const c  = td.classList;
    const yes = st==='yes' || c.contains('yes') || c.contains('true') || c.contains('checked');
    const no  = st==='no'  || c.contains('no')  || c.contains('false') || c.contains('unchecked');
    const dash= st==='dash'|| c.contains('dash')|| c.contains('empty')  || c.contains('na');
    if (yes)  td.textContent = '✓';
    if (no)   td.textContent = '✗';
    if (dash) td.textContent = '–';
    if (yes || no || dash) td.style.textAlign = 'center';
  });

  // 3) Copy pseudo-element text (if any) into the DOM
  root.querySelectorAll('*').forEach(el=>{
    const before = getComputedStyle(el, '::before').content;
    const after  = getComputedStyle(el, '::after').content;
    const inject = (txt)=>{
      if (!txt || txt === 'none' || txt === 'normal' || txt === '""') return;
      const t = txt.replace(/^"(.*)"$/,'$1'); // strip quotes
      if (!t) return;
      const s = document.createElement('span');
      s.textContent = t;
      s.style.marginLeft = '4px';
      el.appendChild(s);
    };
    inject(before); inject(after);
  });
}

/* ---------- clone builder ---------- */
function makeClone(){
  const src=document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');

  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});

  const clone=src.cloneNode(true);
  clone.classList.add('pdf-export');
  // remove UI-only bits
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());

  // cleanup + layout hardening
  stripHeaderEmoji(clone);
  removeFlagColumn(clone);
  stripProblemImages(clone);
  forceTableDisplay(clone);
  enhancePdfClone(clone);  // <-- key fixes for wrap + marks

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

/* ---------- sizing/tiling plan ---------- */
function measure(el){
  const r=el.getBoundingClientRect();
  const width  = Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
  const height = Math.ceil(Math.max(el.scrollHeight, r.height));
  if (width===0 || height===0) throw new Error('Zero-size clone (display:none or empty content)');
  return { width, height };
}
function plan(width, height){
  const MAX_MP=16, defaultScale=2;
  let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6;
  if (mp>MAX_MP) scale=Math.max(1, Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2200;                 // rendered pixels per vertical slice
  const renderedH=height*scale;
  const slices=Math.ceil(renderedH/targetSlicePx);
  return { scale, slices, targetSlicePx };
}
async function renderTile(root, width, sliceCssHeight, yOffset, scale){
  return await html2canvas(root, {
    backgroundColor:'#000', scale,
    useCORS:true, allowTaint:true,
    scrollX:0, scrollY:0,
    windowWidth:width,
    windowHeight:sliceCssHeight,
    height:sliceCssHeight,
    y:yOffset
  });
}

/* ============================== MAIN EXPORTER ============================== */
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
    alert('Could not generate PDF.\n' + (err?.message || err) + '\nSee console for details.');
  }
}

/* Keep legacy names working + optional global for non-module callers */
export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;
if (typeof window !== 'undefined') window.downloadCompatibilityPDF = downloadCompatibilityPDF;

