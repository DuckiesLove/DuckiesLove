export function exportToPDF() {
  const container = document.getElementById('pdf-container');
  if (!container) {
    alert('PDF content not found.');
    return;
  }

  // 1. Set full-page black styling before PDF generation
  container.style.width = '100%';
  container.style.backgroundColor = '#000';
  container.style.color = '#fff';
  container.style.padding = '0';
  container.style.margin = '0';

  // 2. Force all tables and their cells to use white text and proper box model
  const tables = container.querySelectorAll('table');
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

  // Re-align column headers for better readability
  container.querySelectorAll('tr').forEach(row => {
    const cells = row.children;
    if (cells.length >= 5) {
      cells[1].style.paddingLeft = '48px'; // Partner A
      cells[2].style.paddingLeft = '24px'; // Match
      cells[3].style.paddingLeft = '24px'; // Flag
      cells[4].style.paddingLeft = '24px'; // Partner B
    }
  });

  // 3. Equalize row heights across all rows with same index
  function equalizeRowHeights() {
    const sectionTables = document.querySelectorAll('.compat-section table');
    const maxRows = Math.max(0, ...Array.from(sectionTables).map(t => t.rows.length));

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

  // 4. Remove default body/html margin that creates unwanted white border
  document.body.style.margin = '0';
  document.documentElement.style.margin = '0';

  // 5. Generate PDF using html2pdf with html2canvas preserving dark background
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

  html2pdf().set(opt).from(container).save();
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}

