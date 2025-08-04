import { loadJsPDF } from './loadJsPDF.js';
import { getMatchFlag } from './matchFlag.js';

const kinkShortLabels = {
  "Choosing my partner’s outfit for the day or a scene": "Choosing outfit",
  "Selecting their underwear, lingerie, or base layers": "Picking underwear",
  "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
  "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Head coverings",
  "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
  "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
  "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
  "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
  "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
  "Coordinating their look with mine for public or private scenes": "Coordinated outfits",
  "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
  "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
  "Having my outfit selected for me by a partner": "Partner-picked outfit",
  "Wearing the underwear or lingerie they choose": "Chosen lingerie",
  "Having my hair brushed, braided, tied, or styled for them": "Hair styled for partner",
  "Putting on a head covering (e.g., bonnet, veil, hood) they request": "Requested covering",
  "Following visual appearance rules as part of submission": "Visual rules",
  "Wearing makeup, polish, or accessories they request": "Requested makeup",
  "Dressing to please their vision (cute, filthy, classy, etc.)": "Dressing to please",
  "Wearing roleplay costumes or character looks": "Roleplay costumes",
  "Presenting in a way that matches their chosen aesthetic": "Aesthetic match",
  "Participating in dressing rituals or undressing ceremonies": "Dressing ritual",
  "Being admired for the way I look under their direction": "Admired look",
  "Receiving praise or gentle teasing about my appearance": "Appearance praise",
  "Cosplay or fantasy looks (anime, game, fairytale, etc.)": "Cosplay/fantasy",
  "Time-period dress-up (regency, gothic, 1920s, etc.)": "Period dress-up",
  "Dollification or polished/presented object aesthetics": "Dollification",
  "Uniforms (schoolgirl, military, clerical, nurse, etc.)": "Uniforms",
  "Hair-based play (forced brushing, ribbons, or tied styles)": "Hair play"
};

export async function generateCompatibilityPDF(data) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const barWidth = 40;
  const labelX = margin + 2;
  const partnerAX = pageWidth / 2 - 10;
  const partnerBX = pageWidth - margin - barWidth;
  const rowHeight = 8;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    const matchFlag = getMatchFlag(category.matchPercent);
    const shortName = shortenCategoryName(category.name);
    const header = `${shortName} ${matchFlag}`;

    doc.setFillColor(0);
    doc.setTextColor(255, 0, 0);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.text(header, labelX, y + 6);
    y += 10;

    doc.setTextColor(255);
    doc.text('Kink', labelX, y);
    doc.text('Partner A', partnerAX, y);
    doc.text('Partner B', partnerBX, y);
    y += 6;

    category.items.forEach(kink => {
      if (y > pageHeight - 27) {
        doc.addPage();
        doc.setFillColor(20, 20, 20);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }

      doc.setTextColor(255);
      const label = getKinkLabel(kink.kink);
      doc.text(label, labelX, y);

      const percentA = toPercent(kink.partnerA);
      const percentB = toPercent(kink.partnerB);

      drawBar(doc, partnerAX, y - 3, percentA);
      drawBar(doc, partnerBX, y - 3, percentB);

      doc.setTextColor(200);
      doc.setFontSize(8);
      doc.text(`${percentA}%`, partnerAX + barWidth + 2, y);
      doc.text(`${percentB}%`, partnerBX + barWidth + 2, y);
      doc.setFontSize(10);

      y += rowHeight;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}

function getKinkLabel(name) {
  const mapped = kinkShortLabels[name];
  const label = mapped || name;
  return label.length > 50 ? label.slice(0, 47) + '…' : label;
}

function drawBar(doc, x, y, percent) {
  const barWidth = 40;
  const barHeight = 4;
  const color = getBarColor(percent);

  doc.setFillColor(50);
  doc.rect(x, y, barWidth, barHeight, 'F');

  doc.setFillColor(...color);
  const fillWidth = (percent / 100) * barWidth;
  doc.rect(x, y, fillWidth, barHeight, 'F');
}

function getBarColor(percent) {
  if (percent >= 80) return [0, 200, 0];
  if (percent <= 50) return [220, 50, 50];
  return [100, 100, 100];
}

function shortenCategoryName(name) {
  return name.length > 25 ? name.slice(0, 22) + '…' : name;
}

function toPercent(val) {
  if (typeof val !== 'number') return 0;
  return val <= 5 ? Math.round((val / 5) * 100) : Math.round(val);
}

// Generate a PDF listing all kinks with their combined score in landscape mode
// Combined score is the average of Partner A and Partner B ratings when both
// are present; otherwise the existing rating is shown or '-' if none exist.
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

// Helper: Title
function drawTitle(doc, pageWidth) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
}

// Helper: Combined score calculation
function combinedScore(a, b) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  if (aNum === null && bNum === null) return '-';
  if (aNum === null) return String(bNum);
  if (bNum === null) return String(aNum);
  const avg = (aNum + bNum) / 2;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

