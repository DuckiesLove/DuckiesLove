/**
 * EXACT STEPS FOR CODEX (do these in order)
 * ---------------------------------------------------------------------------
 * 1) Create a file:  /js/pdfDownload.js   and paste THIS ENTIRE FILE into it.
 *
 * 2) In compatibility.html, inside <head>, add the two libraries BEFORE any script
 *    that imports/uses /js/pdfDownload.js:
 *      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
 *      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *
 * 3) Make sure the report markup is wrapped like this (ids must match):
 *      <div id="pdf-container">
 *        <!-- your compatibility table lives here (with <table> … ) -->
 *      </div>
 *
 * 4) Ensure there is a download button:
 *      <button id="downloadBtn">Download PDF</button>
 *
 * 5) At the very end of compatibility.html (just before </body>), import the module:
 *      <script type="module">
 *        import { downloadCompatibilityPDF } from '/js/pdfDownload.js';
 *        // auto-wire is built into the module, but this exposes it if you need to call it manually:
 *        window.downloadCompatibilityPDF = downloadCompatibilityPDF;
 *      </script>
 *
 * 6) Test flow:
 *    - Load the page so the table renders inside #pdf-container.
 *    - Click “Download PDF”. If it fails, open DevTools console. You will see
 *      [pdf] diagnostics telling you what is missing (libs / container / table).
 *
 * Notes:
 * - This exporter clones #pdf-container into a hidden black canvas so your live page is untouched.
 * - Rows and category titles are never split across pages.
 * - Output fills each PDF page edge-to-edge (no white seams).
 */

