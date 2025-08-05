import jsPDF from 'jspdf';

export function generateCompatibilityPDF(data) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 20;
  const margin = 10;
  const columnA = 110;
  const columnB = 170;
  const flagCol = 145;

  // Fill black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  data.forEach(category => {
    // Section Header
    doc.setFontSize(14);
    doc.setTextColor(0, 255, 255);
    doc.text(category.name || 'Untitled Section', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);

    category.items.forEach(item => {
      if (y > 270) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }

      const label = item.labelShortened || item.label || '—';
      const labelLines = doc.splitTextToSize(label, 90);

      const partnerA = typeof item.partnerA === 'number' ? `${item.partnerA}` : '–';
      const partnerB = typeof item.partnerB === 'number' ? `${item.partnerB}` : '–';
      const match = item.matchPercentage ?? 0;

      // Match flag
      let flag = '';
      if (match >= 90) flag = '⭐';
      else if (match >= 80) flag = '🟩';
      else if (match <= 40) flag = '🚩';

      doc.text(labelLines, margin, y);
      doc.text(flag, flagCol, y);
      doc.text(partnerA, columnA, y);
      doc.text(partnerB, columnB, y);

      y += labelLines.length * 5 + 2;
    });

    y += 3; // Space between categories
  });

  doc.save('compatibility_report.pdf');
}

