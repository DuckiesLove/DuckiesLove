import * as helperModule from './compatibilityReportHelpers.js';
import { getFlagSymbol } from './matchFlag.js';
import { shortenLabel } from './labelShortener.js';
import { ensureJsPDF } from './loadJsPDF.js';
const DEBUG = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export function downloadCompatibilityPDF(doc, filename = 'TalkKink-Compatibility.pdf') {
  if (!doc || typeof doc.save !== 'function') {
    console.error('[pdf] downloadCompatibilityPDF expected a jsPDF instance');
    return;
  }
  doc.save(filename);
}

const FALLBACK_ROW_HEIGHT = 11;
const FALLBACK_HEADER_HEIGHT = 10;
const FALLBACK_COLUMN_GAP = 6;

const warnedHelpers = new Set();
const warnMissingHelper = (name) => {
  if (warnedHelpers.has(name)) return;
  warnedHelpers.add(name);
  console.warn(`[compat-pdf] Missing helper "${name}". Using fallback implementation.`);
};

const fallbackHelpers = (() => {
  const normalizeScore = (val) => {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    if (Number.isNaN(num)) return null;
    return Math.min(5, Math.max(0, num));
  };

  const getMatchPercentage = (a, b) => {
    const aNorm = normalizeScore(a);
    const bNorm = normalizeScore(b);
    if (aNorm == null || bNorm == null) return null;
    const diff = Math.min(5, Math.abs(aNorm - bNorm));
    return Math.round(100 - diff * 20);
  };

  const getFlag = (a, b, match) => {
    if (a == null || b == null || match == null) return '';
    return getFlagSymbol({
      hasData: true,
      matchPct: match,
      aScore: a,
      bScore: b,
    });
  };

  const toColorArray = (color, fallback = [255, 255, 255]) => {
    if (Array.isArray(color) && color.length === 3) return color;
    if (typeof color === 'string') {
      const trimmed = color.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
        const hex = trimmed.replace('#', '');
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    }
    return fallback;
  };

  const buildLayout = (startX = 10, usableWidth = 260) => {
    const width = Math.max(usableWidth, 160);
    const labelWidth = Math.max(width * 0.44, 70);
    const remaining = Math.max(width - labelWidth, 60);
    const partnerWidth = Math.max(remaining * 0.25, 24);
    const matchWidth = Math.max(remaining * 0.35, 36);
    const flagWidth = Math.max(remaining - partnerWidth * 2 - matchWidth, 12);

    const colLabel = startX;
    const colAStart = colLabel + labelWidth;
    const colACenter = colAStart + partnerWidth / 2;
    const colBarStart = colAStart + partnerWidth;
    const colBarCenter = colBarStart + matchWidth / 2;
    const colBStart = colBarStart + matchWidth;
    const colBCenter = colBStart + partnerWidth / 2;
    const colFlagStart = colBStart + partnerWidth;
    const colFlag = colFlagStart + flagWidth / 2;

    return {
      startX,
      width,
      colLabel,
      colA: colACenter,
      colBar: colBarCenter,
      colB: colBCenter,
      colFlag,
      matchWidth,
      labelWidth,
      rowHeight: FALLBACK_ROW_HEIGHT,
      headerHeight: FALLBACK_HEADER_HEIGHT,
      columnHeaderGap: FALLBACK_COLUMN_GAP,
    };
  };

  const formatScore = (value) => {
    if (value === null || value === undefined || value === 'N/A') return 'N/A';
    return String(value);
  };

  const renderCategorySection = (doc, categoryLabel, items, layout, startY, options = {}) => {
    const {
      textColor = [255, 255, 255],
      borderColor = [96, 96, 96],
      borderWidth = 0.6,
      paddingTop = 6,
      paddingRight = 8,
      paddingBottom = 6,
      paddingLeft = 8,
      backgroundColor = null,
    } = options;

    const blockHeight = layout.headerHeight + layout.columnHeaderGap + items.length * layout.rowHeight;
    const rectX = layout.startX - paddingLeft;
    const rectY = startY - paddingTop;
    const rectWidth = layout.width + paddingLeft + paddingRight;
    const rectHeight = blockHeight + paddingTop + paddingBottom;

    const bgColor = backgroundColor ? toColorArray(backgroundColor, null) : null;
    if (bgColor) {
      doc.setFillColor(...bgColor);
      doc.rect(rectX, rectY, rectWidth, rectHeight, 'F');
    }
    if (borderWidth > 0) {
      doc.setDrawColor(...toColorArray(borderColor));
      doc.setLineWidth(borderWidth);
      doc.rect(rectX, rectY, rectWidth, rectHeight, 'S');
      doc.setLineWidth(0);
    }

    const headerX = layout.startX + layout.width / 2;
    doc.setFontSize(13);
    doc.setTextColor(...toColorArray(textColor));
    doc.text(categoryLabel, headerX, startY, { align: 'center' });

    let currentY = startY + layout.headerHeight;
    doc.setFontSize(9);
    doc.text('Item', layout.colLabel, currentY);
    doc.text('Partner A', layout.colA, currentY, { align: 'center' });
    doc.text('Match', layout.colBar, currentY, { align: 'center' });
    doc.text('Partner B', layout.colB, currentY, { align: 'center' });
    doc.text('Flag', layout.colFlag, currentY, { align: 'center' });

    currentY += layout.columnHeaderGap;
    const labelWidth = layout.labelWidth || 60;

    items.forEach((item) => {
      const lines = typeof doc.splitTextToSize === 'function'
        ? doc.splitTextToSize(item.label || '', labelWidth)
        : [item.label || ''];
      doc.text(lines, layout.colLabel, currentY);

      doc.text(formatScore(item.partnerA), layout.colA, currentY, { align: 'center' });
      const match = item.match ?? getMatchPercentage(item.partnerA, item.partnerB);
      doc.text(match != null ? `${match}%` : 'N/A', layout.colBar, currentY, { align: 'center' });
      doc.text(formatScore(item.partnerB), layout.colB, currentY, { align: 'center' });
      const flagText = item.flag != null && item.flag !== ''
        ? String(item.flag)
        : getFlag(item.partnerA, item.partnerB, match);
      doc.text(flagText, layout.colFlag, currentY, { align: 'center' });
      currentY += layout.rowHeight;
    });

    return currentY;
  };

  return { buildLayout, getMatchPercentage, renderCategorySection };
})();

