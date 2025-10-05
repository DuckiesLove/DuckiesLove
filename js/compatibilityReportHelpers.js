// ---- Compatibility Report Rendering Helpers ----

// Determine the font color used for the match percentage
function getFontColor(percentage) {
  if (percentage === null || percentage === undefined) return [255, 255, 255];
  if (percentage >= 90) return [0, 255, 0];
  if (percentage >= 60) return [255, 255, 0];
  return [255, 0, 0];
}

// Flag logic
function getFlagIcon(a, b, match) {
  if (a == null || b == null) return 'N/A';
  if (match === null || match === undefined) return 'N/A';
  if (match >= 90) return '⭐';
  if ((a === 5 && b < 5) || (b === 5 && a < 5)) return '🟨';
  if (match < 30) return '🚩';
  return '';
}

// Draw the colored match bar with percentage label (or N/A)
export function drawMatchBar(
  doc,
  x,
  y,
  width,
  height,
  percentage,
  resetColor = [255, 255, 255]
) {
  const label = percentage !== null && percentage !== undefined ? `${percentage}%` : 'N/A';
  const textColor = getFontColor(percentage);

  doc.setFillColor(0, 0, 0);
  doc.rect(x, y, width, height, 'F');

  // Label centered inside the bar
  doc.setFontSize(7);
  doc.setTextColor(...textColor);
  doc.text(label, x + width / 2, y + height / 2 + 1.8, { align: 'center' });

  // Reset text color for subsequent drawing
  if (Array.isArray(resetColor)) {
    doc.setTextColor(...resetColor);
  } else {
    doc.setTextColor(resetColor);
  }
}

// Render the category header at the provided coordinates
function renderCategoryHeader(doc, x, y, category, textColor = [255, 255, 255]) {
  doc.setFontSize(13);
  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }
  doc.text(category, x, y);
  doc.setFontSize(9);
}

// Column layout setup using full width
export function buildLayout(startX, usableWidth) {
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

// Normalize score to range 0-5; returns null if value is not a number
export function normalizeScore(val) {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  return Math.min(5, Math.max(0, num));
}

// Matching percentage logic
export function getMatchPercentage(a, b) {
  const aNorm = normalizeScore(a);
  const bNorm = normalizeScore(b);
  if (aNorm == null || bNorm == null) return null;
  const diff = Math.min(5, Math.abs(aNorm - bNorm));
  return Math.round(100 - diff * 20);
}

// Helper: draw one row of the kink table
function drawKinkRow(doc, layout, y, label, aScore, bScore, match, textColor = [255, 255, 255]) {
  const { colLabel, colA, colBar, colFlag, colB, barWidth, barHeight } = layout;
  const aNorm = normalizeScore(aScore);
  const bNorm = normalizeScore(bScore);

  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }
  doc.setFontSize(8);
  doc.text(label, colLabel, y, {
    width: colA - colLabel - 5,
    align: 'left',
  });

  if (aNorm == null || bNorm == null) {
    doc.text('N/A', colA, y, { align: 'left' });
    drawMatchBar(doc, colBar, y - barHeight + 2.5, barWidth, barHeight, null, textColor);
    doc.text('N/A', colFlag, y, { align: 'center' });
    doc.text('N/A', colB, y, { align: 'left' });
    return;
  }

  const resolvedMatch =
    match !== undefined && match !== null ? match : getMatchPercentage(aNorm, bNorm);
  const flag = getFlagIcon(aNorm, bNorm, resolvedMatch);

  doc.text(formatScore(aNorm), colA, y, { align: 'left' });
  drawMatchBar(doc, colBar, y - barHeight + 2.5, barWidth, barHeight, resolvedMatch, textColor);
  doc.text(flag, colFlag, y, { align: 'center' });
  doc.text(formatScore(bNorm), colB, y, { align: 'left' });
}

// Render an entire category section including column headers
export function renderCategorySection(doc, categoryLabel, items, layout, startY, textColor = [255, 255, 255]) {
  const { colLabel, colA, colBar, colFlag, colB, barWidth } = layout;

  renderCategoryHeader(doc, colLabel, startY, categoryLabel, textColor);

  let currentY = startY + 13;

  // Column titles
  doc.setFontSize(9);
  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }
  doc.text('Partner A', colA, currentY);
  doc.text('Match', colBar + barWidth / 2, currentY, { align: 'center' });
  doc.text('Flag', colFlag, currentY);
  doc.text('Partner B', colB, currentY);

  currentY += 10;

  for (const item of items) {
    drawKinkRow(doc, layout, currentY, item.label, item.partnerA, item.partnerB, item.match, textColor);
    currentY += 12;
  }

  return currentY;
}

