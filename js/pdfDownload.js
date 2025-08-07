// ✅ Codex PDF Layout Fix for 5-Column Report (Kink | Partner A | Match | Flag | Partner B)
// Ensures consistent layout, styling, theme-aware rendering, and emoji flags in center.

// Apply global styles so the export fills the page and text wraps.
if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
  const style = document.createElement('style');
  style.innerHTML = `
    /* Ensure the PDF export fills the entire landscape page */
    #pdf-container, #print-area, #compatibility-wrapper {
      width: 100%;
      max-width: none;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
    }

    #pdf-container {
      display: block;
    }

    #pdf-container table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    #pdf-container td,
    #pdf-container th {
      word-wrap: break-word;
      white-space: normal;
      padding: 4px 6px;
    }

    .results-table th:nth-child(1),
    .results-table td:nth-child(1) {
      text-align: left;
      width: 45%;
    }

    .results-table th:nth-child(2),
    .results-table td:nth-child(2) {
      width: 13%;
      min-width: 80px;
      text-align: center;
    }

    .results-table th:nth-child(3),
    .results-table td:nth-child(3) {
      width: 10%;
      min-width: 60px;
      text-align: center;
    }

    .results-table th:nth-child(4),
    .results-table td:nth-child(4) {
      width: 9%;
      min-width: 50px;
      text-align: center;
    }

    .results-table th:nth-child(5),
    .results-table td:nth-child(5) {
      width: 13%;
      min-width: 80px;
      text-align: center;
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
  element.style.maxWidth = 'none';
  element.style.boxSizing = 'border-box';
  element.style.display = 'block';

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

  // Stretch inner wrapper and table to fill the page
  const wrapper = document.getElementById('compatibility-wrapper');
  if (wrapper) {
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = 'none';
    wrapper.style.margin = '0';
    wrapper.style.padding = '0';
  }

  const table = element.querySelector('.results-table');
  if (table) {
    const widths = ['45%', '13%', '10%', '9%', '13%'];
    Array.from(table.rows).forEach(row => {
      widths.forEach((w, i) => {
        if (row.cells[i]) row.cells[i].style.width = w;
      });
      if (row.cells[2]) {
        row.cells[2].style.minWidth = '60px';
        row.cells[2].style.textAlign = 'center';
      }
      if (row.cells[3]) {
        row.cells[3].style.minWidth = '50px';
        row.cells[3].style.textAlign = 'center';
      }
    });
  }

  // Force layout to stretch across full page and generate PDF
  window.scrollTo(0, 0);

  const canvasWidth = element.scrollWidth;
  window.html2pdf()
    .set({
      margin: 0,
      filename: 'kink-compatibility.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#000',
        scrollY: 0,
        windowWidth: canvasWidth
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
