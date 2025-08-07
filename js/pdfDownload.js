// ✅ Codex PDF Layout Fix for 5-Column Report (Kink | Partner A | Match | Flag | Partner B)
// Ensures consistent layout, styling, theme-aware rendering, and emoji flags in center.
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
  element.style.padding = '0.75in';
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
    row.style.whiteSpace = 'nowrap';
    row.style.padding = '2px 0';
  });

  // Prevent race condition or missing render
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);

    html2pdf()
      .set({
        margin: [0, 0],
        filename: 'kink-compatibility.pdf',
        image: { type: 'jpeg', quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollY: 0,
          backgroundColor: null,
        },
        jsPDF: {
          unit: 'in',
          format: 'letter',
          orientation: 'landscape',
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(element)
      .save();
  });
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}
