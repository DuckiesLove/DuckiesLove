export async function downloadCompatibilityPDF() {
  const src = document.getElementById('pdf-container');
  if (!src) {
    console.error('downloadCompatibilityPDF: #pdf-container not found');
    return;
  }

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }

  const clone = src.cloneNode(true);
  clone.querySelectorAll(
    '[data-hide-in-pdf], .download-btn, .print-btn, .nav, header, footer'
  ).forEach(el => el.remove());

  const shell = document.createElement('div');
  Object.assign(shell.style, {
    background: '#000', color: '#fff', margin: '0', padding: '0',
    width: '100%', overflow: 'visible'
  });
  shell.appendChild(clone);
  document.body.appendChild(shell);

  clone.querySelectorAll('th, .compat-category, .category-header, .section-title').forEach(n => {
    n.querySelectorAll('hr, .line, .rule, .divider').forEach(el => el.remove());
    n.style.border = 'none';
    n.style.background = 'transparent';
    n.style.boxShadow = 'none';
    n.style.padding = '6px 0';
    n.innerHTML = n.textContent.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '').trim();
  });

  clone.querySelectorAll('table').forEach(table => {
    Object.assign(table.style, {
      width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse',
      pageBreakInside: 'avoid', breakInside: 'avoid',
      background: '#000', color: '#fff'
    });
  });

  clone.querySelectorAll('th, td').forEach(cell => {
    Object.assign(cell.style, {
      color: '#fff', background: 'transparent', border: 'none',
      padding: '6px 8px', lineHeight: '1.25', boxSizing: 'border-box',
      wordBreak: 'break-word', whiteSpace: 'normal', verticalAlign: 'top',
      pageBreakInside: 'avoid', breakInside: 'avoid'
    });
  });

  clone.querySelectorAll('tr').forEach(row => {
    row.style.pageBreakInside = 'avoid';
    row.style.breakInside = 'avoid';
  });

  const fullWidth = Math.max(clone.scrollWidth, clone.getBoundingClientRect().width);
  document.documentElement.style.margin = '0';
  document.body.style.margin = '0';
  const opt = {
    margin: 0,
    filename: 'kink-compatibility.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      backgroundColor: '#000',
      scale: 2, useCORS: true, scrollX: 0, scrollY: 0,
      windowWidth: Math.ceil(fullWidth)
    },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.compat-section' }
  };
  const html2pdfFn =
    globalThis.html2pdf || (typeof window !== 'undefined' ? window.html2pdf : undefined);
  if (!html2pdfFn) {
    console.error('PDF generation failed: html2pdf library not found');
    document.body.removeChild(shell);
    return;
  }
  try {
    await html2pdfFn().set(opt).from(shell).save();
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
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn') || document.querySelector('[data-download-pdf]');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadCompatibilityPDF);
    }
  });
}

