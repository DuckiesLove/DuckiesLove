import { getFlagEmoji, getMatchColor } from './matchFlag.js';

export function generateCompatibilityPDF() {
  console.log('PDF function triggered');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  const config = {
    margin: 10,
    rowHeight: 10,
    barHeight: 9,
    maxY: 190
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = config.margin;
  const usableWidth = pageWidth - startX * 2;

  const colLabel = startX;
  const colA = startX + usableWidth * 0.53;
  const barWidth = usableWidth * 0.13;
  const colBar = colA + usableWidth * 0.09;
  const colFlag = colBar + barWidth + 6;
  const colB = startX + usableWidth * 0.88;

  const layout = {
    colLabel,
    colA,
    barWidth,
    colBar,
    colFlag,
    colB,
    barHeight: config.barHeight,
  };

  const shortenLabel = (label) => {
    const map = {
      "Choosing my partner's outfit for the day or a scene": "Choosing outfit",
      "Selecting their underwear, lingerie or base layers": "Picking underwear",
      "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
      "Picking head coverings (veils, hoods, hats)": "Headwear",
      "Offering makeup, polish, or accessories": "Makeup/accessories",
      "Creating themed looks (slutty, innocent, etc)": "Themed looks",
      "Dressing them in role-specific costumes": "Roleplay outfits",
      "Curating time-period or historical outfits": "Historical outfits",
      "Helping them present more femme/masc": "Femme/masc styling",
      "Coordinating their look with mine": "Matching outfits",
      "Implementing a 'dress ritual' or aesthetic preparation": "Dress ritual",
      "Enforcing a visual protocol (e.g. no bra, pigtails)": "Visual protocol",
      "Having my outfit selected for me by partner": "Partner-picked outfit",
      "Wearing chosen lingerie/underwear": "Chosen lingerie",
      "Having my hair brushed, braided, styled": "Hair styled by partner"
    };
    if (!label) return '';
    return map[label] || label.slice(0, 40);
  };

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 297, 210, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const drawBar = (match, x, baselineY, layout) => {
    const y = baselineY - layout.barHeight + 2.5;
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y, layout.barWidth, layout.barHeight, 'F');
    if (match !== null && match !== undefined) {
      const color = getMatchColor(match);
      doc.setFillColor(color);
      doc.rect(x, y, layout.barWidth * (match / 100), layout.barHeight, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text(`${match}%`, x + layout.barWidth / 2, y + layout.barHeight / 2, {
        align: 'center',
        baseline: 'middle',
      });
    } else {
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text('N/A', x + layout.barWidth / 2, y + layout.barHeight / 2, {
        align: 'center',
        baseline: 'middle',
      });
    }
    doc.setTextColor(255);
  };

  const data = window.compatibilityData;
  const categories = Array.isArray(data) ? data : data?.categories || [];
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
      const scoreA = aScoreRaw !== null ? String(aScoreRaw) : 'N/A';
      const scoreB = bScoreRaw !== null ? String(bScoreRaw) : 'N/A';
      const matchPercent =
        aScoreRaw !== null && bScoreRaw !== null
          ? Math.max(0, 100 - Math.abs(aScoreRaw - bScoreRaw) * 25)
          : null;
      const flagIcon =
        matchPercent === null ? '' : getFlagEmoji(matchPercent, aScoreRaw, bScoreRaw);
      const label = item.label || item.kink || '';

      console.log('Rendering:', label, 'A:', scoreA, 'B:', scoreB);

      doc.setFontSize(9);
      doc.text(shortenLabel(label), layout.colLabel, y);
      doc.text(scoreA, layout.colA, y);
      drawBar(matchPercent, layout.colBar, y, layout);
      if (flagIcon) doc.text(flagIcon, layout.colFlag, y);
      doc.text(scoreB, layout.colB, y);

      y += config.rowHeight;
    });
  });

  doc.save('compatibility_report.pdf');
}

if (typeof document !== 'undefined') {
  const attachHandler = () => {
    const button = document.getElementById('downloadPdfBtn');
    if (button) {
      button.addEventListener('click', generateCompatibilityPDF);
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

export function generateCompatibilityPDFLandscape(data) {
  const categories = Array.isArray(data) ? data : data?.categories || [];
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

  const allItems = categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.a ?? kink.partnerA, kink.b ?? kink.partnerB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.text(kink.label || kink.kink, margin, y, { maxWidth: pageWidth - margin * 2 - 30 });
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
