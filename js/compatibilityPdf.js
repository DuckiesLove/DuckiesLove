export function generateCompatibilityPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  const config = {
    margin: 10,
    rowHeight: 10,
    colA: 60,
    colB: 250,
    barWidth: 50,
    centerBarX: 140,
    partnerBoxWidth: 14,
    partnerBoxHeight: 8,
    flagOffset: 5,
    maxY: 190,
    fontSize: 10,
    labelWidth: 70
  };

  const shortenLabel = (label) => {
    const map = {
      "Choosing my partner's outfit for the day": "Choosing outfit",
      "Selecting their underwear, lingerie": "Picking underwear",
      "Styling their hair (braiding, brushing)": "Styling hair",
      "Picking head coverings (bonnets, veils, etc)": "Head coverings",
      "Offering makeup, polish, or accessories": "Makeup/accessories",
      "Creating themed looks (slutty, innocent)": "Themed looks",
      "Dressing them in role-specific costumes": "Roleplay outfits",
      "Curating time-period or historical outfits": "Historical outfits",
      "Helping them present more femme/masc": "Femme/masc styling",
      "Coordinating their look with mine for outings": "Coordinated outfits",
      "Implementing a 'dress ritual' or aesthetic": "Dress ritual",
      "Enforcing a visual protocol (e.g., no pants)": "Visual protocol",
      "Having my outfit selected for me by partner": "Partner-picked outfit",
      "Wearing the underwear or lingerie they pick": "Chosen lingerie",
      "Having my hair brushed, braided, or styled": "Hair styled for partner",
      "Partner-selected headwear (bonnet, etc)": "Partner-selected headwear"
    };
    return map[label] || label.slice(0, config.labelWidth);
  };

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 297, 210, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255);
    doc.setFillColor(0);
    doc.rect(x, y, config.partnerBoxWidth, config.partnerBoxHeight);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`${score ?? 0}%`, x + 1.5, y + 6);
  };

  const drawMatchBar = (x, y, match) => {
    const barColor =
      match >= 80 ? [0, 255, 0] : match >= 60 ? [255, 255, 0] : [255, 0, 0];
    doc.setFillColor(...barColor);
    doc.rect(x, y, config.barWidth, config.partnerBoxHeight, 'F');
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
  doc.setTextColor(255, 255, 255);
  doc.text('Kink Compatibility Report', 105, y);
  y += 10;

  compatibilityData.categories.forEach((category) => {
    if (y > config.maxY) {
      doc.addPage();
      drawBackground();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(category.name, config.margin, y);
    doc.text('Partner A', config.colA, y);
    doc.text('Partner B', config.colB + config.barWidth + 25, y);
    y += 6;

    category.items.forEach((item) => {
      if (y > config.maxY) {
        doc.addPage();
        drawBackground();
        y = 20;
      }

      const a = item.partnerA ?? 0;
      const b = item.partnerB ?? 0;
      const match = 100 - Math.abs(a - b);
      const flag = getFlag(match, a, b);

      doc.setFontSize(config.fontSize);
      doc.setTextColor(255, 255, 255);
      doc.text(shortenLabel(item.label || item.kink), config.margin, y + 6);

      drawScoreBox(config.colA, y, a);
      drawMatchBar(config.centerBarX, y, match);

      doc.setFontSize(12);
      doc.text(flag, config.centerBarX + config.barWidth + config.flagOffset, y + 6);

      drawScoreBox(config.colB + config.barWidth + 20, y, b);

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
