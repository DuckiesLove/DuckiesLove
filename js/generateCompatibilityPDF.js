// File: js/generateCompatibilityPDF.js
// Full fix for "null" values, layout, and emoji flags.
// Assumes jsPDF is loaded on window.jspdf.

function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 297, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Column positions
  const leftColX = 10;
  const middleFlagX = 100;
  const partnerAX = 120;
  const partnerBX = 160;

  // Category header styling
  const drawCategoryHeader = (title) => {
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 255, 255);
    doc.text(title, leftColX, y);
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
  };

  const categories = Array.isArray(data?.categories)
    ? data.categories
    : Array.isArray(data)
    ? data
    : [];

  categories.forEach(category => {
    drawCategoryHeader(category.name);

    const items = category.items || category.kinks || [];
    items.forEach(item => {
      const label = item.labelShortened || item.label || item.kink || '—';
      const wrappedLabel = doc.splitTextToSize(label, 85);

      const partnerA = typeof item.partnerA === 'number' ? String(item.partnerA) : '–';
      const partnerB = typeof item.partnerB === 'number' ? String(item.partnerB) : '–';
      const match = typeof item.matchPercentage === 'number' ? item.matchPercentage : 0;

      let flag = '';
      if (match >= 90) flag = '⭐';
      else if (match >= 80) flag = '🟩';
      else if (match <= 40) flag = '🚩';

      doc.text(wrappedLabel, leftColX, y);
      doc.text(flag, middleFlagX, y);
      doc.text(partnerA, partnerAX, y);
      doc.text(partnerB, partnerBX, y);

      y += wrappedLabel.length * 5 + 2;

      // Page break
      if (y > 280) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, 297, 'F');
        doc.setTextColor(255, 255, 255);
        y = 20;
      }
    });
  });

  doc.save('compatibility_report.pdf');
}

// Hook up button if running in browser
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadPdfBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!window.jspdf?.jsPDF) {
        alert('PDF library failed to load. Printing the page instead—choose Save as PDF in your browser.');
        return;
      }
      const data = window.compatibilityData?.categories || [];
      generateCompatibilityPDF(data);
    });
  });
}

// Export for module usage
export { generateCompatibilityPDF };
