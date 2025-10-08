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
  const endX = startX + usableWidth;
  return {
    colLabel,
    colA,
    colBar,
    colFlag,
    colB,
    barWidth,
    barHeight,
    startX,
    width: usableWidth,
    endX,
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

  const { colLabel, colA, colBar, colFlag, colB, barWidth, startX, width } = layout;
  const headerSpacing = 13;
  const columnSpacing = 10;
  const rowSpacing = 12;
  const sectionHeight = headerSpacing + columnSpacing + items.length * rowSpacing;

  const rectX = (startX ?? colLabel) - paddingLeft;
  const rectY = startY - paddingTop;
  const usedWidth = width ?? Math.max(colB, colFlag, colBar + barWidth) - (startX ?? colLabel);
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

  renderCategoryHeader(doc, colLabel, startY, categoryLabel, textColor);

  let currentY = startY + headerSpacing;

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

  currentY += columnSpacing;

  for (const item of items) {
    drawKinkRow(doc, layout, currentY, item.label, item.partnerA, item.partnerB, item.match, textColor);
    currentY += rowSpacing;
  }

  return currentY;
}

