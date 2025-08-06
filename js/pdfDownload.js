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

    const data = window.compatibilityData;
    const categories = Array.isArray(data) ? data : data?.categories;
    if (!categories || categories.length === 0) {
      alert('Both surveys must be uploaded before generating PDF.');
      return;
    }

    generateCompatibilityPDF(data);
  });
});

export {};
