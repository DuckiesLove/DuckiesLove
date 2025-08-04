export function generateCompatibilityPDF() {
  if (!window.jspdf?.jsPDF) {
    console.error('jsPDF is not loaded');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colA = margin + 20;
  const centerBarX = pageWidth / 2 - 40;
  const colB = pageWidth - margin - 60;
  let y = margin;

  const theme = {
    background: '#000000',
    textColor: '#FFFFFF',
    bar: '#AAAAAA',
    green: '#00FF00',
    yellow: '#FFFF00',
    red: '#FF0000',
    font: 'helvetica',
  };

  const shortenLabel = (label) => {
    const map = {
      'Choosing my partner’s outfit for the day or a scene': 'Choosing outfit',
      'Selecting their underwear, lingerie, or base layer': 'Picking underwear',
      'Styling their hair (braiding, brushing, tying, etc.)': 'Styling hair',
      'Picking head coverings (bonnets, veils, hoods, hats)': 'Head coverings',
      'Offering makeup, polish, or accessories as part of ritual or play': 'Makeup/accessories',
      'Creating themed looks (slutty, innocent, doll-like, etc.)': 'Themed looks',
      'Dressing them in role-specific costumes (maid, pet, etc.)': 'Roleplay outfits',
      'Curating time-period or historical outfits (e.g., Victorian, 50s)': 'Historical outfits',
      'Helping them present more femme, masc, or androgynous': 'Femme/masc styling',
      'Coordinating their look with mine for public or partner appearances': 'Coordinated outfits',
      'Implementing a “dress ritual” or aesthetic preparation rule': 'Dress ritual',
      'Enforcing a visual protocol (e.g., no bra, heels only)': 'Visual protocol',
      'Having my outfit selected for me by a partner': 'Partner-picked outfit',
      'Wearing the underwear or lingerie they choose': 'Chosen lingerie',
      'Having my hair brushed, braided, tied, or styled': 'Hair styled for partner',
      'Putting on a head covering selected by partner': 'Partner-selected headwear',
    };
    return map[label] || label.split(' ').slice(0, 3).join(' ') + '...';
  };

  const drawScoreBox = (x, y, value) => {
    doc.setFillColor(theme.background);
    doc.rect(x, y, 26, 18);
    doc.setTextColor(theme.textColor);
    doc.setFontSize(9);
    doc.text(`${value}%`, x + 4, y + 13);
  };

  const drawBar = (x, y, value) => {
    const width = 80;
    const height = 16;
    const color =
      value >= 100 ? theme.textColor :
      value >= 80 ? theme.green :
      value <= 50 ? theme.red :
      theme.bar;

    doc.setFillColor('#444444');
    doc.rect(x, y, width, height, 'F');

    doc.setFillColor(color);
    doc.rect(x, y, (width * value) / 100, height, 'F');
  };

  const getFlag = (match) => {
    if (match === 100) return '⭐';
    if (match >= 80) return '🟩';
    if (match <= 50) return '🚩';
    return '';
  };

  const addPage = () => {
    doc.addPage();
    y = margin;
    doc.setFillColor(theme.background);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  doc.setFillColor(theme.background);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(theme.textColor);
  doc.setFont(theme.font, 'bold');
  doc.setFontSize(20);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 40;

  const data = window.compatibilityData;
  if (!data || !Array.isArray(data.categories)) {
    console.error('window.compatibilityData must be an object with a categories array');
    return;
  }

  for (const cat of data.categories) {
    if (y > pageHeight - 120) addPage();
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    const catName = cat.category || cat.name;
    doc.text(catName, colA, y);
    y += 18;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text('Partner A', colA, y);
    doc.text('Partner B', colB, y);
    y += 10;

    for (const kink of cat.items) {
      if (y > pageHeight - 60) addPage();

      const label = shortenLabel(kink.kink);
      const a = kink.partnerA ?? 0;
      const b = kink.partnerB ?? 0;
      const match = 100 - Math.abs(a - b);
      const flag = getFlag(match);

      doc.setTextColor(theme.textColor);
      doc.text(label, colA, y + 15);

      drawScoreBox(colA, y, a);
      drawBar(centerBarX, y, match);
      doc.setFontSize(12);
      doc.text(flag, centerBarX + 90, y + 14);
      drawScoreBox(colB, y, b);

      y += 26;
    }
    y += 10;
  }

  doc.save('compatibility_report.pdf');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.jspdf?.jsPDF) {
      console.error('jsPDF library failed to load.');
      return;
    }
    const button = document.getElementById('downloadPDF');
    if (button) button.addEventListener('click', generateCompatibilityPDF);
  });
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

