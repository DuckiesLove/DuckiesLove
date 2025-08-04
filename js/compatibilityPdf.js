export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = 20;

  const colA = margin + 90;
  const colB = pageWidth - margin - 20;
  const centerBarX = pageWidth / 2 - 20;

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0); // black background
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const getFlag = (percent) => {
    if (percent === 100) return '⭐';
    if (percent >= 80) return '🟩';
    if (percent <= 50) return '🚩';
    return '';
  };

  const drawBar = (x, y, percent) => {
    const width = 40;
    const height = 6;
    let color = [255, 0, 0];
    if (percent >= 80) color = [0, 255, 0];
    else if (percent >= 60) color = [255, 255, 0];

    doc.setFillColor(64, 64, 64);
    doc.rect(x, y, width, height, 'F');
    doc.setFillColor(...color);
    doc.rect(x, y, (percent / 100) * width, height, 'F');
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255);
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y - 4, 14, 6, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`${score}%`, x + 1.5, y);
  };

  const shortenLabel = (text) => {
    const map = {
      'Choosing my partner’s outfit for the day or a scene': 'Choosing outfit',
      'Selecting their underwear, lingerie, or base layers': 'Picking underwear',
      'Styling their hair (braiding, brushing, tying, etc.)': 'Styling hair',
      'Picking head coverings (bonnets, veils, hoods, hats) for mood or ritual': 'Head coverings',
      'Offering makeup, polish, or accessories as part of ritual or play': 'Makeup/accessories',
      'Creating themed looks (slutty, innocent, doll-like, sharp, etc.)': 'Themed looks',
      'Dressing them in role-specific costumes (maid, bunny, doll, etc.)': 'Roleplay outfits',
      'Curating time-period or historical outfits (e.g., Victorian, 50s)': 'Historical outfits',
      'Helping them present more femme, masc, or androgynous': 'Femme/masc styling',
      'Coordinating their look with mine for public or private scenes': 'Coordinated outfits',
      'Implementing a “dress ritual” or aesthetic preparation': 'Dress ritual',
      'Enforcing a visual protocol (e.g., no bra, heels required, tied hair)': 'Visual protocol',
      'Having my outfit selected for me by a partner': 'Partner-picked outfit',
      'Wearing the underwear or lingerie they choose': 'Chosen lingerie',
      'Having my hair brushed, braided, tied, or styled for them': 'Hair styled for partner',
      'Putting on a head covering (e.g., bonnet, veil, hood) they request': 'Partner-selected headwear',
    };
    return map[text] || (text.length > 40 ? text.slice(0, 37) + '…' : text);
  };

  const addPage = () => {
    doc.addPage();
    drawBackground();
    y = 20;
  };

  drawBackground();
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 12;
  doc.setFontSize(14);

  data.categories.forEach((category) => {
    if (y > pageHeight - 40) addPage();
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(category.name, margin, y);
    y += 8;

    category.items.forEach((item) => {
      if (y > pageHeight - 20) addPage();

      const label = shortenLabel(item.kink);
      const a = typeof item.partnerA === 'number' ? item.partnerA : 0;
      const b = typeof item.partnerB === 'number' ? item.partnerB : 0;
      const match = 100 - Math.abs(a - b);
      const flag = getFlag(match);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(label, margin, y);

      drawScoreBox(colA, y, a);
      drawBar(centerBarX, y - 4, match);
      doc.text(flag, centerBarX + 45, y);
      drawScoreBox(colB, y, b);

      y += 8;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
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
