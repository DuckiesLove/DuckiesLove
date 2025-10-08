import { buildLayout, getMatchPercentage, renderCategorySection } from './compatibilityReportHelpers.js';
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

  const categories = Array.isArray(data) ? data : data?.categories || [];
  if (categories.length === 0) {
    console.warn('generateCompatibilityPDF called without data');
  }
  let y = 20;

  drawBackground();
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', 105, y);
  y += 10;

  const sectionStyle = {
    textColor: [255, 255, 255],
    borderColor: [100, 100, 100],
    borderWidth: 0.8,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 14,
    backgroundColor: null,
  };

  const sectionBaseHeight = 13 + 10; // header + column titles
  const rowHeight = 12;

  for (const category of categories) {
    const rawItems = Array.isArray(category.items) ? category.items : [];
    let index = 0;

    while (index < rawItems.length) {
      const remainingItems = rawItems.slice(index);
      const availableSpace = config.maxY - (y + sectionStyle.paddingTop + sectionStyle.paddingBottom);
      let maxRows = Math.floor((availableSpace - sectionBaseHeight) / rowHeight);

      if (maxRows < 1) {
        doc.addPage();
        drawBackground();
        y = 20;
        continue;
      }

      const chunk = remainingItems.slice(0, Math.max(1, maxRows));
      const formatted = chunk.map((item) => {
        const aScoreRaw = typeof item.a === 'number'
          ? item.a
          : typeof item.partnerA === 'number'
            ? item.partnerA
            : typeof item.scoreA === 'number'
              ? item.scoreA
              : null;
        const bScoreRaw = typeof item.b === 'number'
          ? item.b
          : typeof item.partnerB === 'number'
            ? item.partnerB
            : typeof item.scoreB === 'number'
              ? item.scoreB
              : null;

        const matchPercent =
          aScoreRaw !== null && bScoreRaw !== null
            ? getMatchPercentage(aScoreRaw, bScoreRaw)
            : null;

        const label = item.label || item.kink || item.name || '';

        if (DEBUG) {
          console.log('Rendering:', label, 'A:', aScoreRaw, 'B:', bScoreRaw);
        }

        return {
          label: shortenLabel(label),
          partnerA: aScoreRaw,
          partnerB: bScoreRaw,
          match: matchPercent,
        };
      });

      const sectionLabel = index === 0
        ? (category.category || category.name)
        : `${category.category || category.name} (cont.)`;

      const endY = renderCategorySection(
        doc,
        sectionLabel,
        formatted,
        layout,
        y,
        sectionStyle
      );

      y = endY + sectionStyle.paddingBottom + 8;
      index += formatted.length;
    }

    if (rawItems.length === 0) {
      const endY = renderCategorySection(
        doc,
        category.category || category.name,
        [],
        layout,
        y,
        sectionStyle
      );
      y = endY + sectionStyle.paddingBottom + 8;
    }
  }

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
