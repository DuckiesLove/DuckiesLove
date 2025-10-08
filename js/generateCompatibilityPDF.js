import { renderCategorySection, buildLayout } from './compatibilityReportHelpers.js';
import { shortenLabel } from './labelShortener.js';

// Default PDF layout settings
const defaultPdfStyles = {
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  headingFont: 'helvetica',
  bodyFont: 'helvetica',
  barHeight: 10,
  barSpacing: 6,
  barColors: {
    green: 'green',
    yellow: 'yellow',
    red: 'red',
    black: 'black'
  },
  sectionPaddingX: 12,
  sectionPaddingY: 10,
  sectionOutlineColor: '#3a3a3a',
  sectionOutlineWidth: 0.8,
  sectionBackgroundColor: null
};

// Icon used in history rows based on score percentage
function getHistoryIcon(score) {
  if (typeof score !== 'number') return '⚪';
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

export function generateCompatibilityPDF(compatibilityData, styleOptions = {}) {
  const pdfStyles = { ...defaultPdfStyles, ...styleOptions };

  const categories = Array.isArray(compatibilityData)
    ? compatibilityData
    : compatibilityData?.categories || [];
  const history = Array.isArray(compatibilityData) ? [] : compatibilityData?.history || [];
  const jsPDFCtor =
    (window.jspdf && window.jspdf.jsPDF) ||
    (window.jsPDF && window.jsPDF.jsPDF) ||
    window.jsPDF;
  if (!jsPDFCtor) {
    throw new Error('jsPDF failed to load');
  }
  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = pdfStyles.barHeight + pdfStyles.barSpacing;

  const drawBackground = () => {
    doc.setFillColor(pdfStyles.backgroundColor);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(pdfStyles.textColor);
  };

  drawBackground();
  doc.setFont(pdfStyles.headingFont, 'bold');
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, 40, { align: 'center' });

  const columnGap = 20;
  const columnWidth = (usableWidth - columnGap) / 2;
  const columnX = [margin, margin + columnWidth + columnGap];
  const columnY = [80, 80];
  let currentColumn = 0;

  categories.forEach(category => {
    const items = category.items.map(item => {
      const partnerA = typeof item.a === 'number' ? item.a :
        typeof item.partnerA === 'number' ? item.partnerA :
        typeof item.scoreA === 'number' ? item.scoreA : null;
      const partnerB = typeof item.b === 'number' ? item.b :
        typeof item.partnerB === 'number' ? item.partnerB :
        typeof item.scoreB === 'number' ? item.scoreB : null;
      const match = item.match !== undefined ? item.match :
        (partnerA === null || partnerB === null ? null : Math.max(0, 100 - Math.abs(partnerA - partnerB) * 20));
      const fullLabel = item.label || item.kink || item.name || '';
      return {
        label: shortenLabel(fullLabel),
        partnerA,
        partnerB,
        match
      };
    });

    const sectionHeight = 23 + items.length * 12 + pdfStyles.barSpacing;
    while (columnY[currentColumn] + sectionHeight > pageHeight - margin) {
      if (currentColumn === 0) {
        currentColumn = 1;
      } else {
        doc.addPage();
        drawBackground();
        columnY[0] = margin;
        columnY[1] = margin;
        currentColumn = 0;
      }
    }

    const layout = buildLayout(columnX[currentColumn], columnWidth);
    const endY = renderCategorySection(
      doc,
      category.category || category.name,
      items,
      layout,
      columnY[currentColumn],
      {
        textColor: pdfStyles.textColor,
        borderColor: pdfStyles.sectionOutlineColor,
        borderWidth: pdfStyles.sectionOutlineWidth,
        paddingTop: pdfStyles.sectionPaddingY,
        paddingRight: pdfStyles.sectionPaddingX,
        paddingBottom: pdfStyles.sectionPaddingY,
        paddingLeft: pdfStyles.sectionPaddingX,
        backgroundColor: pdfStyles.sectionBackgroundColor,
      }
    );
    columnY[currentColumn] = endY + pdfStyles.barSpacing;
  });

  let y = Math.max(columnY[0], columnY[1]);

  // Render compatibility history if available
  const recentHistory = history.slice(-5).reverse();
  if (recentHistory.length) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      drawBackground();
      y = margin;
    }

    doc.setFont(pdfStyles.headingFont, 'bold');
    doc.setFontSize(14);
    doc.text('Compatibility History', pageWidth / 2, y, { align: 'center' });
    y += pdfStyles.barSpacing * 2;

    doc.setFont(pdfStyles.bodyFont, 'normal');
    doc.setFontSize(10);

    recentHistory.forEach(entry => {
      const date = new Date(entry.date || entry.timestamp || entry.time || Date.now());
      const dateStr = date.toLocaleString();
      const score = typeof entry.score === 'number' ? `${entry.score}%` : 'N/A';
      const icon = getHistoryIcon(entry.score);

      doc.text(icon, margin, y);
      doc.text(dateStr, margin + 15, y);
      doc.text(score, pageWidth - margin, y, { align: 'right' });

      y += lineHeight;
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        drawBackground();
        y = margin;
      }
    });
  }

  doc.save('kink-compatibility.pdf');
  return doc;
}

export default generateCompatibilityPDF;
