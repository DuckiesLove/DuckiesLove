export function generateCompatibilityPDF() {
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
    doc.text(`${score ?? 0}%`, x + 1.5, y + 6);
  };

  const drawMatchBar = (x, y, match) => {
    const color = match >= 80 ? [0, 255, 0] : match >= 60 ? [255, 255, 0] : [255, 0, 0];
    doc.setFillColor(...color);
    doc.rect(x, y, config.barWidth, config.boxHeight, 'F');
  };

  const getFlag = (match, a, b) => {
    if (match >= 90) return '⭐';
    if (match >= 85) return '🟩';
    if (match <= 40) return '🚩';
    if ((a === 5 && b < 5) || (b === 5 && a < 5)) return '🟨';
    return '';
  };

  const compatibilityData = window.compatibilityData;
  let y = 20;

  drawBackground();
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', 105, y);
  y += 10;

  compatibilityData.categories.forEach(category => {
    if (y > config.maxY) {
      doc.addPage();
      drawBackground();
      y = 20;
    }

    doc.setFontSize(12);
    doc.text(category.name, config.margin, y);
    doc.setFontSize(10);
    doc.text('Partner A', config.colA, y);
    doc.text('Partner B', config.colB, y);
    y += 6;

    category.items.forEach(item => {
      if (y > config.maxY) {
        doc.addPage();
        drawBackground();
        y = 20;
      }

      const a = item.partnerA ?? 0;
      const b = item.partnerB ?? 0;
      const match = 100 - Math.abs(a - b);
      const flag = getFlag(match, a, b);
      const label = item.label || item.kink || '';

      doc.setFontSize(9);
      doc.text(shortenLabel(label), config.margin, y + 6);

      drawScoreBox(config.colA, y, a);
      drawMatchBar(config.centerX, y, match);
      doc.setFontSize(12);
      doc.text(flag, config.centerX + config.barWidth + 2, y + 6);
      drawScoreBox(config.colB, y, b);

      y += config.rowHeight;
    });
  });

  doc.save('compatibility_report.pdf');
}

if (typeof document !== 'undefined') {
  const button = document.getElementById('downloadPDF');
  if (button) button.addEventListener('click', generateCompatibilityPDF);
}

export function generateCompatibilityPDFLandscape(data) {
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
