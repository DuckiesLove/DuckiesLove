import { getFlagEmoji, getMatchColor } from './matchFlag.js';

export function generateCompatibilityPDF() {
  console.log('PDF function triggered');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  const config = {
    margin: 10,
    rowHeight: 10,
    colA: 60,
    colB: 240,
    centerX: 150,
    barWidth: 40,
    boxWidth: 12,
    boxHeight: 8,
    maxY: 190
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

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255);
    doc.setFillColor(0);
    doc.rect(x, y, config.boxWidth, config.boxHeight);
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const display = typeof score === 'number' ? String(score) : 'N/A';
    doc.text(display, x + 1.5, y + 6);
  };

  const drawMatchBar = (x, y, match) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y, config.barWidth, config.boxHeight, 'F');
    if (match !== null && match !== undefined) {
      const color = getMatchColor(match);
      doc.setFillColor(color);
      doc.rect(x, y, config.barWidth * (match / 100), config.boxHeight, 'F');
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text(`${match}%`, x + config.barWidth / 2, y + config.boxHeight / 2, {
        align: 'center',
        baseline: 'middle'
      });
    } else {
      doc.setTextColor(255);
      doc.setFontSize(8);
      doc.text('N/A', x + config.barWidth / 2, y + config.boxHeight / 2, {
        align: 'center',
        baseline: 'middle'
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
    doc.text(category.category || category.name, config.margin, y);
    doc.setFontSize(10);
    doc.text('Partner A', config.colA, y);
    doc.text('Flag', config.centerX + config.barWidth + 2, y);
    doc.text('Partner B', config.colB, y);
    y += 6;

    category.items.forEach(item => {
      if (y > config.maxY) {
        doc.addPage();
        drawBackground();
        y = 20;
      }

      const aScore = typeof item.a === 'number'
        ? item.a
        : typeof item.partnerA === 'number'
          ? item.partnerA
          : 'N/A';
      const bScore = typeof item.b === 'number'
        ? item.b
        : typeof item.partnerB === 'number'
          ? item.partnerB
          : 'N/A';
      const match =
        typeof aScore === 'number' && typeof bScore === 'number'
          ? Math.max(0, 100 - Math.abs(aScore - bScore) * 25)
          : null;
      const flag = match === null ? '' : getFlagEmoji(match);
      const label = item.label || item.kink || '';

      // Debug output to verify values are pulled correctly
      console.log('Rendering:', label, 'A:', aScore, 'B:', bScore);

      doc.setFontSize(9);
      doc.text(shortenLabel(label), config.margin, y + 6);

      drawScoreBox(config.colA, y, aScore);
      drawMatchBar(config.centerX, y, match);
      doc.setFontSize(12);
      if (flag) doc.text(flag, config.centerX + config.barWidth + 2, y + 6);
      drawScoreBox(config.colB, y, bScore);

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
