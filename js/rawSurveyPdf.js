// 🧠 Kink Compatibility PDF Generator using unified layout
// Partner A = "Upload Your Survey"
// Partner B = "Upload Partner's Survey"
// Uses shared layout builder and category renderer for consistent formatting

import { buildLayout } from './compatibilityReportHelpers.js';

// ---- Helper functions ----

function drawText(doc, text, x, y) {
  doc.text(String(text), x, y);
}

function shortenLabel(label = '') {
  if (label.length <= 40) return label;
  return label.slice(0, 40);
}

function drawScore(doc, score, x, y) {
  const value = score === null || score === undefined ? 'N/A' : String(score);
  drawText(doc, value, x, y);
}

function drawCompatibilityBar(doc, match, x, width, y) {
  const barHeight = 9;
  const label = match === null || match === undefined ? 'N/A' : `${match}%`;
  doc.setFillColor('black');
  doc.rect(x, y - barHeight + 2.5, width, barHeight, 'F');
  doc.setFontSize(7);
  doc.setTextColor('white');
  doc.text(label, x + width / 2, y + 1, { align: 'center' });
}

function drawFlagEmoji(doc, match, scoreA, scoreB, x, y) {
  let emoji = '';
  if (scoreA == null || scoreB == null || match == null) {
    emoji = 'N/A';
  } else if (match >= 90) {
    emoji = '⭐';
  } else if ((scoreA === 5 && scoreB < 5) || (scoreB === 5 && scoreA < 5)) {
    emoji = '🟨';
  } else if (match < 30) {
    emoji = '🚩';
  }
  drawText(doc, emoji, x, y);
}

function drawCategorySection(title, items, layout, startY, doc) {
  let y = startY;
  drawText(doc, title, layout.colLabel, y);
  y += 12;

  items.forEach(item => {
    drawText(doc, shortenLabel(item.label), layout.colLabel, y);
    drawScore(doc, item.scoreA, layout.colA, y);
    drawCompatibilityBar(doc, item.match, layout.colBar, layout.barWidth, y);
    drawFlagEmoji(doc, item.match, item.scoreA, item.scoreB, layout.colFlag, y);
    drawScore(doc, item.scoreB, layout.colB, y);
    y += 14;
  });

  return y;
}

// ---- Main PDF generation ----

export function generateCompatibilityPDF(partnerAData, partnerBData, doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 40;
  const usableWidth = pageWidth - startX * 2;
  const layout = buildLayout(startX, usableWidth);
  const categories = new Set([
    ...Object.keys(partnerAData || {}),
    ...Object.keys(partnerBData || {})
  ]);

  let y = doc.y || 20;

  for (const category of categories) {
    const keys = new Set([
      ...Object.keys(partnerAData?.[category] || {}),
      ...Object.keys(partnerBData?.[category] || {})
    ]);

    const items = [...keys].map(label => {
      const scoreA = partnerAData?.[category]?.[label];
      const scoreB = partnerBData?.[category]?.[label];
      const match =
        typeof scoreA === 'number' && typeof scoreB === 'number'
          ? Math.max(0, 100 - Math.abs(scoreA - scoreB) * 20)
          : null;
      return { label, scoreA, scoreB, match };
    });

    y = drawCategorySection(category, items, layout, y, doc) + 6;
  }
}

export default generateCompatibilityPDF;

