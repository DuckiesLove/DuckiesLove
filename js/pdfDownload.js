import generateCompatibilityPDF from './generateCompatibilityPDF.js';

// Attach click handler for the Download PDF button
window.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF library failed to load. Please try again or refresh.');
      return;
    }

    const compatibilityData = window.compatibilityData;
    if (!compatibilityData || !compatibilityData.categories) {
      alert('Both surveys must be uploaded before generating PDF.');
      return;
    }

    generateCompatibilityPDF(compatibilityData);
  });
});

export {};
