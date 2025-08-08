export function exportToPDF() {
  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  // Enforce full-page dark styling
  element.style.width = '100%';
  element.style.maxWidth = '100%';
  element.style.backgroundColor = '#000';
  element.style.color = '#fff';
  element.style.padding = '0';
  element.style.margin = '0';
  element.style.overflow = 'visible';

  // Force all tables to use white text and proper box model
  const tables = element.querySelectorAll('table');
  tables.forEach(table => {
    table.style.backgroundColor = '#000';
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';
    const cells = table.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.style.color = '#fff';
      cell.style.padding = '8px';
      cell.style.boxSizing = 'border-box';
    });
  });

  // Equalize row heights across tables
  function equalizeRowHeights() {
    const sectionTables = document.querySelectorAll('.compat-section table');
    if (sectionTables.length === 0) return;
    const maxRows = Math.max(...Array.from(sectionTables).map(t => t.rows.length));

    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      let maxHeight = 0;
      sectionTables.forEach(table => {
        const row = table.rows[rowIndex];
        if (row) {
          row.style.height = 'auto';
          const height = row.offsetHeight;
          if (height > maxHeight) maxHeight = height;
        }
      });
      sectionTables.forEach(table => {
        const row = table.rows[rowIndex];
        if (row) row.style.height = `${maxHeight}px`;
      });
    }
  }
  equalizeRowHeights();

  // Re-align column headers
  element.querySelectorAll('tr').forEach(row => {
    const cells = row.children;
    if (cells.length >= 5) {
      cells[1].style.paddingLeft = '48px'; // Partner A
      cells[2].style.paddingLeft = '24px'; // Match
      cells[3].style.paddingLeft = '24px'; // Flag
      cells[4].style.paddingLeft = '24px'; // Partner B
    }
  });

  // Remove default margins that create white borders
  document.body.style.margin = '0';
  document.documentElement.style.margin = '0';

  // PDF settings ensuring true black background
  const opt = {
    margin: 0,
    filename: 'kink-compatibility.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      backgroundColor: '#000',
      scale: 2,
      useCORS: true
    },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}

