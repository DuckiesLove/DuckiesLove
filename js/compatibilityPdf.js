export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  const margin = 10;
  const colA = pageWidth / 2 - 55;
  const colB = pageWidth / 2 + 45;

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawBar = (x, y, percent) => {
    const width = 40;
    const height = 6;
    let color = [255, 0, 0];
    if (percent === 100) color = [0, 255, 0];
    else if (percent >= 80) color = [0, 255, 0];
    else if (percent >= 60) color = [255, 255, 0];

    doc.setFillColor(64, 64, 64);
    doc.rect(x, y, width, height, 'F');
    doc.setFillColor(...color);
    doc.rect(x, y, (percent / 100) * width, height, 'F');
  };

  const getFlag = (match) => {
    if (match === 100) return '⭐';
    if (match >= 80) return '🟩';
    if (match <= 50) return '🚩';
    return '';
  };

  const addPage = () => {
    doc.addPage();
    drawBackground();
    y = 20;
  };

  drawBackground();
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 12;
  doc.setFontSize(14);

  data.categories.forEach((cat) => {
    if (y > pageHeight - 30) addPage();
    doc.setFont('helvetica', 'bold');
    doc.text(cat.name, margin, y);
    y += 8;

    cat.items.forEach((item) => {
      if (y > pageHeight - 20) addPage();

      const label = item.kink.length > 45 ? item.kink.slice(0, 42) + '…' : item.kink;
      const partnerA = typeof item.partnerA === 'number' ? item.partnerA : 0;
      const partnerB = typeof item.partnerB === 'number' ? item.partnerB : 0;
      const compatibility = 100 - Math.abs(partnerA - partnerB);
      const flag = getFlag(compatibility);

      doc.setFont('helvetica', 'normal');
      doc.text(label, margin, y);

      // Partner A score box
      doc.setDrawColor(255);
      doc.rect(colA, y - 4, 12, 6);
      doc.setTextColor(255, 255, 255);
      doc.text(`${partnerA}%`, colA + 1.5, y);

      // Compatibility bar and flag
      drawBar(pageWidth / 2 - 20, y - 4, compatibility);
      doc.text(flag, pageWidth / 2 + 24, y);

      // Partner B score box
      doc.setDrawColor(255);
      doc.rect(colB, y - 4, 12, 6);
      doc.setTextColor(255, 255, 255);
      doc.text(`${partnerB}%`, colB + 1.5, y);

      y += 8;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}

export function generateCompatibilityPDFLandscape(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(255);

  let y = 20;

  drawTitle(doc, pageWidth);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kink', margin, y);
  doc.text('Combined Score', pageWidth - margin, y, { align: 'right' });
  y += 6;

  const allItems = data.categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.partnerA, kink.partnerB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.text(kink.kink, margin, y, { maxWidth: pageWidth - margin * 2 - 30 });
    doc.text(score, pageWidth - margin, y, { align: 'right' });
    y += 6;
    if (y > pageHeight - 20) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255);
      y = 20;
    }
  });

  doc.save('compatibility_report_landscape.pdf');
}

function drawTitle(doc, pageWidth) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
}

function combinedScore(a, b) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  if (aNum === null && bNum === null) return '-';
  if (aNum === null) return String(bNum);
  if (bNum === null) return String(aNum);
  const avg = (aNum + bNum) / 2;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}
