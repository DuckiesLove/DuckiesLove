import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margin = 10;
  const pageWidth = 210 - margin * 2;
  const kinkWidth = pageWidth * 0.55;
  const partnerWidth = pageWidth * 0.2;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', 105, 15, { align: 'center' });

  data.categories.forEach(category => {
    const flag = getMatchFlag(category.matchPercent);
    const headerText = `${flag ? flag + ' ' : ''}${category.name}`;

    // Header
    doc.setFillColor(30, 30, 30);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, pageWidth, 10, 'F');
    doc.setFontSize(13);
    doc.text(headerText, margin + 2, y + 7);
    y += 12;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');

    category.items.forEach(kink => {
      const kinkLines = doc.splitTextToSize(kink.kink, kinkWidth);
      const rowHeight = kinkLines.length * 5;

      doc.text(kinkLines, margin, y);
      doc.text(`${kink.partnerA}`, margin + kinkWidth + 5, y);
      doc.text(`${kink.partnerB}`, margin + kinkWidth + partnerWidth + 10, y);
      y += rowHeight;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}
