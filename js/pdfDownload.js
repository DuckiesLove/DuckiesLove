export function exportToPDF() {
  const target = document.getElementById("pdf-container");
  if (!target) {
    alert("PDF content not found.");
    return;
  }

  // Force #pdf-container and all parents to fill the viewport
  let current = target;
  while (current) {
    current.style.width = "100vw";
    current.style.maxWidth = "none";
    current.style.padding = "0";
    current.style.margin = "0";
    current = current.parentElement;
  }

  const element = document.getElementById("pdf-container");

  element.style.width = "100vw";
  element.style.maxWidth = "none";
  element.style.padding = "0";
  element.style.margin = "0";

  const tables = element.querySelectorAll("table");
  tables.forEach(table => {
    table.style.width = "100%";
    table.style.tableLayout = "fixed";
  });

  html2pdf().from(element).set({
    margin: 0,
    filename: 'kink-compatibility.pdf',
    html2canvas: {
      scale: 2,
      backgroundColor: '#000',
      scrollX: 0,
      scrollY: 0,
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

