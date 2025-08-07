export function exportToPDF() {
  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  // Full bleed width enforcement
  element.style.width = '100vw';
  element.style.maxWidth = 'none';
  element.style.margin = '0';
  element.style.padding = '0';
  element.style.overflow = 'visible';

  // Force tables to obey
  const tables = element.querySelectorAll('table');
  tables.forEach(table => {
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';
  });

  // Force body to match
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100vw';
  document.body.style.overflow = 'visible';

  // PDF Settings
  html2pdf().from(element).set({
    margin: 0,
    filename: 'kink-compatibility.pdf',
    html2canvas: {
      scale: 3,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#000000',
      windowWidth: document.body.scrollWidth
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

