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
  const pageWidth = doc.internal.pageSize.getWidth() - pageMargin * 2;
  const pageHeight = doc.internal.pageSize.getHeight() - pageMargin * 2;
  const kinkColWidth = pageWidth * 0.55;
  const partnerColWidth = (pageWidth - kinkColWidth) / 2;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', doc.internal.pageSize.getWidth() / 2, 15, {
    align: 'center'
  });

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
      const rowHeight = Math.max(kinkLines.length * 5, 5);

      doc.text(kinkLines, pageMargin, y);
      const midY = y + rowHeight / 2;
      doc.text(`${kink.partnerA}`, pageMargin + kinkColWidth + 5, midY, {
        baseline: 'middle'
      });
      doc.text(`${kink.partnerB}`, pageMargin + kinkColWidth + partnerColWidth + 10, midY, {
        baseline: 'middle'
      });
      y += rowHeight + 2;

      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }
    });

    y += 6;
  });

  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
