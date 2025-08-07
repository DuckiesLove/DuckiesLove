import { applyPrintStyles } from './theme.js';

// Attach click handler for the Download PDF button
window.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', () => {
    const data = window.compatibilityData;
    const categories = Array.isArray(data) ? data : data?.categories;
    if (!categories || categories.length === 0) {
      alert('Both surveys must be uploaded before generating PDF.');
      return;
    }

    if (typeof window.html2pdf !== 'function') {
      alert("PDF library failed to load. Printing instead—choose 'Save as PDF'.");
      try {
        window.print && window.print();
      } catch {}
      return;
    }

    const mode =
      localStorage.getItem('theme') ||
      [...document.body.classList]
        .find(cls => cls.startsWith('theme-'))?.replace('theme-', '') ||
      'dark';
    applyPrintStyles(mode);

    const element = document.getElementById('pdf-container');
    if (!element) {
      alert('PDF content not found.');
      return;
    }

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
          scrollY: 0,
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all'] },
      })
      .from(element)
      .save();
  });
});

export {};
