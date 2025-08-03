import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageMargin = 10;
  const pageWidth = 210 - pageMargin * 2;
  const kinkColWidth = 110;
  const partnerColWidth = (pageWidth - kinkColWidth) / 2;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', 105, 15, null, null, 'center');

  data.categories.forEach(category => {
    const flag = getMatchFlag(category.matchPercent);
    const headerText = `${flag ? flag + ' ' : ''}${category.name}`;

    // Header
    doc.setFillColor(30, 30, 30);
    doc.setTextColor(255, 255, 255);
    doc.rect(pageMargin, y, pageWidth, 10, 'F');
    doc.setFontSize(13);
    doc.text(headerText, pageMargin + 2, y + 7);
    y += 12;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');

    category.items.forEach(kink => {
      const kinkLines = doc.splitTextToSize(kink.kink, kinkColWidth);
      const rowHeight = kinkLines.length * 5;

      doc.text(kinkLines, pageMargin, y);
      doc.text(`${kink.partnerA}`, pageMargin + kinkColWidth + 5, y);
      doc.text(`${kink.partnerB}`, pageMargin + kinkColWidth + partnerColWidth + 10, y);
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
