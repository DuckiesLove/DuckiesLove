// ---- Compatibility Report Rendering Helpers ----

const PX_TO_MM = 0.2645833333;
const LABEL_MAX_WIDTH_PX = 170;
const ROW_MIN_HEIGHT_PX = 24;
const MATCH_BAR_HEIGHT_PX = 12;
const MIN_MATCH_WIDTH_PX = 30;
const MIN_PARTNER_WIDTH_PX = 20;
const DEFAULT_FONT_SIZE = 10;
const DEFAULT_LINE_HEIGHT = 1.2;

const pxToMm = (px) => px * PX_TO_MM;

// Determine the font color used for the match percentage
function getFontColor(percentage) {
  if (percentage === null || percentage === undefined) return [255, 255, 255];
  if (percentage >= 90) return [0, 255, 0];
  if (percentage >= 60) return [255, 255, 0];
  return [255, 0, 0];
}

function getMatchEmoji(percentage) {
  if (percentage === null || percentage === undefined) return '';
  if (percentage >= 85) return '⭐';
  if (percentage <= 30) return '🚩';
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
  const emoji = getMatchEmoji(percentage);
  const label =
    percentage !== null && percentage !== undefined
      ? `${percentage}%${emoji ? ` ${emoji}` : ''}`
      : 'N/A';
  const textColor = getFontColor(percentage);

  doc.setFillColor(0, 0, 0);
  doc.rect(x, y, width, height, 'F');

  // Label centered inside the bar
  doc.setFontSize(Math.max(6, Math.min(8, height / pxToMm(1.5))));
  doc.setTextColor(...textColor);
  doc.text(label, x + width / 2, y + height / 2, {
    align: 'center',
    baseline: 'middle',
  });

  // Reset text color for subsequent drawing
  if (Array.isArray(resetColor)) {
    doc.setTextColor(...resetColor);
  } else {
    doc.setTextColor(resetColor);
  }
}

// Render the category header at the provided coordinates
function renderCategoryHeader(
  doc,
  x,
  y,
  category,
  textColor = [255, 255, 255],
  align = 'left'
) {
  doc.setFontSize(13);
  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }
  doc.text(category, x, y, { align });
  doc.setFontSize(9);
}

