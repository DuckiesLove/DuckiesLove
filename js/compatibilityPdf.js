import { loadJsPDF } from './loadJsPDF.js';

// Styling configuration for PDF output
const defaultTheme = {
  background: [0, 0, 0],
  textTitle: [255, 255, 255],
  textLabel: [255, 255, 255],
  categoryHeader: [255, 0, 0],
  barBackground: [50, 50, 50],
  barGood: [0, 200, 0],
  barWarn: [200, 50, 50],
  barZero: [80, 80, 80],
  font: 'helvetica'
};

export async function generateCompatibilityPDF(data) {
  const theme = defaultTheme;
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const kinkX = margin;
  const barWidth = 50;
  const barAX = 100;
  const barBX = 160;

  const paintBackground = () => {
    doc.setFillColor(...theme.background);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  paintBackground();

  let y = 20;

  doc.setFont(theme.font, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...theme.textTitle);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 12;

  for (const category of data.categories) {
    if (y > pageHeight - 40) {
      doc.addPage();
      paintBackground();
      y = 20;
      doc.setFont(theme.font, 'bold');
    }

    // Category header
    doc.setTextColor(...theme.categoryHeader);
    doc.setFontSize(14);
    doc.text(category.name, margin, y);
    y += 8;

    // Column headers
    doc.setTextColor(...theme.textLabel);
    doc.setFontSize(10);
    doc.text('Kink', kinkX, y);
    doc.text('Partner A', barAX, y);
    doc.text('Partner B', barBX, y);
    y += 6;

    for (const kink of category.items) {
      if (y > pageHeight - 20) {
        doc.addPage();
        paintBackground();
        y = 20;
        doc.setTextColor(...theme.textLabel);
        doc.setFont(theme.font, 'normal');
      }

      const percentA = toPercent(kink.partnerA);
      const percentB = toPercent(kink.partnerB);

      doc.setFont(theme.font, 'normal');
      doc.setFontSize(10);
      doc.text(kink.kink, kinkX, y);

      drawBar(doc, percentA, barAX, y - 4, barWidth, theme);
      drawBar(doc, percentB, barBX, y - 4, barWidth, theme);

      y += 8;
    }

    y += 4;
  }

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
function drawBar(doc, percent, x, y, width, theme) {
  const height = 5;
  const color = getBarColor(percent, theme);

  if (percent === 0) {
    doc.setFillColor(...color);
    doc.rect(x, y, width, height, 'F');
  } else {
    doc.setFillColor(...theme.barBackground);
    doc.rect(x, y, width, height, 'F');
    const fillWidth = (percent / 100) * width;
    doc.setFillColor(...color);
    doc.rect(x, y, fillWidth, height, 'F');
  }

  doc.setTextColor(...theme.textLabel);
  doc.setFontSize(8);
  doc.text(`${percent}%`, x + width + 2, y + height - 1);
}

// Returns RGB based on match %
function getBarColor(percent, theme) {
  if (percent >= 60) return theme.barGood; // Green
  if (percent > 0) return theme.barWarn;   // Red
  return theme.barZero;                    // Gray
}

function toPercent(val) {
  if (typeof val !== 'number') return 0;
  return val <= 5 ? Math.round((val / 5) * 100) : Math.round(val);
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

