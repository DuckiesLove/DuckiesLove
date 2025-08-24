// 🧠 Kink Compatibility PDF Generator using unified layout
// Partner A = "Upload Your Survey"
// Partner B = "Upload Partner's Survey"
// Uses shared layout builder and category renderer for consistent formatting

import { buildLayout } from './compatibilityReportHelpers.js';
import { getFlagEmoji } from './matchFlag.js';

// ---- Helper functions ----

function shortenLabel(label = '') {
  if (label.length <= 40) return label;
  return label.slice(0, 40);
}

function formatScore(value) {
  return typeof value === 'number' ? String(value) : 'N/A';
}

function parseScore(value) {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function calculateMatch(aStr, bStr) {
  const a = parseScore(aStr);
  const b = parseScore(bStr);
  if (a == null || b == null) return null;
  return Math.max(0, 100 - Math.abs(a - b) * 20);
}

function getMatchFlag(aStr, bStr, match) {
  const a = parseScore(aStr);
  const b = parseScore(bStr);
  if (a == null || b == null || match == null) return 'N/A';
  return getFlagEmoji(match, a, b) || '';
}

function drawMatchBar(doc, layout, y, match, theme) {
  const { colBar, barWidth } = layout;
  const barHeight = 9;
  const label = match === null || match === undefined ? 'N/A' : `${match}%`;
  doc.setFillColor(theme.barFillColor);
  doc.rect(colBar, y - barHeight + 2.5, barWidth, barHeight, 'F');
  doc.setFontSize(7);
  doc.setTextColor(theme.barTextColor);
  doc.text(label, colBar + barWidth / 2, y + 1, { align: 'center' });
  doc.setTextColor(theme.textColor);
}

function drawCategoryItems(doc, items, layout, startY, theme) {
  let y = startY;
  const rowHeight = 14;

  for (const item of items) {
    const label = shortenLabel(item.label || item.name || '');
    const scoreA = formatScore(item.a || item.partnerA);
    const scoreB = formatScore(item.b || item.partnerB);
    const match = calculateMatch(scoreA, scoreB);
    const flag = getMatchFlag(scoreA, scoreB, match);

    doc.text(label, layout.colLabel, y);
    doc.text(scoreA, layout.colA, y);
    doc.text(match === null ? 'N/A' : `${match}%`, layout.colBar, y, { align: 'center' });
    doc.text(flag, layout.colFlag, y, { align: 'center' });
    doc.text(scoreB, layout.colB, y);

    drawMatchBar(doc, layout, y + 1, match, theme);
    y += rowHeight;
  }

  return y;
}

function drawCategorySection(title, items, layout, startY, doc, theme) {
  let y = startY;
  doc.text(String(title), layout.colLabel, y);
  y += 12;

  y = drawCategoryItems(doc, items, layout, y, theme);

  return y;
}

// ---- Main PDF generation ----

export function generateCompatibilityPDF(partnerAData, partnerBData, doc, theme = {}) {
  const {
    bgColor = '#ffffff',
    textColor = '#000000',
    barFillColor = '#000000',
    barTextColor = '#ffffff',
    font = 'helvetica'
  } = theme;

  doc.setFillColor(bgColor);
  doc.rect(
    0,
    0,
    doc.internal.pageSize.getWidth(),
    doc.internal.pageSize.getHeight(),
    'F'
  );

  doc.setTextColor(textColor);
  doc.setFont(font, 'normal');
  doc.setFontSize(12);
  doc.y = 50;

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = 40;
  const usableWidth = pageWidth - startX * 2;
  const layout = buildLayout(startX, usableWidth);
  const categories = new Set([
    ...Object.keys(partnerAData || {}),
    ...Object.keys(partnerBData || {})
  ]);

  const themeOptions = { barFillColor, barTextColor, textColor };

  let y = doc.y || 20;

  for (const category of categories) {
    const keys = new Set([
      ...Object.keys(partnerAData?.[category] || {}),
      ...Object.keys(partnerBData?.[category] || {})
    ]);

    const items = [...keys].map(label => {
      const scoreA = partnerAData?.[category]?.[label];
      const scoreB = partnerBData?.[category]?.[label];
      return { label, a: scoreA, b: scoreB };
    });

    y = drawCategorySection(category, items, layout, y, doc, themeOptions) + 6;
  }
}

export default generateCompatibilityPDF;

