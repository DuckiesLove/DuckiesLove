import jsPDF from 'jspdf';

/**
 * Generate a grouped compatibility PDF using a dark theme with teal accents.
 *
 * @param {Object} data - Compatibility data with `items` and `avgMatchPercent`.
 * @param {Object} [options]
 * @param {string} [options.filename='compatibility.pdf'] - Output filename.
 */
export function generateCompatibilityPDFGrouped(data = {}, options = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 40;
  let y = margin;

  const headerFont = 'helvetica';
  const textFont = 'helvetica';

  const primaryColor = '#2de0e0';
  const darkBg = '#11151c';
  const boxBg = '#1e242f';

  const total = items.length;
  const avg = Number.isFinite(data.avgMatchPercent) ? data.avgMatchPercent.toFixed(0) : '0';
  const strong = items.filter((i) => Number.isFinite(i.match) && i.match >= 80).length;

  // Background
  doc.setFillColor(darkBg);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Title
  doc.setFont(headerFont, 'bold');
  doc.setFontSize(24);
  doc.setTextColor(primaryColor);
  doc.text('TalkKink Compatibility', margin, y);

  doc.setFontSize(10);
  doc.setTextColor('#CCCCCC');
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, y + 18);
  y += 35;

  // Summary Stats
  const boxW = 160;
  const boxH = 70;
  const gap = 20;
  const boxes = [
    { title: 'Items Compared', value: total },
    { title: 'Avg Match', value: `${avg}%` },
    { title: '80%+ Alignments', value: strong },
  ];
  boxes.forEach((box, i) => {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(boxBg);
    doc.roundedRect(x, y, boxW, boxH, 8, 8, 'F');

    doc.setFontSize(18);
    doc.setTextColor(primaryColor);
    doc.text(`${box.value}`, x + boxW / 2, y + 28, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor('#CCCCCC');
    doc.text(box.title, x + boxW / 2, y + 50, { align: 'center' });
  });
  y += boxH + 35;

  // Group items
  const grouped = {};
  items.forEach((item) => {
    const category = item.category || 'Uncategorized';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });

  const rowHeight = 24;
  const maxLabelWidth = 170;
  const matchBarWidth = 100;
  const cellPad = 10;
  const matchLabelFontSize = 8;

  Object.entries(grouped).forEach(([category, categoryItems]) => {
    const boxHeight = (categoryItems.length + 1) * rowHeight + 12;
    if (y + boxHeight > pageH - 60) {
      doc.addPage();
      y = margin;
    }

    // Category header box
    doc.setFillColor(boxBg);
    doc.roundedRect(margin - 5, y - 5, pageW - 2 * margin + 10, boxHeight, 8, 8, 'F');

    doc.setFont(textFont, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryColor);
    doc.text(category, margin, y + 14);
    y += 28;

    categoryItems.forEach((item) => {
      const label = item.label || '';
      const partnerAValue = Number.isFinite(item.partnerA) ? String(item.partnerA) : String(item.partnerA || '');
      const partnerBValue = Number.isFinite(item.partnerB) ? String(item.partnerB) : String(item.partnerB || '');
      const matchPct = Number.isFinite(item.match) ? item.match : 0;

      doc.setFont(textFont, 'normal');
      doc.setFontSize(10);
      doc.setTextColor('#FFFFFF');

      // Label
      doc.text(label, margin, y);

      // Partner A
      doc.text(partnerAValue, margin + maxLabelWidth, y, { align: 'right' });

      // Match bar
      const matchX = margin + maxLabelWidth + cellPad;
      const matchColor = matchPct >= 90 ? '#2de0e0' : matchPct >= 60 ? '#ffcc00' : '#ff4444';

      // Background bar
      doc.setFillColor('#333');
      doc.roundedRect(matchX, y - 10, matchBarWidth, 10, 3, 3, 'F');

      // Filled portion
      doc.setFillColor(matchColor);
      doc.roundedRect(matchX, y - 10, matchBarWidth * (matchPct / 100), 10, 3, 3, 'F');

      // Centered percentage
      doc.setFontSize(matchLabelFontSize);
      doc.setTextColor('#CCCCCC');
      doc.text(`${matchPct}%`, matchX + matchBarWidth / 2, y - 1, { align: 'center' });

      // Partner B
      const partnerBX = matchX + matchBarWidth + cellPad;
      doc.setFontSize(10);
      doc.setTextColor('#FFFFFF');
      doc.text(partnerBValue, partnerBX, y);

      y += rowHeight;
    });

    y += 12;
  });

  if (options.save !== false && typeof doc.save === 'function') {
    const filename = options.filename || 'compatibility.pdf';
    doc.save(filename);
  }

  return doc;
}

if (typeof window !== 'undefined') {
  window.generateCompatibilityPDFGrouped = generateCompatibilityPDFGrouped;
}

export default generateCompatibilityPDFGrouped;