// Column layout setup using full width
export function buildLayout(startX, usableWidth) {
  const minPartner = pxToMm(MIN_PARTNER_WIDTH_PX);
  const minMatch = pxToMm(MIN_MATCH_WIDTH_PX);
  const minOtherTotal = minPartner * 2 + minMatch;

  let labelMaxWidth = Math.min(pxToMm(LABEL_MAX_WIDTH_PX), usableWidth * 0.33);
  if (labelMaxWidth < pxToMm(60)) {
    labelMaxWidth = Math.min(pxToMm(LABEL_MAX_WIDTH_PX), Math.max(pxToMm(60), usableWidth * 0.25));
  }

  let remainingWidth = Math.max(usableWidth - labelMaxWidth, 0);
  if (remainingWidth < minOtherTotal) {
    const needed = minOtherTotal - remainingWidth;
    const minLabel = pxToMm(48);
    labelMaxWidth = Math.max(minLabel, labelMaxWidth - needed);
    remainingWidth = Math.max(minOtherTotal, usableWidth - labelMaxWidth);
  }

  const weightPartner = 1;
  const weightMatch = 2.4;
  const totalWeight = weightPartner * 2 + weightMatch;
  const unit = totalWeight > 0 ? remainingWidth / totalWeight : 0;

  let partnerWidth = Math.max(minPartner, unit * weightPartner);
  let matchWidth = Math.max(minMatch, unit * weightMatch);
  let usedOther = partnerWidth * 2 + matchWidth;
  if (usedOther > remainingWidth) {
    const over = usedOther - remainingWidth;
    const adjustable = (partnerWidth - minPartner) * 2 + (matchWidth - minMatch);
    if (adjustable > 0) {
      const ratio = over / adjustable;
      partnerWidth -= (partnerWidth - minPartner) * ratio;
      matchWidth -= (matchWidth - minMatch) * ratio;
      usedOther = partnerWidth * 2 + matchWidth;
    }
    if (usedOther > remainingWidth) {
      matchWidth = Math.max(minMatch, matchWidth - (usedOther - remainingWidth));
    }
  }

  const colLabel = startX;
  const colLabelRight = colLabel + labelMaxWidth;

  const colAStart = colLabelRight;
  const colACenter = colAStart + partnerWidth / 2;

  const colBar = colAStart + partnerWidth;
  const colBarCenter = colBar + matchWidth / 2;

  const colBStart = colBar + matchWidth;
  const colBCenter = colBStart + partnerWidth / 2;

  const rowHeight = Math.max(pxToMm(ROW_MIN_HEIGHT_PX), 8);
  const barHeight = Math.min(rowHeight - pxToMm(6), pxToMm(MATCH_BAR_HEIGHT_PX));
  const barPadding = matchWidth > 0 ? Math.min(matchWidth / 6, pxToMm(6)) : 0;
  const barWidth = Math.max(matchWidth - barPadding * 2, 0);

  return {
    colLabel,
    colLabelRight,
    colA: colACenter,
    colAStart,
    colBar,
    colBarCenter,
    colB: colBCenter,
    colBStart,
    barWidth,
    barHeight,
    barPadding,
    startX,
    width: usableWidth,
    endX: startX + usableWidth,
    labelMaxWidth,
    partnerWidth,
    matchWidth,
    rowHeight,
    headerHeight: Math.max(pxToMm(20), rowHeight * 0.85),
    columnHeaderGap: Math.max(pxToMm(12), rowHeight * 0.6),
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: DEFAULT_LINE_HEIGHT,
  };
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
function drawKinkRow(
  doc,
  layout,
  rowTop,
  label,
  aScore,
  bScore,
  match,
  textColor = [255, 255, 255]
) {
  const {
    colLabel,
    labelMaxWidth,
    colA,
    colBar,
    colB,
    barWidth,
    barHeight,
    barPadding,
    rowHeight,
    fontSize,
    lineHeight,
  } = layout;
  const aNorm = normalizeScore(aScore);
  const bNorm = normalizeScore(bScore);
  const centerY = rowTop + rowHeight / 2;

  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }

  doc.setFontSize(fontSize);
  const lineHeightMm = fontSize * lineHeight * 0.352778;
  let lines = Array.isArray(label) ? label : doc.splitTextToSize(label, labelMaxWidth);
  if (lines.length > 2) {
    const combined = lines.slice(0, 2);
    if (lines.length > 2) {
      const last = combined.pop();
      combined.push(`${last.replace(/…?$/, '').trim()}…`);
    }
    lines = combined;
  }
  const textBlockHeight = lineHeightMm * (lines.length - 1);
  const firstLineY = centerY - textBlockHeight / 2 + (lines.length === 1 ? fontSize * 0.352778 / 2.5 : 0);
  doc.text(lines, colLabel, firstLineY, {
    align: 'left',
    lineHeightFactor: lineHeight,
  });

  const format = (value) => formatScore(value);

  if (aNorm == null || bNorm == null) {
    doc.text('N/A', colA, centerY, { align: 'center', baseline: 'middle' });
    drawMatchBar(
      doc,
      colBar + barPadding,
      rowTop + (rowHeight - barHeight) / 2,
      barWidth,
      barHeight,
      null,
      textColor
    );
    doc.text('N/A', colB, centerY, { align: 'center', baseline: 'middle' });
    return;
  }

  const resolvedMatch =
    match !== undefined && match !== null ? match : getMatchPercentage(aNorm, bNorm);

  doc.text(format(aNorm), colA, centerY, { align: 'center', baseline: 'middle' });
  drawMatchBar(
    doc,
    colBar + barPadding,
    rowTop + (rowHeight - barHeight) / 2,
    barWidth,
    barHeight,
    resolvedMatch,
    textColor
  );
  doc.text(format(bNorm), colB, centerY, { align: 'center', baseline: 'middle' });
}

