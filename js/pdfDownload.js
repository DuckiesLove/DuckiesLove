import generateCompatibilityPDF from './rawSurveyPdf.js';
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

    const partnerAData = {};
    const partnerBData = {};
    categories.forEach(cat => {
      const name = cat.category || cat.name;
      partnerAData[name] = {};
      partnerBData[name] = {};
      (cat.items || []).forEach(item => {
        const label = item.label || item.kink || item.name;
        const scoreA = typeof item.a === 'number'
          ? item.a
          : typeof item.partnerA === 'number'
            ? item.partnerA
            : typeof item.scoreA === 'number'
              ? item.scoreA
              : undefined;
        const scoreB = typeof item.b === 'number'
          ? item.b
          : typeof item.partnerB === 'number'
            ? item.partnerB
            : typeof item.scoreB === 'number'
              ? item.scoreB
              : undefined;
        partnerAData[name][label] = scoreA;
        partnerBData[name][label] = scoreB;
      });
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    // Set black background
    doc.setFillColor(0, 0, 0);
    doc.rect(
      0,
      0,
      doc.internal.pageSize.getWidth(),
      doc.internal.pageSize.getHeight(),
      'F'
    );

    // Set default text color to white
    doc.setTextColor(255, 255, 255);

    // Set default font and position
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.y = 50; // initial y position

    generateCompatibilityPDF(partnerAData, partnerBData, doc);
    doc.save('kink-compatibility.pdf');
  });
});

export {};
