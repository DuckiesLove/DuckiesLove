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

// Render the category header at the provided coordinates
function renderCategoryHeader(doc, x, y, category) {
  doc.setFontSize(13);
  doc.setTextColor('white');
  doc.text(category, x, y);
  doc.setFontSize(9);
}

// Compute column layout relative to the available width
function buildLayout(startX, usableWidth) {
  const colLabel = startX;
  const colA = startX + usableWidth * 0.45;
  const barWidth = usableWidth * 0.15;
  const colBar = startX + usableWidth * 0.6;
  const colFlag = colBar + barWidth + usableWidth * 0.02;
  const colB = startX + usableWidth * 0.85;
  const barHeight = 9;
  return { colLabel, colA, colBar, colFlag, colB, barWidth, barHeight };
}

// Render a single item row
function renderItemRow(doc, layout, y, label, partnerA, partnerB, match) {
  const { colLabel, colA, colBar, colFlag, colB, barWidth, barHeight } = layout;

  doc.setTextColor('white');

  doc.setFontSize(8);
  doc.text(label, colLabel, y);

  doc.text(partnerA ?? 'N/A', colA, y);

  drawMatchBar(doc, colBar, y - barHeight + 2.5, barWidth, barHeight, match);

  doc.setFontSize(9);
  doc.text(getFlagEmoji(match), colFlag, y);

  doc.text(partnerB ?? 'N/A', colB, y);
}

// Render an entire category section including column headers
export function renderCategorySection(doc, startX, startY, categoryLabel, items, usableWidth) {
  renderCategoryHeader(doc, startX, startY, categoryLabel);
  let currentY = startY + 13;

  const layout = buildLayout(startX, usableWidth);
  const { colLabel, colA, colBar, colFlag, colB, barWidth, barHeight } = layout;

  // Column titles
  doc.setFontSize(9);
  doc.setTextColor('white');
  doc.text('Partner A', colA, currentY);
  doc.text('Match', colBar + barWidth / 2, currentY, { align: 'center' });
  doc.text('Flag', colFlag, currentY);
  doc.text('Partner B', colB, currentY);

  currentY += 10;

  for (const item of items) {
    renderItemRow(
      doc,
      layout,
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

