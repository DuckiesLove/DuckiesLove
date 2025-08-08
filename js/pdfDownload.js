export function exportToPDF() {
  const source = document.getElementById('pdf-container');
  if (!source) { alert('pdf-container not found'); return; }
  if (!window.html2pdf) { alert('html2pdf not loaded'); return; }

  const clone = source.cloneNode(true);

  // ===== BASE STYLES =====
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.backgroundColor = '#000';
  clone.style.color = '#fff';
  clone.style.fontSize = '12pt';
  clone.style.width = '100%';
  clone.style.overflow = 'visible';

  // ===== REMOVE FLAGS + LINES FROM CATEGORY HEADERS =====
  clone.querySelectorAll('th, .compat-category, .category-header').forEach(category => {
    category.style.border = 'none';
    category.style.background = 'transparent';
    category.style.padding = '6px 0';
    category.style.fontWeight = 'bold';
    category.innerHTML = category.textContent
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .trim();
  });

  // ===== PREVENT PAGE BREAKS INSIDE TABLES =====
  clone.querySelectorAll('table').forEach(table => {
    table.style.pageBreakInside = 'avoid';
    table.style.breakInside = 'avoid';
    table.style.width = '100%';
  });

  clone.querySelectorAll('tr').forEach(row => {
    row.style.pageBreakInside = 'avoid';
    row.style.breakInside = 'avoid';
  });

  // ===== NORMALIZE ROW HEIGHT ACROSS TABLES =====
  const tables = clone.querySelectorAll('.compat-section table');
  const maxRows = Math.max(...Array.from(tables).map(t => t.rows.length));

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    let maxHeight = 0;
    tables.forEach(table => {
      const row = table.rows[rowIndex];
      if (row) {
        row.style.height = 'auto';
        const height = row.offsetHeight;
        if (height > maxHeight) maxHeight = height;
      }
    });
    tables.forEach(table => {
      const row = table.rows[rowIndex];
      if (row) row.style.height = `${maxHeight}px`;
    });
  }

  // ===== GENERATE PDF =====
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  const opt = {
    margin: 0,
    filename: 'kink-compatibility.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000'
    },
    jsPDF: {
      unit: 'pt',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: { mode: ['avoid-all'], before: '.compat-section' }
  };

  try {
    html2pdf().set(opt).from(clone).save().then(() => {
      document.body.removeChild(tempContainer);
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    document.body.removeChild(tempContainer);
  }
}

export const exportCompatPDF = exportToPDF;
export const exportKinkCompatibilityPDF = exportToPDF;
export const generateCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', exportToPDF);
    }
  });
}