// Render an entire category section including column headers
function normalizeColor(color, fallback) {
  if (Array.isArray(color) && color.length === 3) {
    return color.map((v) => Math.max(0, Math.min(255, Number(v) || 0)));
  }

  if (typeof color === 'string') {
    const trimmed = color.trim().toLowerCase();
    const named = {
      white: [255, 255, 255],
      black: [0, 0, 0],
      gray: [128, 128, 128],
      grey: [128, 128, 128],
      silver: [192, 192, 192],
    };
    if (named[trimmed]) return named[trimmed];
    if (trimmed === 'transparent') return null;
    const hexMatch = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex.split('').map((ch) => ch + ch).join('');
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return [r, g, b];
    }
  }

  return Array.isArray(fallback) ? fallback : normalizeColor(fallback, [255, 255, 255]);
}

export function renderCategorySection(doc, categoryLabel, items, layout, startY, options = [255, 255, 255]) {
  const {
    textColor,
    borderColor,
    borderWidth,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    backgroundColor,
  } = (() => {
    if (Array.isArray(options) || typeof options === 'string') {
      return {
        textColor: options,
        borderColor: [96, 96, 96],
        borderWidth: 0.8,
        paddingTop: 8,
        paddingRight: 10,
        paddingBottom: 8,
        paddingLeft: 10,
        backgroundColor: null,
      };
    }
    const padding = Number.isFinite(options.padding) ? Number(options.padding) : null;
    return {
      textColor: options.textColor ?? [255, 255, 255],
      borderColor: options.borderColor ?? [96, 96, 96],
      borderWidth: options.borderWidth ?? 0.8,
      paddingTop: options.paddingTop ?? padding ?? 8,
      paddingRight: options.paddingRight ?? padding ?? 10,
      paddingBottom: options.paddingBottom ?? padding ?? 8,
      paddingLeft: options.paddingLeft ?? padding ?? 10,
      backgroundColor: options.backgroundColor ?? null,
    };
  })();

  const {
    colLabel,
    colA,
    colBar,
    colB,
    startX,
    width,
    rowHeight,
    headerHeight,
    columnHeaderGap,
    matchWidth,
  } = layout;
  const sectionHeight = headerHeight + columnHeaderGap + items.length * rowHeight;

  const innerStartX = startX ?? colLabel;
  const usedWidth = width ?? Math.max(colB, colBar + (matchWidth || 0)) - innerStartX;
  const rectX = innerStartX - paddingLeft;
  const rectY = startY - paddingTop;
  const rectWidth = Math.max(0, usedWidth + paddingLeft + paddingRight);
  const rectHeight = Math.max(0, sectionHeight + paddingTop + paddingBottom);

  const resolvedBorderColor = normalizeColor(borderColor, [96, 96, 96]);
  const resolvedBackground = backgroundColor == null ? null : normalizeColor(backgroundColor, null);

  if (rectWidth > 0 && rectHeight > 0) {
    if (resolvedBackground) {
      doc.setFillColor(...resolvedBackground);
      doc.rect(rectX, rectY, rectWidth, rectHeight, 'F');
    }
    if (borderWidth > 0 && resolvedBorderColor) {
      doc.setDrawColor(...resolvedBorderColor);
      doc.setLineWidth(borderWidth);
      doc.rect(rectX, rectY, rectWidth, rectHeight, 'S');
      doc.setLineWidth(0);
    }
  }

  const sectionCenterX = innerStartX + usedWidth / 2;
  renderCategoryHeader(doc, sectionCenterX, startY, categoryLabel, textColor, 'center');

  let currentY = startY + headerHeight;

  // Column titles
  doc.setFontSize(9);
  if (Array.isArray(textColor)) {
    doc.setTextColor(...textColor);
  } else {
    doc.setTextColor(textColor);
  }
    doc.text('Kinks', colLabel, currentY, { align: 'left' });
  doc.text('Partner A', colA, currentY, { align: 'center' });
  const matchHeaderX = matchWidth ? colBar + matchWidth / 2 : colBar;
  doc.text('Match %', matchHeaderX, currentY, { align: 'center' });
  doc.text('Partner B', colB, currentY, { align: 'center' });

  currentY += columnHeaderGap;

  for (const item of items) {
    drawKinkRow(
      doc,
      layout,
      currentY,
      item.label,
      item.partnerA,
      item.partnerB,
      item.match,
      textColor
    );
    currentY += rowHeight;
  }

  return currentY;
}

