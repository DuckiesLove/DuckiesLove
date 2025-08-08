import { applyCompatLayoutAndFlags } from './compatPdfFixes.js';

/* ======== ONE-COPY BLOCK: fix right-side cutoff + stop awkward breaks ========

What this does
1) Clones #pdf-container so the live page isn’t touched.
2) Forces true-black background + white text on the clone.
3) Sets the clone’s width to its real scrollWidth and feeds that into html2canvas
   so the right side never gets cropped.
4) Disables any forced page breaks and tells html2pdf to avoid breaking inside
   category sections/headers/rows.

How to use
- Drop this function in your JS and call exportCompatPDF().

============================================================================= */

export async function exportCompatPDF() {
  // 0) Guard + lib check
  const source = document.getElementById('pdf-container');
  if (!source) { alert('pdf-container not found'); return; }
  if (!window.html2pdf) { alert('html2pdf not loaded'); return; }

  applyCompatLayoutAndFlags(source);

  // 1) Clone the content so we don’t mutate the live UI
  const fullWidth = source.scrollWidth || source.offsetWidth || 1920;
  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.inset = '0';
  sandbox.style.zIndex = '-1';          // keep it off-screen
  sandbox.style.overflow = 'visible';
  document.body.appendChild(sandbox);

  const clone = source.cloneNode(true);
  sandbox.appendChild(clone);

  // 2) Apply PDF-specific styling on the clone
  Object.assign(clone.style, {
    width: `${fullWidth}px`,
    maxWidth: 'unset',
    margin: '0',
    padding: '0',
    backgroundColor: '#000',
    color: '#fff',
    overflow: 'visible'
  });

  // Normalize tables and cells
  clone.querySelectorAll('table').forEach(t => {
    Object.assign(t.style, {
      width: '100%',
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      backgroundColor: '#000'
    });
  });
  clone.querySelectorAll('th,td').forEach(c => {
    Object.assign(c.style, {
      color: '#fff',
      boxSizing: 'border-box',
      padding: '6px 8px',
      lineHeight: '1.25',
      verticalAlign: 'top',
      wordBreak: 'break-word',
      whiteSpace: 'normal'
    });
  });

  // 3) Insert CSS to avoid bad page breaks and remove any forced ones
  const style = document.createElement('style');
  style.textContent = `
    /* Stop breaking inside sections/headers/rows */
    .compat-section, .compat-section * { break-inside: avoid; page-break-inside: avoid; }
    .category, .category-header, thead, tr { break-inside: avoid; page-break-inside: avoid; }
    /* Remove any custom break classes you may have used */
    .pdf-page-break { break-before: auto !important; page-break-before: auto !important; }
    /* Ensure true black background in render */
    #pdf-container, #pdf-container * { background-color: transparent; }
  `;
  clone.prepend(style);

  // If you had explicit break elements, hide them in the clone
  clone.querySelectorAll('.pdf-page-break').forEach(n => n.style.display = 'none');

  // 4) (Optional) equalize row heights across side-by-side tables/sections
  // The clone must be in the DOM for row measurements to be non-zero.
  (function equalizeRowHeights(root) {
    // Target all compatibility tables directly; the previous selector relied on
    // a `.compat-section` wrapper that isn't present in production markup.
    const tables = Array.from(root.querySelectorAll('table.compat'));
    if (tables.length < 2) return;
    const maxRows = Math.max(...tables.map(t => t.rows.length));
    for (let i = 0; i < maxRows; i++) {
      let h = 0;
      tables.forEach(t => {
        const r = t.rows[i];
        if (!r) return;
        r.style.height = 'auto';
        h = Math.max(h, r.getBoundingClientRect().height);
      });
      tables.forEach(t => {
        const r = t.rows[i];
        if (r) r.style.height = `${h}px`;
      });
    }
  })(clone);

  // 5) Remove default margins that can cause white borders
  const prevBodyMargin = document.body.style.margin;
  const prevHtmlMargin = document.documentElement.style.margin;
  document.body.style.margin = '0';
  document.documentElement.style.margin = '0';

  try {
    // 6) Generate the PDF (landscape Letter). Right side is fixed by windowWidth.
    await window.html2pdf()
      .set({
        margin:       0,
        filename:     'kink-compatibility.pdf',
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  {
          scale: 2,
          backgroundColor: '#000000',
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: fullWidth   // << prevents right-side cutoff/whiteout
        },
        jsPDF:        { unit: 'pt', format: 'letter', orientation: 'landscape' },
        // Avoid breaking inside sections/rows; do NOT force breaks between categories
        pagebreak:    { mode: ['css', 'legacy'] }
      })
      .from(clone)
      .save();
  } finally {
    // 7) Cleanup + restore margins
    document.body.style.margin = prevBodyMargin;
    document.documentElement.style.margin = prevHtmlMargin;
    sandbox.remove();
  }
}

export const generateCompatibilityPDF = exportCompatPDF;
export const exportKinkCompatibilityPDF = exportCompatPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', exportCompatPDF);
    }
  });
}

