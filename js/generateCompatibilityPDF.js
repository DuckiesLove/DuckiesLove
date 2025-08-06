import { getMatchFlag } from './matchFlag.js';

// Thresholds for bar colors
function getBarColor(matchPercentage) {
  if (matchPercentage === null) return 'black';
  if (matchPercentage <= 50) return 'red';
  if (matchPercentage <= 79) return 'yellow';
  return 'green';
}

// Subcategory label shortening (2–4 words max)
function shortenLabel(text = '') {
  return text
    .replace(/Choosing my partner.+?scene/, 'Choose outfit')
    .replace(/Selecting.+?layers/, 'Underwear')
    .replace(/Styling.+?etc\./, 'Style hair')
    .replace(/Picking head coverings.+?protection/, 'Headwear')
    .replace(/Offering makeup.+?play/, 'Makeup/accessories')
    .replace(/Creating themed looks.+?etc\./, 'Themed looks')
    .replace(/Dressing them.+?etc\./, 'Roleplay outfits')
    .replace(/Curating time-period.+?50s\)/, 'Historical outfits')
    .replace(/Helping them present.+?request/, 'Femme/masc styling')
    .replace(/Coordinating.+?scenes/, 'Coordinated looks')
    .replace(/Implementing.+?preparation/, 'Dress ritual')
    .replace(/Enforcing.+?tied hair\)/, 'Visual protocol')
    .replace(/Having my outfit.+?partner/, 'They pick my outfit')
    .replace(/Wearing the underwear.+?choose/, 'They pick my lingerie')
    .replace(/Having my hair.+?them/, 'Hair for them')
    .replace(/Putting on.+?they chose/, 'Headwear (by request)')
    .replace(/Following visual.+?submission/, 'Visual protocol (rules)')
    .replace(/Wearing makeup.+?request/, 'Requested makeup')
    .replace(/Dressing to please.+?etc\./, 'Dress to please')
    .replace(/Wearing roleplay.+?looks/, 'Roleplay costumes')
    .replace(/Presenting.+?aesthetic/, 'Match their aesthetic')
    .replace(/Participating in.+?ceremonies/, 'Dressing rituals')
    .replace(/Being admired.+?direction/, 'Admired by them')
    .replace(/Receiving praise.+?appearance/, 'Appearance praise')
    .replace(/Cosplay.+?etc\./, 'Cosplay looks')
    .replace(/Time-period dress-up.+?etc\./, 'Historic dress-up')
    .replace(/Dollification.+?aesthetics/, 'Dollification')
    .replace(/Uniforms.+?etc\./, 'Uniforms')
    .replace(/Hair-based play.+?styles\)/, 'Hair-based play')
    .replace(/Head coverings.+?dynamics/, 'Ritual headwear')
    .replace(/Matching dress.+?codes/, 'Matching dress codes');
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
  const barColor = pdfStyles.barColors[getBarColor(matchPercentage)];
  const filledWidth = matchPercentage === null ? 0 : (matchPercentage / 100) * width;

  // Bar background
  doc.setFillColor(pdfStyles.barColors.black);
  doc.rect(x, y, width, pdfStyles.barHeight, 'F');

  if (filledWidth > 0) {
    doc.setFillColor(barColor);
    doc.rect(x, y, filledWidth, pdfStyles.barHeight, 'F');
  }

  doc.setFont(pdfStyles.bodyFont, 'normal');
  doc.setFontSize(10);
  if (matchPercentage === null) {
    doc.setTextColor('#888888');
    doc.text('N/A', x + width + 5, y + pdfStyles.barHeight - 3);
  } else {
    doc.setTextColor(pdfStyles.textColor);
    doc.text(`${matchPercentage}%`, x + width + 5, y + pdfStyles.barHeight - 3);
  }
  doc.setTextColor(pdfStyles.textColor);
}

export function generateCompatibilityPDF(compatibilityData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

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

    category.items.forEach((item, index) => {
      const label = shortenLabel(item.label || item.name || `Item ${index + 1}`);
      const a = typeof item.partnerA === 'number' ? item.partnerA :
        typeof item.scoreA === 'number' ? item.scoreA : null;
      const b = typeof item.partnerB === 'number' ? item.partnerB :
        typeof item.scoreB === 'number' ? item.scoreB : null;
      const match = a === null || b === null ? null : Math.max(0, 100 - Math.abs(a - b) * 20);

      doc.setFont(pdfStyles.bodyFont, 'normal');
      doc.setFontSize(10);
      doc.text(label, margin, y + boxSize - 2);
      drawScoreBox(boxAX, y, a);
      drawBar(doc, barX, y, match);
      const flag = getMatchFlag(match, a, b);
      if (flag) {
        doc.text(flag, flagX, y + boxSize - 2);
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

  doc.save('TalkKink-Compatibility.pdf');
  return doc;
}

export default generateCompatibilityPDF;
