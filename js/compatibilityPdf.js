import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

// Generate a PDF summarizing kink compatibility with match bars and column headers
// `data` structure:
// {
//   categories: [
//     {
//       name: "Category Name",
//       matchPercent: 92,
//       items: [
//         { kink: "Bondage", partnerA: 5, partnerB: 5 },
//         ...
//       ]
//     },
//     ...
//   ]
// }
export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  drawTitle(doc, pageWidth);
  y += 15;

  data.categories.forEach(category => {
    const flag = getMatchFlag(category.matchPercent);
    const header = `${category.name} ${flag}`;

    drawSectionHeader(doc, header, y, pageWidth, margin);
    y += 12;

    drawBar(doc, margin + 2, y, pageWidth - margin * 2 - 4, category.matchPercent);
    y += 8;

    drawColumnHeaders(doc, y);
    y += 6;

    category.items.forEach(kink => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(kink.kink, margin, y, { maxWidth: 90 });
      doc.text(String(kink.partnerA ?? '-'), 115, y);
      doc.text(String(kink.partnerB ?? '-'), 160, y);
      y += 6;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 8;
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
  let y = 20;

  drawTitle(doc, pageWidth);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Kink', margin, y);
  doc.text('Combined Score', pageWidth - margin, y, { align: 'right' });
  y += 6;

  const allItems = data.categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.partnerA, kink.partnerB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(kink.kink, margin, y, { maxWidth: pageWidth - margin * 2 - 30 });
    doc.text(score, pageWidth - margin, y, { align: 'right' });
    y += 6;
    if (y > pageHeight - 20) {
      doc.addPage();
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

// Helper: Section Header
function drawSectionHeader(doc, text, y, pageWidth, margin) {
  doc.setFillColor(40, 40, 40);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.text(text, pageWidth / 2, y + 7, { align: 'center' });
}

// Helper: Bar Graph
function drawBar(doc, x, y, width, percent) {
  let color;
  if (percent >= 85) color = [0, 200, 0]; // Green
  else if (percent >= 60) color = [255, 165, 0]; // Orange
  else color = [255, 0, 0]; // Red

  doc.setDrawColor(200);
  doc.setFillColor(...color);
  doc.rect(x, y, width * (percent / 100), 5, 'F');
  doc.setDrawColor(0);
  doc.rect(x, y, width, 5); // border
}

// Helper: Table Headings
function drawColumnHeaders(doc, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Kink', 15, y);
  doc.text('Partner A', 115, y);
  doc.text('Partner B', 160, y);
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

