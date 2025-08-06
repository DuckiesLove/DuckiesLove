// ---- Compatibility Report Rendering Helpers ----

// Determine the color of the match bar
function getMatchColor(percentage) {
  if (percentage === null || percentage === undefined) return 'black';
  if (percentage >= 80) return 'green';
  if (percentage >= 60) return 'yellow';
  if (percentage > 0) return 'red';
  return 'black';
}

// Determine which flag emoji to show
function getFlagEmoji(percentage) {
  if (percentage === null || percentage === undefined) return '';
  if (percentage >= 90) return '⭐';
  if (percentage <= 50) return '🚩';
  return '';
}

// Draw the colored match bar with percentage label (or N/A)
export function drawMatchBar(doc, x, y, width, height, percentage) {
  const label = percentage !== null && percentage !== undefined ? `${percentage}%` : 'N/A';
  const color = getMatchColor(percentage);

  // Black background
  doc.setFillColor('black');
  doc.rect(x, y, width, height, 'F');

  // Colored fill if a percentage exists
  if (percentage !== null && percentage !== undefined) {
    const filled = Math.round((percentage / 100) * width);
    doc.setFillColor(color);
    doc.rect(x, y, filled, height, 'F');
  }

  // Label centered inside the bar
  doc.setFontSize(7);
  doc.setTextColor('white');
  doc.text(label, x + width / 2, y + height / 2 + 1.8, { align: 'center' });
}

// Render the category header centered on the page
function renderCategoryHeader(doc, y, category) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(13);
  doc.setTextColor('white');
  doc.text(category, pageWidth / 2, y, { align: 'center' });
  doc.setFontSize(9);
}

// Render a single item row
function renderItemRow(doc, x, y, label, partnerA, partnerB, match) {
  const colLabel = x;
  const colA = x + 185;
  const colBar = colA + 42;
  const colFlag = colBar + 47;
  const colB = colFlag + 20;
  const barW = 45;
  const barH = 9;

  doc.setTextColor('white');

  doc.setFontSize(8);
  doc.text(label, colLabel, y);

  doc.text(partnerA === null || partnerA === undefined ? 'N/A' : String(partnerA), colA, y);

  drawMatchBar(doc, colBar, y - 6.5, barW, barH, match);

  doc.setFontSize(9);
  doc.text(getFlagEmoji(match), colFlag, y);

  doc.text(partnerB === null || partnerB === undefined ? 'N/A' : String(partnerB), colB, y);
}

// Render an entire category section including column headers
export function renderCategorySection(doc, startX, startY, categoryLabel, items) {
  renderCategoryHeader(doc, startY, categoryLabel);
  let currentY = startY + 13;

  // Column titles
  doc.setFontSize(9);
  doc.setTextColor('white');
  doc.text('Partner A', startX + 185, currentY);
  doc.text('Match', startX + 230, currentY);
  doc.text('Flag', startX + 278, currentY);
  doc.text('Partner B', startX + 298, currentY);

  currentY += 10;

  for (const item of items) {
    renderItemRow(
      doc,
      startX,
      currentY,
      item.label,
      item.partnerA,
      item.partnerB,
      item.match
    );
    currentY += 12;
  }

  return currentY;
}

