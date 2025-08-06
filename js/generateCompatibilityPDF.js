import { renderCategorySection } from './compatibilityReportHelpers.js';

// Shortened label lookup for verbose subcategory names
const shortLabels = {
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

// Subcategory label shortening (1–4 words)
function shortenLabel(text = '') {
  if (shortLabels[text]) return shortLabels[text];
  return text.split(/\s+/).slice(0, 4).join(' ');
}

// PDF layout settings
const pdfStyles = {
  backgroundColor: 'black',
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
  }
};

// Icon used in history rows based on score percentage
function getHistoryIcon(score) {
  if (typeof score !== 'number') return '⚪';
  if (score >= 80) return '🟢';
  if (score >= 51) return '🟡';
  return '🔴';
}

export function generateCompatibilityPDF(compatibilityData) {
  const categories = Array.isArray(compatibilityData)
    ? compatibilityData
    : compatibilityData?.categories || [];
  const history = Array.isArray(compatibilityData) ? [] : compatibilityData?.history || [];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

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

  let y = 80;

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

    y = renderCategorySection(
      doc,
      margin,
      y,
      category.category || category.name,
      items,
      usableWidth
    );
    y += pdfStyles.barSpacing;
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      drawBackground();
      y = margin;
    }
  });

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
