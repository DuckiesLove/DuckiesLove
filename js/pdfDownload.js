export async function downloadCompatibilityPDF() {
  const src = document.getElementById('pdf-container');
  if (!src) {
    console.error('downloadCompatibilityPDF: #pdf-container not found');
    return;
  }
  if (!window.html2pdf) {
    console.error('downloadCompatibilityPDF: html2pdf not loaded');
    return;
  }

  // Wait for web fonts to load to avoid layout shifts during rendering
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }

  // Clone the source so we don't mutate the live page
  const clone = src.cloneNode(true);

  // Remove UI-only elements that shouldn't appear in the PDF
  clone
    .querySelectorAll(
      '[data-hide-in-pdf], .download-btn, .print-btn, .nav, header, footer'
    )
    .forEach(el => el.remove());

  // Build a shell to guarantee a true black background
  const shell = document.createElement('div');
  Object.assign(shell.style, {
    background: '#000',
    color: '#fff',
    margin: '0',
    padding: '0',
    width: '100%',
    overflow: 'visible',
  });
  shell.appendChild(clone);
  document.body.appendChild(shell);

  // --- PDF-specific cleanup & normalization ---

  // Remove emoji flags & decorative lines in category headers
  clone
    .querySelectorAll(
      'th, .compat-category, .category-header, .section-title'
    )
    .forEach(n => {
      n.querySelectorAll('hr, .line, .rule, .divider').forEach(el => el.remove());
      n.style.border = 'none';
      n.style.background = 'transparent';
      n.style.boxShadow = 'none';
      n.style.padding = '6px 0';
      n.innerHTML = n.textContent
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '')
        .trim();
    });

  // Normalize tables
  clone.querySelectorAll('table').forEach(table => {
    Object.assign(table.style, {
      width: '100%',
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
      background: '#000',
      color: '#fff',
    });
  });

  // Normalize cells
  clone.querySelectorAll('th, td').forEach(cell => {
    Object.assign(cell.style, {
      color: '#fff',
      background: 'transparent',
      border: 'none',
      padding: '6px 8px',
      lineHeight: '1.25',
      boxSizing: 'border-box',
      wordBreak: 'break-word',
      whiteSpace: 'normal',
      verticalAlign: 'top',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
    });
  });

  // Ensure rows don't split across pages
  clone.querySelectorAll('tr').forEach(row => {
    row.style.pageBreakInside = 'avoid';
    row.style.breakInside = 'avoid';
  });

  // Optional: equalize row heights across side-by-side section tables
  (function equalizeRowHeights() {
    const sectTables = clone.querySelectorAll('.compat-section table');
    if (!sectTables.length) return;
    const maxRows = Math.max(...Array.from(sectTables).map(t => t.rows.length));
    for (let i = 0; i < maxRows; i++) {
      let maxH = 0;
      sectTables.forEach(t => {
        const r = t.rows[i];
        if (r) {
          r.style.height = 'auto';
          const h = r.offsetHeight;
          if (h > maxH) maxH = h;
        }
      });
      sectTables.forEach(t => {
        const r = t.rows[i];
        if (r) r.style.height = `${maxH}px`;
      });
    }
  })();

  // Compute real width so html2canvas captures the right edge
  const fullWidth = Math.max(
    clone.scrollWidth,
    clone.getBoundingClientRect().width
  );

  // Remove default margins that create white borders in some viewers
  document.documentElement.style.margin = '0';
  document.body.style.margin = '0';

  // html2pdf options: TRUE black canvas + capture at real width
  const opt = {
    margin: 0,
    filename: 'kink-compatibility.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      backgroundColor: '#000',
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.ceil(fullWidth),
    },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.compat-section',
    },
  };

  try {
    await html2pdf().set(opt).from(shell).save();
  } catch (err) {
    console.error('PDF generation failed:', err);
  } finally {
    document.body.removeChild(shell);
  }
}

export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadCompatibilityPDF);
    }
  });
}

