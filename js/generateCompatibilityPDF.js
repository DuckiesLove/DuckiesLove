export function generateCompatibilityPDF(compatibilityData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const boxSize = 16;
  const barWidth = 100;
  const gap = 10;
  const barX = pageWidth / 2 - barWidth / 2;
  const boxAX = barX - gap - boxSize;
  const boxBX = barX + barWidth + gap;
  const lineHeight = 24;

  // Map for explicit shortened labels and generic shortening fallback
  const shortenLabel = (label = '') => {
    const map = {
      "Choosing my partner’s outfit for the day or a scene": "Partner’s outfit choice",
      "Selecting their underwear, lingerie, or base layers": "Select their underwear",
      "Styling their hair (braiding, brushing, tying, etc.)": "Style their hair",
      "Picking head coverings (bonnets, veils, hoods, hats)": "Choose head covering",
      "Offering makeup, polish, or accessories as part of ritual or play": "Apply ritual makeup",
      "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Create themed looks",
      "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Dress in roleplay",
      "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Time-period outfits",
      "Helping them present more femme, masc, or androgynous by request": "Support gender styling",
      "Coordinating their look with mine for public or private scenes": "Coordinate our looks",
      "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual prep",
      "Enforcing a visual protocol (e.g., no bra, heels required)": "Visual protocol rules",
      "Having my outfit selected for me by a partner": "Partner picks outfit",
      "Wearing the underwear or lingerie they choose": "Partner picks lingerie",
      "Having my hair brushed, braided, tied, or styled for them": "Style hair for them",
      "Putting on a head covering they chose": "Partner’s headwear choice",
      "Following visual appearance rules as part of submission": "Follow appearance rules",
      "Wearing makeup, polish, or accessories they request": "Partner's makeup request",
      "Dressing to please their vision (cute, filthy, classy, etc.)": "Dress to please them",
      "Wearing roleplay costumes or character looks": "Wear roleplay costume",
      "Presenting in a way that matches their chosen aesthetic": "Match their aesthetic",
      "Participating in dressing rituals or undressing ceremonies": "Participate in rituals",
      "Being admired for the way I look under their direction": "Admired by partner",
      "Receiving praise or teasing about my appearance": "Appearance praise/teasing",
      "Cosplay or fantasy looks (anime, game, fairytale, etc.)": "Fantasy or cosplay",
      "Time-period dress-up (regency, gothic, 1920s, etc.)": "Dress in era style",
      "Dollification or polished/presented object aesthetics": "Dollification play style",
      "Uniforms (schoolgirl, military, clerical, nurse, etc.)": "Wear uniform looks",
      "Hair-based play (forced brushing, ribbons, or tied styles)": "Hair-focused play",
      "Head coverings or symbolic hoods in ritualized dynamics": "Symbolic headwear",
      "Matching outfits or dress codes": "Matching dress codes"
    };

    return map[label] || label.split(' ').slice(0, 4).join(' ');
  };

  const drawBackground = () => {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255, 255, 255);
    doc.rect(x, y, boxSize, boxSize);
    doc.setFontSize(12);
    doc.text(String(score ?? ''), x + boxSize / 2, y + boxSize - 4, { align: 'center' });
  };

  const drawMatchIndicator = (match, x, y) => {
    if (match === 100) {
      doc.setFontSize(14);
      doc.text('⭐', x + barWidth / 2, y + boxSize - 4, { align: 'center' });
    } else if (match <= 50) {
      doc.setFontSize(14);
      doc.text('🚩', x + barWidth / 2, y + boxSize - 4, { align: 'center' });
    } else {
      const color = match >= 80 ? [0, 255, 0] : [160, 160, 160];
      doc.setFillColor(...color);
      doc.rect(x, y, (barWidth * match) / 100, boxSize, 'F');
    }
  };

  drawBackground();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, 40, { align: 'center' });

  let y = 80;

  compatibilityData.categories.forEach(category => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(category.category || category.name, margin, y);
    y += lineHeight;

    category.items.forEach((item, index) => {
      const label = shortenLabel(item.label || item.name || `Item ${index + 1}`);
      const a = typeof item.partnerA === 'number' ? item.partnerA :
        typeof item.scoreA === 'number' ? item.scoreA : 0;
      const b = typeof item.partnerB === 'number' ? item.partnerB :
        typeof item.scoreB === 'number' ? item.scoreB : 0;
      const match = typeof item.match === 'number' ? item.match :
        Math.max(0, 100 - Math.abs(a - b) * 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(label, margin, y + boxSize - 4);
      drawScoreBox(boxAX, y, a);
      drawMatchIndicator(match, barX, y);
      drawScoreBox(boxBX, y, b);

      y += lineHeight;
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        drawBackground();
        y = margin;
      }
    });

    y += lineHeight / 2;
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

