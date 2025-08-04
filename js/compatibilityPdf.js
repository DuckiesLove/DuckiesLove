export function generateCompatibilityPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Layout
  const margin = 10;
  const barHeight = 6;
  const barWidth = 40;
  const colA = margin + 50;
  const colB = pageWidth - margin - 30;
  const centerBarX = pageWidth / 2 - 20;

  const shortenLabel = (text) => {
    const map = {
      'Choosing my partner’s outfit for the day or a scene': 'Choosing outfit',
      'Selecting their underwear, lingerie, or base layers': 'Picking underwear',
      'Styling their hair (braiding, brushing, tying, etc.)': 'Styling hair',
      'Picking head coverings (bonnets, veils, hoods, hats) for mood/ritual': 'Head coverings',
      'Offering makeup, polish, or accessories as part of ritual or play': 'Makeup/accessories',
      'Creating themed looks (slutty, innocent, doll-like, etc.)': 'Themed looks',
      'Dressing them in role-specific costumes (maid, schoolgirl, etc.)': 'Roleplay outfits',
      'Curating time-period or historical outfits (e.g., Victorian, 50s)': 'Historical outfits',
      'Helping them present more femme, masc, or androgynous': 'Femme/masc styling',
      'Coordinating their look with mine for public or private play': 'Coordinated outfits',
      'Implementing a “dress ritual” or aesthetic preparation ritual': 'Dress ritual',
      'Enforcing a visual protocol (e.g., no bra, heels required)': 'Visual protocol',
      'Having my outfit selected for me by a partner': 'Partner-picked outfit',
      'Wearing the underwear or lingerie they choose': 'Chosen lingerie',
      'Having my hair brushed, braided, tied, or styled': 'Hair styled for partner',
      'Partner-selected headwear': 'Partner-selected headwear',
    };
    return map[text] || (text.length > 35 ? text.slice(0, 32) + '…' : text);
  };

  const getFlag = (percent) => {
    if (percent === 100) return '⭐';
    if (percent >= 80) return '🟩';
    if (percent <= 50) return '🚩';
    return '';
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255);
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y - 5, 14, barHeight, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(typeof score === 'number' ? `${score}%` : '–', x + 2.5, y);
  };

  const drawBar = (x, y, percent) => {
    doc.setFillColor(64, 64, 64);
    doc.rect(x, y - 4, barWidth, barHeight, 'F');
    if (percent >= 80) doc.setFillColor(0, 255, 0);
    else if (percent >= 60) doc.setFillColor(255, 255, 0);
    else doc.setFillColor(255, 0, 0);
    doc.rect(x, y - 4, (percent / 100) * barWidth, barHeight, 'F');
  };

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  // Begin rendering
  let y = 20;
  drawBackground();
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 12;

  const data = window.compatibilityData;
  if (!data || !Array.isArray(data.categories)) {
    alert('Missing or invalid compatibility data.');
    return;
  }

  data.categories.forEach(category => {
    if (y > pageHeight - 20) {
      doc.addPage();
      drawBackground();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text(category.name, margin, y);
    y += 8;

    category.items?.forEach(item => {
      if (y > pageHeight - 20) {
        doc.addPage();
        drawBackground();
        y = 20;
      }

      const label = shortenLabel(item.kink);
      const a = typeof item.partnerA === 'number' ? item.partnerA : null;
      const b = typeof item.partnerB === 'number' ? item.partnerB : null;
      const match = a !== null && b !== null ? 100 - Math.abs(a - b) : 0;
      const flag = getFlag(match);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(label, margin, y);

      drawScoreBox(colA, y, a);
      drawBar(centerBarX, y, match);
      doc.text(flag, centerBarX + barWidth + 4, y);
      drawScoreBox(colB, y, b);

      y += 8;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
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
