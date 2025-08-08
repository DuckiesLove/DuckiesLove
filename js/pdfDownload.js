export function generateCompatibilityPDF() {
  const original = document.getElementById('pdf-container');
  if (!original) {
    console.error('PDF container not found');
    return;
  }

  try {
    const clone = original.cloneNode(true);
    clone.id = 'pdf-clone';
    Object.assign(clone.style, {
      backgroundColor: '#000',
      color: '#fff',
      padding: '0',
      margin: '0',
      width: '100%',
      maxWidth: '100%',
      overflow: 'visible',
    });

    const tables = clone.querySelectorAll('table');
    tables.forEach(table => {
      Object.assign(table.style, {
        backgroundColor: '#000',
        color: '#fff',
        width: '100%',
        tableLayout: 'fixed',
      });
    });

    clone.querySelectorAll('tr').forEach(row => {
      const cells = row.children;
      if (cells.length >= 5) {
        cells[1].style.paddingLeft = '48px';
        cells[2].style.paddingLeft = '24px';
        cells[3].style.paddingLeft = '24px';
        cells[4].style.paddingLeft = '24px';
      }
    });

    const sectionTables = clone.querySelectorAll('.compat-section table');
    const maxRows = Math.max(0, ...Array.from(sectionTables).map(t => t.rows.length));
    for (let i = 0; i < maxRows; i++) {
      let maxHeight = 0;
      sectionTables.forEach(table => {
        const row = table.rows[i];
        if (row) {
          row.style.height = 'auto';
          const h = row.offsetHeight;
          if (h > maxHeight) maxHeight = h;
        }
      });
      sectionTables.forEach(table => {
        const row = table.rows[i];
        if (row) row.style.height = `${maxHeight}px`;
      });
    }

    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    const opt = {
      margin: 0,
      filename: 'kink-compatibility.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        backgroundColor: '#000',
        scale: 2,
        useCORS: true,
      },
      jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(clone).save().then(() => {
      document.body.removeChild(clone);
    }).catch(err => {
      console.error('PDF generation failed:', err);
      document.body.removeChild(clone);
    });
  } catch (error) {
    console.error('Unexpected error during PDF export:', error);
  }
}

export const exportKinkCompatibilityPDF = generateCompatibilityPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', generateCompatibilityPDF);
    }
  });
}

