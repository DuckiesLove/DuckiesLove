export function exportToPDF() {
  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  // Enforce full width and visibility
  element.style.width = '100%';
  element.style.maxWidth = '100%';
  element.style.margin = '0 auto';
  element.style.padding = '0';
  element.style.overflow = 'visible';

  // Normalize table layout
  const tables = element.querySelectorAll('table');
  tables.forEach(table => {
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';
    table.style.borderCollapse = 'collapse';
    const cells = table.querySelectorAll('td, th');
    cells.forEach(cell => {
      cell.style.padding = '2px';
      cell.style.lineHeight = '1.2';
    });
  });

  // Set body + html width to avoid margin bleed
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100%';
  document.documentElement.style.width = '100%';

  // PDF Settings
  html2pdf().from(element).set({
    margin: 0,
    filename: 'kink-compatibility.pdf',
    html2canvas: {
      scale: 2.5,
      backgroundColor: '#000000',
      windowWidth: Math.min(document.body.scrollWidth, 1500),
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: {
      unit: 'in',
      format: 'letter',
      orientation: 'landscape'
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy']
    }
  }).save();
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}

