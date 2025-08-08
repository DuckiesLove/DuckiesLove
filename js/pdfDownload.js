export function generateCompatibilityPDF() {
  const sourceElement = document.getElementById('pdf-container');
  if (!sourceElement) return alert('PDF container not found.');

  // Clone to avoid DOM mutations
  const clone = sourceElement.cloneNode(true);
  clone.style.backgroundColor = '#000';
  clone.style.color = '#fff';
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.margin = '0';
  clone.style.padding = '0';
  clone.style.overflow = 'visible';
  clone.style.whiteSpace = 'normal';

  // Ensure tables are full width and properly wrap
  const tables = clone.querySelectorAll('table');
  tables.forEach(table => {
    table.style.backgroundColor = '#000';
    table.style.color = '#fff';
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';
    table.style.borderCollapse = 'collapse';
  });

  // Prevent category blocks from splitting across pages
  const sections = clone.querySelectorAll('.compat-section');
  sections.forEach(section => {
    section.style.pageBreakInside = 'avoid';
    section.style.breakInside = 'avoid';
  });

  // Fix right side cutoff for table cells
  clone.querySelectorAll('td, th').forEach(cell => {
    cell.style.whiteSpace = 'normal';
    cell.style.overflowWrap = 'break-word';
    cell.style.wordBreak = 'break-word';
    cell.style.maxWidth = '100%';
  });

  // Create offscreen container to render PDF version
  const offscreen = document.createElement('div');
  offscreen.style.position = 'fixed';
  offscreen.style.top = '-9999px';
  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  // PDF options
  const opt = {
    margin: 0,
    filename: 'kink-compatibility.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      backgroundColor: '#000',
      scale: 2,
      useCORS: true
    },
    jsPDF: {
      unit: 'pt',
      format: 'letter',
      orientation: 'portrait'
    }
  };

  // Generate and clean up
  try {
    html2pdf().set(opt).from(clone).save().then(() => {
      document.body.removeChild(offscreen);
    });
  } catch (err) {
    document.body.removeChild(offscreen);
    alert('PDF generation failed. See console for details.');
    console.error(err);
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

