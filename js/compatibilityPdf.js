import { loadJsPDF } from './loadJsPDF.js';

const shortenedLabels = {
  "Choosing my partner’s outfit for the day or a scene": "Choosing outfit",
  "Selecting their underwear, lingerie, or base layers": "Picking underwear",
  "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
  "Picking head coverings (bonnets, veils, hoods, hats)": "Head coverings",
  "Offering makeup, polish, or accessories as part of ritual or protocol": "Makeup/accessories",
  "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
  "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
  "Curating time-period or historical outfits (e.g., Victorian, 50s, etc.)": "Historical outfits",
  "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
  "Coordinating their look with mine for public or private scenes": "Coordinated outfits",
  "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
  "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
  "Having my outfit selected for me by a partner": "Partner-picked outfit",
  "Wearing the underwear or lingerie they choose": "Chosen lingerie",
  "Having my hair brushed, braided, tied, or styled for them": "Hair styled for partner",
  "Putting on a head covering (e.g., bonnet, veil, hood) they chose": "Partner-selected headwear",
  "Following visual appearance rules as part of submission": "Visual submission rule",
  "Wearing makeup, polish, or accessories they request": "Requested appearance",
  "Dressing to please their vision (cute, filthy, classy, etc.)": "Dressing for vision",
  "Wearing roleplay costumes or character looks": "Costumes",
  "Presenting in a way that matches their chosen aesthetic": "Aesthetic presentation",
  "Participating in dressing rituals or undressing ceremonies": "Dressing rituals",
  "Being admired for the way I look under their direction": "Being admired",
  "Receiving praise or gentle teasing about my appearance": "Appearance praise",
  "Cosplay or fantasy looks (anime, game, fairytale, etc.)": "Cosplay/fantasy",
  "Time-period dress-up (regency, gothic, 1920s, etc.)": "Vintage looks",
  "Dollification or polished/presented object aesthetics": "Dollification",
  "Uniforms (schoolgirl, military, clerical, nurse, etc.)": "Uniforms",
  "Hair-based play (forced brushing, ribbons, or tied styles)": "Hair-based play"
};

const formatLabel = (text) => shortenedLabels[text] || text;

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 20;

  const drawBar = (x, y, percent, color) => {
    const width = 30;
    const height = 4;
    doc.setFillColor(60, 60, 60);
    doc.rect(x, y, width, height, 'F');
    if (percent > 0) {
      const barColor = color === 'green' ? [0, 200, 0] : [200, 0, 0];
      doc.setFillColor(...barColor);
      doc.rect(x, y, (percent / 100) * width, height, 'F');
    }
  };

  const getBarColor = (percent) => {
    if (percent >= 60) return 'green';
    if (percent > 0) return 'red';
    return 'gray';
  };

  const getMatchFlag = (a, b) => {
    const avg = (a + b) / 2;
    const diff = Math.abs(a - b);
    if (a === 100 && b === 100) return '⭐';
    if (avg >= 80 && diff <= 10) return '🟩';
    if (avg <= 50) return '🚩';
    return '';
  };

  const fillBlackBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
  };

  // Begin PDF rendering
  fillBlackBackground();
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    if (y > 260) {
      doc.addPage();
      fillBlackBackground();
      y = 20;
    }

    // Render category title in red
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text(category.name, margin, y);
    y += 8;

    // Render header row
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Partner A', 110, y);
    doc.text('Partner B', 160, y);
    y += 6;

    // Render items
    doc.setFont('helvetica', 'normal');
    category.items.forEach(kink => {
      if (y > 265) {
        doc.addPage();
        fillBlackBackground();
        y = 20;
      }

      const label = formatLabel(kink.kink);
      const percentA = kink.partnerA ?? 0;
      const percentB = kink.partnerB ?? 0;
      const flag = getMatchFlag(percentA, percentB);

      doc.setTextColor(255, 255, 255);
      doc.text(label, margin, y);

      drawBar(105, y - 3, percentA, getBarColor(percentA));
      doc.text(`${percentA}%`, 138, y);
      doc.text(flag, 145, y);
      drawBar(150, y - 3, percentB, getBarColor(percentB));
      doc.text(`${percentB}%`, 183, y);

      y += 8;
    });

    y += 5;
  });

  doc.save('compatibility_report.pdf');
}

export async function generateCompatibilityPDFLandscape(data) {
  const jsPDF = await loadJsPDF();
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

