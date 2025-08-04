import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const barWidth = 40;
  const labelX = margin + 2;
  const partnerAX = pageWidth / 2 - 10;
  const partnerBX = pageWidth - margin - barWidth;
  const rowHeight = 8;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    const matchFlag = getMatchFlag(category.matchPercent);
    const shortName = shortenCategoryName(category.name);
    const header = `${shortName} ${matchFlag}`;

    doc.setFillColor(0);
    doc.setTextColor(255, 0, 0);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.text(header, labelX, y + 6);
    y += 10;

    doc.setTextColor(255);
    doc.text('Kink', labelX, y);
    doc.text('Partner A', partnerAX, y);
    doc.text('Partner B', partnerBX, y);
    y += 6;

    category.items.forEach(kink => {
      if (y > pageHeight - 27) {
        doc.addPage();
        doc.setFillColor(20, 20, 20);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }

      doc.setTextColor(255);
      const label = kink.kink.length > 50 ? kink.kink.slice(0, 47) + '…' : kink.kink;
      doc.text(label, labelX, y);

      const percentA = toPercent(kink.partnerA);
      const percentB = toPercent(kink.partnerB);

      drawBar(doc, partnerAX, y - 3, percentA);
      drawBar(doc, partnerBX, y - 3, percentB);

      doc.setTextColor(200);
      doc.setFontSize(8);
      doc.text(`${percentA}%`, partnerAX + barWidth + 2, y);
      doc.text(`${percentB}%`, partnerBX + barWidth + 2, y);
      doc.setFontSize(10);

      y += rowHeight;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}

function drawBar(doc, x, y, percent) {
  const barWidth = 40;
  const barHeight = 4;
  const color = getBarColor(percent);

  doc.setFillColor(50);
  doc.rect(x, y, barWidth, barHeight, 'F');

  doc.setFillColor(...color);
  const fillWidth = (percent / 100) * barWidth;
  doc.rect(x, y, fillWidth, barHeight, 'F');
}

function getBarColor(percent) {
  if (percent >= 80) return [0, 200, 0];
  if (percent <= 50) return [220, 50, 50];
  return [100, 100, 100];
}

function shortenCategoryName(name) {
  return name.length > 25 ? name.slice(0, 22) + '…' : name;
}

function toPercent(val) {
  if (typeof val !== 'number') return 0;
  return val <= 5 ? Math.round((val / 5) * 100) : Math.round(val);
}

// Generate a PDF listing all kinks with their combined score in landscape mode
// Combined score is the average of Partner A and Partner B ratings when both
// are present; otherwise the existing rating is shown or '-' if none exist.
export async function generateCompatibilityPDFLandscape(data) {
  const jsPDF = await loadJsPDF();
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

// Helper: Title
function drawTitle(doc, pageWidth) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
}

// Helper: Combined score calculation
function combinedScore(a, b) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  if (aNum === null && bNum === null) return '-';
  if (aNum === null) return String(bNum);
  if (bNum === null) return String(aNum);
  const avg = (aNum + bNum) / 2;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

