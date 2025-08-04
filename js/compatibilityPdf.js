import { loadJsPDF } from './loadJsPDF.js';

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
  const usableWidth = pageWidth - margin * 2;

  // Fill the background black
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let y = 20;

  // Title
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  data.categories.forEach(category => {
    if (y > 250) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255);
      y = 20;
    }

    // Category Header
    const flag = getMatchFlag(category.matchPercent);
    doc.setFillColor(20, 20, 20);
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(14);
    doc.rect(margin, y, usableWidth, 10, 'F');
    doc.text(`${flag} ${category.name}`, pageWidth / 2, y + 7, { align: 'center' });
    y += 12;

    // Column Headers
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.setFillColor(40, 40, 40);
    doc.rect(margin, y, usableWidth, 8, 'F');
    doc.text('Kink', margin + 2, y + 6);
    doc.text('Partner A', pageWidth / 2 - 15, y + 6);
    doc.text('Partner B', pageWidth / 2 + 35, y + 6);
    y += 9;

    // Kinks
    category.items.forEach(kink => {
      const rowHeight = 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(255);
      doc.setFontSize(9);
      doc.text(kink.kink, margin + 2, y + 5);

      drawBar(doc, kink.partnerA, pageWidth / 2 - 35, y + 1, 30);
      drawBar(doc, kink.partnerB, pageWidth / 2 + 15, y + 1, 30);

      y += rowHeight;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
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

// Draws a color-coded bar
function drawBar(doc, percent, x, y, width) {
  const height = 5;
  const color = getBarColor(percent);
  doc.setFillColor(...color);
  const fillWidth = (percent / 100) * width;
  doc.roundedRect(x, y, width, height, 1, 1);
  if (percent > 0) {
    doc.roundedRect(x, y, fillWidth, height, 1, 1, 'F');
  }
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.text(`${percent}%`, x + width + 2, y + 4);
}

// Returns RGB based on match %
function getBarColor(percent) {
  if (percent >= 80) return [0, 255, 0];     // Green
  if (percent >= 40) return [255, 80, 80];   // Red
  return [100, 100, 100];                    // Gray
}

// Adds flag based on compatibility level
function getMatchFlag(percent) {
  if (percent >= 90) return '⭐';
  if (percent >= 80) return '🟩';
  if (percent <= 30) return '🚩';
  return '';
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

