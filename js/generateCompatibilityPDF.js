import { getMatchFlag } from './matchFlag.js';

// Shortened label lookup for verbose subcategory names
const shortenedLabels = {
  "Choosing my partner's outfit for the day or a scene": 'Choosing outfit',
  "Selecting their underwear, lingerie or base layers": 'Picking underwear',
  "Styling their hair (braiding, brushing, tying, etc.)": 'Styling hair',
  "Picking head coverings (veils, hoods, hats)": 'Headwear',
  "Offering makeup, polish, or accessories": 'Makeup/accessories',
  "Creating themed looks (slutty, innocent, etc)": 'Themed looks',
  "Dressing them in role-specific costumes": 'Roleplay outfits',
  "Curating time-period or historical outfits": 'Historical outfits',
  "Helping them present more femme/masc": 'Femme/masc styling',
  "Coordinating their look with mine": 'Matching outfits',
  "Implementing a 'dress ritual' or aesthetic preparation": 'Dress ritual',
  "Enforcing a visual protocol (e.g. no bra, pigtails)": 'Visual protocol',
  "Having my outfit selected for me by partner": 'Partner-picked outfit',
  "Wearing chosen lingerie/underwear": 'Chosen lingerie',
  "Having my hair brushed, braided, styled": 'Hair styled by partner'
};

// Thresholds for bar colors
function getBarColor(matchPercentage) {
  if (matchPercentage === null) return 'black';
  if (matchPercentage <= 50) return 'red';
  if (matchPercentage <= 79) return 'yellow';
  return 'green';
}

// Subcategory label shortening (1–4 words)
function shortenLabel(text = '') {
  if (shortenedLabels[text]) return shortenedLabels[text];
  return text.split(/\s+/).slice(0, 4).join(' ');
}

// PDF layout settings
const pdfStyles = {
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  headingFont: 'helvetica',
  bodyFont: 'helvetica',
  barHeight: 10,
  barSpacing: 6,
  barColors: {
    green: '#00FF00',
    yellow: '#FFFF00',
    red: '#FF0000',
    black: '#111111'
  }
};

function drawBar(doc, x, y, matchPercentage) {
  const width = 50;

  // Bar background
  doc.setFillColor(pdfStyles.barColors.black);
  doc.rect(x, y, width, pdfStyles.barHeight, 'F');

  if (matchPercentage !== null) {
    const barColor = pdfStyles.barColors[getBarColor(matchPercentage)];
    const filledWidth = (matchPercentage / 100) * width;
    if (filledWidth > 0) {
      doc.setFillColor(barColor);
      doc.rect(x, y, filledWidth, pdfStyles.barHeight, 'F');
    }
    doc.setFont(pdfStyles.bodyFont, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(pdfStyles.textColor);
    doc.text(`${matchPercentage}%`, x - 5, y + pdfStyles.barHeight - 3, { align: 'right' });
  } else {
    doc.setFont(pdfStyles.bodyFont, 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#CCCCCC');
    doc.text('N/A', x + width / 2, y + pdfStyles.barHeight - 3, { align: 'center' });
  }
  doc.setTextColor(pdfStyles.textColor);
}

export function generateCompatibilityPDF(compatibilityData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const boxSize = pdfStyles.barHeight;
  const barWidth = 50;
  const gap = 10;
  const flagSpace = 10;
  const lineHeight = boxSize + pdfStyles.barSpacing;

  const barX = pageWidth / 2 - barWidth / 2;
  const boxAX = barX - gap - boxSize;
  const flagX = barX + barWidth + gap;
  const boxBX = barX + barWidth + gap * 2 + flagSpace;

  const drawBackground = () => {
    doc.setFillColor(pdfStyles.backgroundColor);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(pdfStyles.textColor);
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(pdfStyles.textColor);
    doc.rect(x, y, boxSize, boxSize);
    doc.setFont(pdfStyles.bodyFont, 'normal');
    doc.setFontSize(8);
    if (score !== null && score !== undefined) {
      doc.text(String(score), x + boxSize / 2, y + boxSize - 2, { align: 'center' });
    }
  };

  drawBackground();
  doc.setFont(pdfStyles.headingFont, 'bold');
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, 40, { align: 'center' });

  let y = 80;

  compatibilityData.categories.forEach(category => {
    doc.setFont(pdfStyles.headingFont, 'bold');
    doc.setFontSize(14);
    doc.text(category.category || category.name, margin, y);
    y += lineHeight;

    category.items.forEach((item) => {
      const fullLabel = item.label || item.kink || item.name || '';
      const label = shortenLabel(fullLabel);
      const a = typeof item.partnerA === 'number' ? item.partnerA :
        typeof item.scoreA === 'number' ? item.scoreA : null;
      const b = typeof item.partnerB === 'number' ? item.partnerB :
        typeof item.scoreB === 'number' ? item.scoreB : null;
      const match = a === null || b === null
        ? null
        : Math.max(0, 100 - Math.abs(a - b) * 20);

      doc.setFont(pdfStyles.bodyFont, 'normal');
      doc.setFontSize(10);
      doc.text(label, margin, y + boxSize - 2, { maxWidth: barX - margin - gap });
      drawScoreBox(boxAX, y, a);
      drawBar(doc, barX, y, match);
      if (match !== null) {
        const flag = getMatchFlag(match);
        if (flag) {
          doc.text(flag, flagX, y + boxSize - 2);
        }
      }
      drawScoreBox(boxBX, y, b);

      y += lineHeight;
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        drawBackground();
        y = margin;
      }
    });

    y += pdfStyles.barSpacing;
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      drawBackground();
      y = margin;
    }
  });

  doc.save('kink-compatibility.pdf');
  return doc;
}

export default generateCompatibilityPDF;
