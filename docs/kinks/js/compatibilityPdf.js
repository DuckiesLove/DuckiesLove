import { getFlagEmoji } from './matchFlag.js';
import { buildLayout, drawMatchBar, getMatchPercentage } from './compatibilityReportHelpers.js';
import { shortenLabel } from './labelShortener.js';
const DEBUG = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export async function generateCompatibilityPDF(data = { categories: [] }) {
  if (DEBUG) {
    console.log('PDF function triggered');
  }

  const jsPDFCtor =
    (window.jspdf && window.jspdf.jsPDF) ||
    (window.jsPDF && window.jsPDF.jsPDF) ||
    window.jsPDF;
  if (!jsPDFCtor) {
    throw new Error('jsPDF failed to load');
  }
  const doc = new jsPDFCtor({ orientation: 'landscape' });

  const config = {
    margin: 10,
    rowHeight: 10,
    barHeight: 9,
    maxY: 190
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = config.margin;
  const usableWidth = pageWidth - startX * 2;

  const layout = buildLayout(startX, usableWidth);

  const drawBackground = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const drawBar = (match, x, baselineY, layout) => {
    const y = baselineY - layout.barHeight + 2.5;
    drawMatchBar(doc, x, y, layout.barWidth, layout.barHeight, match);
  };

  const categories = Array.isArray(data) ? data : data?.categories || [];
  if (categories.length === 0) {
    console.warn('generateCompatibilityPDF called without data');
  }
  let y = 20;

  drawBackground();
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', 105, y);
  y += 10;

  categories.forEach(category => {
    if (y > config.maxY) {
      doc.addPage();
      drawBackground();
      y = 20;
    }

    doc.setFontSize(12);
    doc.text(category.category || category.name, layout.colLabel, y);
    y += 6;

    doc.setFontSize(10);
    doc.text('Partner A', layout.colA, y);
    doc.text('Match', layout.colBar, y);
    doc.text('Flag', layout.colFlag, y);
    doc.text('Partner B', layout.colB, y);
    y += 6;

    category.items.forEach(item => {
      if (y > config.maxY) {
        doc.addPage();
        drawBackground();
        y = 20;

        doc.setFontSize(12);
        doc.text(category.category || category.name, layout.colLabel, y);
        y += 6;
        doc.setFontSize(10);
        doc.text('Partner A', layout.colA, y);
        doc.text('Match', layout.colBar, y);
        doc.text('Flag', layout.colFlag, y);
        doc.text('Partner B', layout.colB, y);
        y += 6;
      }

      const aScoreRaw = typeof item.a === 'number'
        ? item.a
        : typeof item.partnerA === 'number'
          ? item.partnerA
          : null;
      const bScoreRaw = typeof item.b === 'number'
        ? item.b
        : typeof item.partnerB === 'number'
          ? item.partnerB
          : null;

      let scoreA = 'N/A';
      let scoreB = 'N/A';
      let matchPercent = null;
      let flagIcon = 'N/A';

      if (aScoreRaw !== null && bScoreRaw !== null) {
        scoreA = String(aScoreRaw);
        scoreB = String(bScoreRaw);
        matchPercent = getMatchPercentage(aScoreRaw, bScoreRaw);
        flagIcon = getFlagEmoji(matchPercent, aScoreRaw, bScoreRaw) || '';
      }

      const label = item.label || item.kink || '';

      if (DEBUG) {
        console.log('Rendering:', label, 'A:', scoreA, 'B:', scoreB);
      }

      doc.setFontSize(9);
      doc.text(shortenLabel(label), layout.colLabel, y);
      doc.text(scoreA, layout.colA, y);
      drawBar(matchPercent, layout.colBar, y, layout);
      doc.text(flagIcon, layout.colFlag, y);
      doc.text(scoreB, layout.colB, y);

      y += config.rowHeight;
    });
  });

  await doc.save('compatibility_report.pdf');
}

if (typeof document !== 'undefined') {
  const attachHandler = () => {
    const button = document.getElementById('downloadPdfBtn');
    if (button) {
      button.addEventListener('click', async () => {
        try {
          if (typeof window.showSpinner === 'function') window.showSpinner();
          await generateCompatibilityPDF(window.compatibilityData);
        } finally {
          if (typeof window.hideSpinner === 'function') window.hideSpinner();
        }
      });
    } else {
      console.error('Download button not found');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandler);
  } else {
    // DOM already parsed when script loaded
    attachHandler();
  }
}

export async function generateCompatibilityPDFLandscape(data) {
  const categories = Array.isArray(data) ? data : data?.categories || [];
  const jsPDFCtor =
    (window.jspdf && window.jspdf.jsPDF) ||
    (window.jsPDF && window.jsPDF.jsPDF) ||
    window.jsPDF;
  if (!jsPDFCtor) {
    throw new Error('jsPDF failed to load');
  }
  const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const getPageMetrics = () => ({
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight()
  });
  const drawBackground = () => {
    const { width, height } = getPageMetrics();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, height, 'F');
    doc.setTextColor(255, 255, 255);
  };
  const { width: pageWidth, height: pageHeight } = getPageMetrics();
  const margin = 15;

  drawBackground();

  let y = 20;

  drawTitle(doc, pageWidth);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kink', margin, y);
  doc.text('Combined Score', pageWidth - margin, y, { align: 'right' });
  y += 6;

  const allItems = categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.a ?? kink.partnerA, kink.b ?? kink.partnerB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(kink.label || kink.kink, margin, y, { maxWidth: pageWidth - margin * 2 - 30 });
    doc.text(score, pageWidth - margin, y, { align: 'right' });
    y += 6;
    if (y > pageHeight - 20) {
      doc.addPage();
      drawBackground();
      y = 20;
    }
  });

  await doc.save('compatibility_report_landscape.pdf');
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
