import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', 105, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    const flag = getMatchFlag(category.matchPercent);
    const header = `${category.name} ${flag}`;

    doc.setTextColor(255);
    doc.setFillColor(40, 40, 40);
    doc.rect(10, y, 190, 10, 'F');
    doc.text(header, 15, y + 7);
    y += 12;

    category.items.forEach(kink => {
      doc.setTextColor(0);
      doc.setFontSize(10);

      const kinkLines = doc.splitTextToSize(kink.kink, 85);
      doc.text(kinkLines, 15, y);
      doc.text(`${kink.partnerA}`, 105, y);
      doc.text(`${kink.partnerB}`, 150, y);
      y += kinkLines.length * 5;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 5;
  });

  doc.save('compatibility_report.pdf');
}
