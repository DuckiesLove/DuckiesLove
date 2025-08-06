import { getMatchColor, getFlagEmoji } from './matchFlag.js';

// Match Bar Renderer with label inside
export function drawMatchBar(doc, x, y, width, height, percentage) {
  const color = getMatchColor(percentage);
  const label = percentage !== null && percentage !== undefined ? `${percentage}%` : 'N/A';

  // Bar background
  doc.setFillColor('black');
  doc.rect(x, y, width, height, 'F');

  if (percentage !== null && percentage !== undefined) {
    const fillWidth = Math.floor((percentage / 100) * width);
    doc.setFillColor(color);
    doc.rect(x, y, fillWidth, height, 'F');
  }

  // Text centered in bar
  doc.setTextColor('white');
  doc.setFontSize(8);
  doc.text(label, x + width / 2, y + height / 2 + 2, { align: 'center' });
}

// Render Category Header Row
export function renderCategoryHeader(doc, x, y, categoryName) {
  doc.setFontSize(14);
  doc.setTextColor('white');
  doc.text(categoryName, x, y);
  doc.setFontSize(10);
}

// Render Individual Row with full layout
export function renderItemRow(doc, x, y, itemLabel, aScore, bScore, matchPercent) {
  const barWidth = 40;
  const barHeight = 8;
  const labelX = x;
  const aX = x + 190;
  const barX = aX + 40;
  const flagX = barX + barWidth + 5;
  const bX = flagX + 20;

  doc.setFontSize(10);
  doc.setTextColor('white');
  doc.text(itemLabel, labelX, y);

  doc.text(aScore ?? 'N/A', aX, y);
  drawMatchBar(doc, barX, y - barHeight + 1, barWidth, barHeight, matchPercent);
  doc.text(getFlagEmoji(matchPercent), flagX, y);
  doc.text(bScore ?? 'N/A', bX, y);
}

// Render Category Section
export function renderCategorySection(doc, startX, startY, categoryName, items) {
  renderCategoryHeader(doc, startX, startY, categoryName);
  let currentY = startY + 10;

  for (const item of items) {
    const { label, partnerA, partnerB, match } = item;
    renderItemRow(doc, startX, currentY, label, partnerA, partnerB, match);
    currentY += 12;
  }

  return currentY;
}
