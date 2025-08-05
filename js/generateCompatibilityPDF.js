// Portrait PDF generator with two partner bars, numeric values, and match flags
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;

    downloadBtn.addEventListener('click', () => {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser.");
        window.print();
        return;
      }

      generateCompatibilityPDF(window.compatibilityData);
    });
  });
}

export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 20;
  const maxY = 270;
  const barWidth = 30;

  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 297, 'F');
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  function drawHeaderRow() {
    doc.setFontSize(12);
    doc.text('Kink', margin, y);
    doc.text('A', 100, y);
    doc.text('B', 130, y);
    doc.text('%', 160, y);
    y += 5;
  }

  function drawCategoryTitle(title) {
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 255);
    doc.text(title, margin, y);
    y += 6;
  }

  function drawBar(x, y, percent, color) {
    doc.setDrawColor(255);
    doc.setFillColor(60, 60, 60);
    doc.rect(x, y, barWidth, 4, 'F');
    doc.setFillColor(...color);
    doc.rect(x, y, (barWidth * percent) / 100, 4, 'F');
  }

  function getColor(p) {
    if (p >= 80) return [0, 200, 0];
    if (p <= 40) return [200, 0, 0];
    return [255, 204, 0];
  }

  function getMatchFlag(pA, pB) {
    const diff = Math.abs(pA - pB);
    const max = Math.max(pA, pB);
    if (pA === pB && pA >= 4) return '⭐';
    if (diff <= 1 && max >= 4) return '🟩';
    if (diff >= 3 && max >= 3) return '🚩';
    return '';
  }

  function drawRow(item) {
    const { kink, partnerA, partnerB } = item;
    const pctA = partnerA * 20;
    const pctB = partnerB * 20;

    const match = 100 - Math.abs(pctA - pctB);
    const flag = getMatchFlag(partnerA, partnerB);

    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text(kink.substring(0, 40), margin, y);

    drawBar(95, y - 3, pctA, getColor(pctA));
    drawBar(125, y - 3, pctB, getColor(pctB));

    doc.setTextColor(200);
    doc.text(`${partnerA}`, 93, y);
    doc.text(`${partnerB}`, 123, y);

    doc.text(`${match}% ${flag}`, 165, y);
    y += 6;

    if (y > maxY) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, 297, 'F');
      y = 20;
    }
  }

  drawHeaderRow();

  data.categories.forEach(category => {
    drawCategoryTitle(category.name);
    category.items.forEach(drawRow);
    y += 4;
  });

  doc.save('compatibility_report.pdf');
}

