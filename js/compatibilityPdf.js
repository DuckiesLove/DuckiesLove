import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  const pageWidth = 210;
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const kinkColWidth = usableWidth * 0.5;
  const partnerColWidth = usableWidth * 0.25;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    const flag = getMatchFlag(category.matchPercent);
    const header = `${flag ? flag + ' ' : ''}${category.name}`;

    doc.setTextColor(255);
    doc.setFillColor(40, 40, 40);
    doc.rect(margin, y, usableWidth, 10, 'F');
    doc.text(header, margin + 3, y + 7);

    y += 12;

    category.items.forEach(item => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(item.kink, margin, y, { maxWidth: kinkColWidth });
      doc.text(String(item.partnerA ?? '-'), margin + kinkColWidth + 2, y);
      doc.text(String(item.partnerB ?? '-'), margin + kinkColWidth + partnerColWidth + 2, y);
      y += 6;
    });

    y += 5;
  });

  doc.save('compatibility_report.pdf');
}
