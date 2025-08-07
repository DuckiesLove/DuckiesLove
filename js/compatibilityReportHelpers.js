// ---- Compatibility Report Rendering Helpers ----

// Determine the color of the match bar
function getMatchColor(percentage) {
  if (percentage === null || percentage === undefined) return 'black';
  if (percentage >= 80) return 'green';
  if (percentage >= 60) return 'yellow';
  if (percentage > 0) return 'red';
  return 'black';
}

// Flag logic
function getFlagIcon(a, b, match) {
  if (a === 5 && (b < 5 || b == null)) return '🟨';
  if (match === null || match === undefined) return '';
  if (match >= 90) return '⭐';
  if (match <= 30) return '🚩';
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

// Column layout setup using full width
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

// Helper: safely format score
function formatScore(value) {
  if (value === null || value === undefined || value === 'N/A') return 'N/A';
  return value.toString();
}

// Matching percentage logic
function getMatchPercentage(a, b) {
  if (a == null || b == null) return null;
  if (a === 'N/A' || b === 'N/A') return null;
  return Math.round(100 - Math.abs(a - b) * 20);
}

// Helper: draw one row of the kink table
function drawKinkRow(doc, layout, y, label, aScore, bScore, match) {
  const { colLabel, colA, colBar, colFlag, colB, barWidth, barHeight } = layout;
  const resolvedMatch =
    match !== undefined && match !== null ? match : getMatchPercentage(aScore, bScore);
  const flag = getFlagIcon(aScore, bScore, resolvedMatch);

  doc.setTextColor('white');
  doc.setFontSize(8);
  doc.text(label, colLabel, y);
  doc.text(formatScore(aScore), colA, y);
  drawMatchBar(doc, colBar, y - barHeight + 2.5, barWidth, barHeight, resolvedMatch);
  doc.text(flag, colFlag, y, { align: 'center' });
  doc.text(formatScore(bScore), colB, y);
}

// Render an entire category section including column headers
export function renderCategorySection(doc, startX, startY, categoryLabel, items, usableWidth) {
  renderCategoryHeader(doc, startX, startY, categoryLabel);
  const layout = buildLayout(startX, usableWidth);
  const { colA, colBar, colFlag, colB, barWidth } = layout;

  let currentY = startY + 13;

  // Column titles
  doc.setFontSize(9);
  doc.setTextColor('white');
  doc.text('Partner A', colA, currentY);
  doc.text('Match', colBar + barWidth / 2, currentY, { align: 'center' });
  doc.text('Flag', colFlag, currentY);
  doc.text('Partner B', colB, currentY);

  currentY += 10;

  for (const item of items) {
    drawKinkRow(doc, layout, currentY, item.label, item.partnerA, item.partnerB, item.match);
    currentY += 12;
  }

  return currentY;
}