/* =================== clone-only CSS: black spacers, no row splitting =================== */
(function injectPdfBreakCSS(){
  if (document.querySelector('style[data-pdf-breaks]')) return;
  const css = `
    .pdf-export, .pdf-export * { background-color: transparent !important; }
    .pdf-export { background:#000 !important; color:#fff !important; padding:18px !important; }
    .pdf-export table{ border-collapse: collapse !important; table-layout: fixed !important; width: 100% !important; }
    .pdf-export thead, .pdf-export tbody, .pdf-export tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    .pdf-export .pdf-soft-break {
      width: 100% !important;
      height: 24px !important;
      background: #000 !important;   /* prevents white seams between slices */
      margin: 0 !important; padding: 0 !important; border: 0 !important;
    }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-pdf-breaks','true');
  s.textContent = css;
  document.head.appendChild(s);
})();

/* =================== helper: make a safe, black clone (web stays untouched) ============ */
function makeClone(){
  const src = document.getElementById('pdf-container');
  if (!src) throw new Error('#pdf-container not found');

  const shell = document.createElement('div');
  Object.assign(shell.style, { background:'#000', color:'#fff', margin:0, padding:0, width:'100%', minHeight:'100vh', overflow:'auto' });

  const clone = src.cloneNode(true);
  clone.classList.add('pdf-export');

  // remove UI/controls you don’t want in the PDF
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());

  // ensure table elements render as tables for html2canvas
  clone.querySelectorAll('table').forEach(e=>e.style.display='table');
  clone.querySelectorAll('thead').forEach(e=>e.style.display='table-header-group');
  clone.querySelectorAll('tbody').forEach(e=>e.style.display='table-row-group');
  clone.querySelectorAll('tr').forEach(e=>e.style.display='table-row');
  clone.querySelectorAll('td,th').forEach(e=>e.style.display='table-cell');

  document.body.appendChild(shell);
  shell.appendChild(clone);
  return { shell, clone };
}

/* =================== page height in CSS px (match the PDF page aspect) ================= */
function computePageHeightCss({ clone, pdfWidthPt, pdfHeightPt }) {
  const cssWidth = Math.ceil(Math.max(
    clone.scrollWidth,
    clone.getBoundingClientRect().width,
    document.documentElement.clientWidth
  ));
  // minus 1px to avoid a rounding hairline seam at page joins
  const pageHeightCss = Math.max(1, Math.floor(cssWidth * (pdfHeightPt / pdfWidthPt)) - 1);
  return { cssWidth, pageHeightCss };
}

/* =================== keep whole categories together (don’t cut titles) ================= */
function keepCategoriesIntact(clone, pageHeightCss, minTopSpace = 64, topPad = 24) {
  const baseTop = clone.getBoundingClientRect().top;
  // Prefer complete wrappers if present; fall back to heading selectors.
  const sections = Array.from(clone.querySelectorAll('.compat-section'));
  const headings = Array.from(clone.querySelectorAll('.section-title, .category-header, .compat-category, h2, h3'));
  const blocks = sections.length ? sections : headings;

  let pageEnd = pageHeightCss;
  const guard = 6;

  for (const el of blocks) {
    const r = el.getBoundingClientRect();
    const top = r.top - baseTop;
    theBottom = top + r.height;

    const wouldCut = theBottom > pageEnd - guard;
    const tooLow   = (pageEnd - top) < minTopSpace;

    if (wouldCut || tooLow) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-soft-break';
      const needed = Math.max(0, Math.ceil((pageEnd - top) + topPad));
      spacer.style.height = `${needed}px`;
      el.parentNode.insertBefore(spacer, el);
      pageEnd += pageHeightCss;
    }
  }
}

/* =================== keep table rows intact (never split across pages) ================= */
function keepRowsIntact(clone, pageHeightCss, topPad = 20) {
  const baseTop = clone.getBoundingClientRect().top;
  const rows = Array.from(clone.querySelectorAll('table tbody tr'));
  let pageEnd = pageHeightCss;
  const guard = 6;

  for (const tr of rows) {
    const r = tr.getBoundingClientRect();
    const top = r.top - baseTop;
    const bottom = top + r.height;

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

/* =================== multi-slice tiler: render the entire clone (no seams) ============= */
async function renderMultiPagePDF({ clone, jsPDFCtor, orientation='landscape', jpgQuality=0.95 }) {
  const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const { cssWidth, pageHeightCss } = computePageHeightCss({ clone, pdfWidthPt: pdfW, pdfHeightPt: pdfH });

  // apply safety rules BEFORE rendering
  keepCategoriesIntact(clone, pageHeightCss, 64, 24);
  keepRowsIntact(clone, pageHeightCss, 20);

  // re-measure total height after spacers
  const totalCssHeight = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));

  // choose a scale that keeps each slice under ~18MP
  const MAX_MP = 18;
  let scale = 2;
  const estMP = (cssWidth * pageHeightCss * scale * scale) / 1e6;
  if (estMP > MAX_MP) scale = Math.max(1, Math.sqrt((MAX_MP * 1e6) / (cssWidth * pageHeightCss)));

  // tile down the clone, one page per slice; fill the PDF page edge-to-edge
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
    if (page > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST'); // fill page, no seams
    page += 1;
    y += sliceH;
  }
  return pdf;
}

/* =================== entry point: build clone, render, save ============================ */
export async function downloadCompatibilityPDF() {
  // Diagnostics first
  const hasH2C = !!window.html2canvas;
  const hasPDF = !!((window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF));
  const hasContainer = !!document.getElementById('pdf-container');
  console.table({ 'lib:html2canvas':hasH2C, 'lib:jsPDF':hasPDF, '#pdf-container':hasContainer });
  if (!hasH2C || !hasPDF) { alert('PDF libs missing (see console).'); return; }
  if (!hasContainer)      { alert('#pdf-container not found.'); return; }

  // build the black, PDF-only clone
  const { shell, clone } = makeClone();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
    const pdf = await renderMultiPagePDF({ clone, jsPDFCtor, orientation: 'landscape', jpgQuality: 0.95 });
    pdf.save('kink-compatibility.pdf');
  } catch (err) {
    console.error('[pdf] render error:', err);
    alert('Could not generate PDF. See console for details.');
  } finally {
    // clean up overlay
    if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
  }
}

/* =================== auto-wire the Download button ======================== */
if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  (function wireDownloadButton(){
    function wire(){
      const btn = document.getElementById('downloadBtn');
      if (!btn) { console.warn('[pdf] #downloadBtn not found yet.'); return; }
      const fresh = btn.cloneNode(true); btn.replaceWith(fresh);
      fresh.addEventListener('click', downloadCompatibilityPDF);
    }
    if (document.readyState === 'loading' && document.addEventListener) {
      document.addEventListener('DOMContentLoaded', wire);
    } else {
      wire();
    }
  })();
}

// Optional global for convenience
if (typeof window !== 'undefined') window.downloadCompatibilityPDF = downloadCompatibilityPDF;

