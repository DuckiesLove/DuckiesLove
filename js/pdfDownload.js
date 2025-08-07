// ✅ Codex PDF Layout Fix for 5-Column Report (Kink | Partner A | Match | Flag | Partner B)
// Ensures consistent layout, styling, theme-aware rendering, and emoji flags in center.

// Apply global styles so the export fills the page and text wraps.
if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
  const style = document.createElement("style");
  style.innerHTML = `
    #pdf-container, #print-area {
      width: 100%;
      max-width: none;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    }

    #pdf-container table {
      width: 100%;
      table-layout: fixed;
    }

    #pdf-container td,
    #pdf-container th {
      word-wrap: break-word;
      white-space: normal;
    }
  `;
  document.head.appendChild(style);
}

export function exportToPDF() {
  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  // Apply layout styles directly to avoid blank renders
  const mode = localStorage.getItem('theme') || 'dark';
  element.style.fontFamily = 'sans-serif';
  element.style.fontSize = '13px';
  element.style.padding = '0';
  element.style.margin = '0';
  element.style.width = '100%';
  element.style.maxWidth = '100%';
  element.style.boxSizing = 'border-box';

  if (mode === 'dark') {
    element.style.backgroundColor = '#000000';
    element.style.color = '#ffffff';
  } else if (mode === 'lipstick') {
    element.style.backgroundColor = '#1a001f';
    element.style.color = '#fceaff';
  } else if (mode === 'forest') {
    element.style.backgroundColor = '#f0f7f1';
    element.style.color = '#1d3b1d';
  }

  // Ensure layout has consistent column spacing
  const allRows = element.querySelectorAll('.row');
  allRows.forEach((row) => {
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr';
    row.style.alignItems = 'center';
    row.style.gap = '1em';
    row.style.padding = '2px 0';
  });

  // Force layout to stretch across full page and generate PDF
  window.scrollTo(0, 0);

  window.html2pdf()
    .set({
      margin: 0,
      filename: 'kink-compatibility.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#000',
        scrollY: 0
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    })
    .from(element)
    .save();
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}
