export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = 20;

  const barWidth = 40;
  const maxY = pageHeight - 20;
  const colA = 120;
  const colB = 160;

  function drawBackground() {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  function drawBar(x, y, percent, color) {
    doc.setDrawColor(255);
    doc.setFillColor(40, 40, 40);
    doc.rect(x, y, barWidth, 4, 'F');
    doc.setFillColor(...color);
    doc.rect(x, y, (barWidth * percent) / 100, 4, 'F');
  }

  function getColor(percent) {
    if (percent >= 80) return [0, 200, 0];
    if (percent <= 50) return [255, 0, 0];
    return [255, 204, 0];
  }

  function drawCategoryHeader(name) {
    doc.setTextColor(255);
    doc.setFillColor(0, 0, 0);
    doc.setFontSize(12);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.text(name, margin + 2, y + 6);
    y += 10;
  }

  function drawItem(kink, a, b) {
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text(kink, margin + 2, y);
    drawBar(colA, y - 3, a * 20, getColor(a * 20));
    drawBar(colB, y - 3, b * 20, getColor(b * 20));
    y += 8;
  }

  drawBackground();
  doc.setTextColor(255);
  doc.setFillColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
  y = 25;

  data.categories.forEach(category => {
    if (y > maxY) {
      doc.addPage();
      drawBackground();
      y = 20;
    }
    drawCategoryHeader(category.name);
    category.items.forEach(item => {
      if (y > maxY) {
        doc.addPage();
        drawBackground();
        y = 20;
      }
      drawItem(item.kink, item.partnerA, item.partnerB);
    });
    y += 5;
  });

  doc.save('compatibility_report.pdf');
}

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