function resolveHelperFunctions() {
  const globalHelpers =
    typeof window !== 'undefined' && window.compatibilityReportHelpers
      ? window.compatibilityReportHelpers
      : null;
  const resolved = {};
  ['buildLayout', 'getMatchPercentage', 'renderCategorySection'].forEach((name) => {
    const fromModule = helperModule && typeof helperModule[name] === 'function' ? helperModule[name] : null;
    const fromGlobal = globalHelpers && typeof globalHelpers[name] === 'function' ? globalHelpers[name] : null;
    if (fromModule) {
      resolved[name] = fromModule;
      return;
    }
    if (fromGlobal) {
      resolved[name] = fromGlobal;
      return;
    }
    warnMissingHelper(name);
    resolved[name] = fallbackHelpers[name];
  });
  if (typeof window !== 'undefined') {
    window.compatibilityReportHelpers = {
      buildLayout: resolved.buildLayout,
      getMatchPercentage: resolved.getMatchPercentage,
      renderCategorySection: resolved.renderCategorySection,
    };
  }
  return resolved;
}

const { buildLayout, getMatchPercentage, renderCategorySection } = resolveHelperFunctions();

function parseCompatRowsFromState() {
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
      return window.talkkinkCompatRows;
    }
  } catch (error) {
    console.warn('[compat-pdf] Failed reading window.talkkinkCompatRows', error);
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('talkkink:compatRows');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (error) {
    console.warn('[compat-pdf] Failed reading cached compatibility rows', error);
  }

  return [];
}

function normalizeScoreValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function normalizeMatchValue(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value).trim();
  if (!match) return null;
  const cleaned = match.endsWith('%') ? match.slice(0, -1) : match;
  const num = Number(cleaned.replace(/[^\d.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export async function renderCompatibilityReport(doc, rows = []) {
  if (!doc || typeof doc.text !== 'function') return;

  const pageWidth = doc.internal?.pageSize?.getWidth ? doc.internal.pageSize.getWidth() : 612;
  const pageHeight = doc.internal?.pageSize?.getHeight ? doc.internal.pageSize.getHeight() : 792;

  const marginX = 40;
  const marginTop = 60;
  const footerMargin = 48;

  const layout = buildLayout(marginX, pageWidth - marginX * 2);
  const sectionBaseHeight = layout.headerHeight + layout.columnHeaderGap;
  const rowHeight = layout.rowHeight;

  const sectionStyle = {
    textColor: [255, 255, 255],
    borderColor: [100, 100, 100],
    borderWidth: 0.8,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    backgroundColor: null,
  };

  const maxContentY = pageHeight - footerMargin;

  const drawBackground = () => {
    if (typeof doc.setFillColor === 'function' && typeof doc.rect === 'function') {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
    }
    if (typeof doc.setTextColor === 'function') {
      doc.setTextColor(255, 255, 255);
    }
  };

  const titleY = marginTop;
  drawBackground();
  if (typeof doc.setFont === 'function') doc.setFont('helvetica', 'bold');
  if (typeof doc.setFontSize === 'function') doc.setFontSize(20);
  doc.text('TalkKink Compatibility Report', pageWidth / 2, titleY, { align: 'center' });

  if (typeof doc.setFont === 'function') doc.setFont('helvetica', 'normal');
  if (typeof doc.setFontSize === 'function') doc.setFontSize(12);

  let y = titleY + 28;
  let index = 0;

  const formattedRows = rows.map((row) => {
    const [label, partnerA, match, flag, partnerB] = Array.isArray(row) ? row : [];
    const normalizedMatch = normalizeMatchValue(match);
    return {
      label: shortenLabel(label || ''),
      partnerA: normalizeScoreValue(partnerA),
      partnerB: normalizeScoreValue(partnerB),
      match: normalizedMatch,
      flag: flag ?? '',
    };
  });

  while (index < formattedRows.length) {
    const remainingItems = formattedRows.slice(index);
    const availableSpace = maxContentY - (y + sectionStyle.paddingTop + sectionStyle.paddingBottom);
    let maxRows = Math.floor((availableSpace - sectionBaseHeight) / rowHeight);

    if (!Number.isFinite(maxRows) || maxRows < 1) {
      doc.addPage();
      drawBackground();
      if (typeof doc.setFont === 'function') doc.setFont('helvetica', 'normal');
      if (typeof doc.setFontSize === 'function') doc.setFontSize(12);
      y = marginTop;
      continue;
    }

    const chunk = remainingItems.slice(0, Math.max(1, maxRows));
    const sectionLabel = index === 0 ? 'Compatibility Overview' : 'Compatibility Overview (cont.)';

    const endY = renderCategorySection(doc, sectionLabel, chunk, layout, y, sectionStyle);
    y = endY + sectionStyle.paddingBottom + 10;
    index += chunk.length;
  }
}

export async function generateCompatibilityPDF(data = { categories: [] }, options = {}) {
  if (DEBUG) {
    console.log('PDF function triggered');
  }

  const stateRows = parseCompatRowsFromState();
  const hasExplicitCategories = Array.isArray(data?.categories) && data.categories.length > 0;

  if (!hasExplicitCategories && (!Array.isArray(stateRows) || stateRows.length === 0)) {
    console.error('[compat-pdf] No compatibility rows found – cannot build PDF');
    if (typeof alert === 'function') {
      alert(
        'I could not find any compatibility data to include in the PDF. ' +
        'Please make sure both surveys are uploaded and comparison has been run.'
      );
    }
    return null;
  }

  const jsPDFCtor = await ensureJsPDF();

  if (!hasExplicitCategories) {
    const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    if (typeof doc.setLineWidth !== 'function') {
      doc.setLineWidth = function noopSetLineWidth() {};
    }

    await renderCompatibilityReport(doc, stateRows);

    const filename = options?.filename || 'TalkKink-Compatibility.pdf';
    downloadCompatibilityPDF(doc, filename);
    return doc;
  }

  const doc = new jsPDFCtor({ orientation: 'landscape' });
  if (typeof doc.setLineWidth !== 'function') {
    doc.setLineWidth = function noopSetLineWidth() {};
  }

  const {
    filename = 'compatibility_report.pdf',
    save = true,
  } = options || {};

  const config = {
    margin: 10,
    rowHeight: 10,
    barHeight: 9,
    maxY: 190
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const startX = config.margin;
  const usableWidth = pageWidth - startX * 2;

  const layout = buildLayout(startX, usableWidth);

  const drawBackground = () => {
    const pageWidthInner = doc.internal.pageSize.getWidth();
    const pageHeightInner = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidthInner, pageHeightInner, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const categories = Array.isArray(data) ? data : data?.categories || [];
  if (categories.length === 0) {
    console.warn('generateCompatibilityPDF called without data');
  }
  let y = 20;

  drawBackground();
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', 105, y);
  y += 10;

  const sectionStyle = {
    textColor: [255, 255, 255],
    borderColor: [100, 100, 100],
    borderWidth: 0.8,
    paddingTop: 10,
    paddingRight: 14,
    paddingBottom: 10,
    paddingLeft: 14,
    backgroundColor: null,
  };

  const sectionBaseHeight = layout.headerHeight + layout.columnHeaderGap;
  const rowHeight = layout.rowHeight;

  for (const category of categories) {
    const rawItems = Array.isArray(category.items) ? category.items : [];
    let index = 0;

    while (index < rawItems.length) {
      const remainingItems = rawItems.slice(index);
      const availableSpace = config.maxY - (y + sectionStyle.paddingTop + sectionStyle.paddingBottom);
      let maxRows = Math.floor((availableSpace - sectionBaseHeight) / rowHeight);

      if (maxRows < 1) {
        doc.addPage();
        drawBackground();
        y = 20;
        continue;
      }

      const chunk = remainingItems.slice(0, Math.max(1, maxRows));
      const formatted = chunk.map((item) => {
        const aScoreRaw = typeof item.a === 'number'
          ? item.a
          : typeof item.partnerA === 'number'
            ? item.partnerA
            : typeof item.scoreA === 'number'
              ? item.scoreA
              : null;
        const bScoreRaw = typeof item.b === 'number'
          ? item.b
          : typeof item.partnerB === 'number'
            ? item.partnerB
            : typeof item.scoreB === 'number'
              ? item.scoreB
              : null;

        const matchPercent =
          aScoreRaw !== null && bScoreRaw !== null
            ? getMatchPercentage(aScoreRaw, bScoreRaw)
            : null;

        const label = item.label || item.kink || item.name || '';

        if (DEBUG) {
          console.log('Rendering:', label, 'A:', aScoreRaw, 'B:', bScoreRaw);
        }

        return {
          label: shortenLabel(label),
          partnerA: aScoreRaw,
          partnerB: bScoreRaw,
          match: matchPercent,
          flag: item.flag ?? '',
        };
      });

      const sectionLabel = index === 0
        ? (category.category || category.name)
        : `${category.category || category.name} (cont.)`;

      const endY = renderCategorySection(
        doc,
        sectionLabel,
        formatted,
        layout,
        y,
        sectionStyle
      );

      y = endY + sectionStyle.paddingBottom + 8;
      index += formatted.length;
    }

    if (rawItems.length === 0) {
      const endY = renderCategorySection(
        doc,
        category.category || category.name,
        [],
        layout,
        y,
        sectionStyle
      );
      y = endY + sectionStyle.paddingBottom + 8;
    }
  }

  if (save !== false) {
    downloadCompatibilityPDF(doc, filename);
  }

  return doc;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');

    if (!downloadBtn) {
      console.error('[compat] Download button not found (#downloadBtn) — PDF export disabled.');
      return;
    }

    console.info('[compat] Download button found (#downloadBtn). PDF export enabled.');
  });
}

export async function generateCompatibilityPDFLandscape(data) {
  const categories = Array.isArray(data) ? data : data?.categories || [];
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const getPageMetrics = () => ({
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight()
  });
  const drawBackground = () => {
    const { width, height } = getPageMetrics();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, height, 'F');
    doc.setTextColor(255, 255, 255);
  };
  const { width: pageWidth, height: pageHeight } = getPageMetrics();
  const margin = 15;

  drawBackground();

  let y = 20;

  drawTitle(doc, pageWidth);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kink', margin, y);
  doc.text('Combined Score', pageWidth - margin, y, { align: 'right' });
  y += 6;

  const allItems = categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.a ?? kink.partnerA, kink.b ?? kink.partnerB);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(kink.label || kink.kink, margin, y, { maxWidth: pageWidth - margin * 2 - 30 });
    doc.text(score, pageWidth - margin, y, { align: 'right' });
    y += 6;
    if (y > pageHeight - 20) {
      doc.addPage();
      drawBackground();
      y = 20;
    }
  });

  await doc.save('compatibility_report_landscape.pdf');
}

function drawTitle(doc, pageWidth) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
}

function combinedScore(a, b) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  if (aNum === null && bNum === null) return '-';
  if (aNum === null) return String(bNum);
  if (bNum === null) return String(aNum);
  const avg = (aNum + bNum) / 2;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}
