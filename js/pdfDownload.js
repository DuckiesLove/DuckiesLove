export function exportToPDF() {
  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  const mode = localStorage.getItem('theme') || 'dark';
  element.style.fontFamily = 'sans-serif';
  element.style.padding = '1in';
  element.style.margin = '0';
  element.style.width = '100%';
  element.style.maxWidth = '100%';

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

  requestAnimationFrame(() => {
    window.scrollTo(0, 0);

    window.html2pdf()
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
