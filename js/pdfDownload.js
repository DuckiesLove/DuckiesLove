import generateCompatibilityPDF from './generateCompatibilityPDF.js';
import { loadJsPDF } from './loadJsPDF.js';

// Attach click handler for the Download PDF button
window.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', async () => {
    await loadJsPDF();
    if (!window.jspdf || !window.jspdf.jsPDF || window.jspdf.isStub) {
      alert(
        "PDF library failed to load. Printing instead—choose 'Save as PDF'."
      );
      try {
        window.print && window.print();
      } catch {}
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
