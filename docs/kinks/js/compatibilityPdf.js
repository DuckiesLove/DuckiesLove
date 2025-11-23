import * as helperModule from './compatibilityReportHelpers.js';
import { shortenLabel } from './labelShortener.js';
import { ensureJsPDF } from './loadJsPDF.js';
const DEBUG = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

const DEFAULT_FONT_SETTINGS = {
  base: { family: 'helvetica', style: 'normal' },
  roles: {
    title: { size: 18, style: 'bold' },
    landscapeTitle: { size: 16, style: 'bold' },
    table: { size: 10, style: 'normal' },
    landscapeHeader: { size: 10, style: 'bold' },
    landscapeBody: { size: 10, style: 'normal' },
  },
};

let sharedFontOverrides = null;

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const deepMerge = (target, ...sources) => {
  const output = isPlainObject(target) ? { ...target } : target;
  sources.filter(Boolean).forEach((source) => {
    if (!isPlainObject(source)) {
      return;
    }
    Object.entries(source).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        output[key] = value.slice();
      } else if (isPlainObject(value)) {
        output[key] = deepMerge(isPlainObject(output[key]) ? output[key] : {}, value);
      } else if (value !== undefined) {
        output[key] = value;
      }
    });
  });
  return output;
};

const clampScore = (value) => Math.min(5, Math.max(0, value));

const cleanPdfScore = (score) => {
  if (score === null || score === undefined) return null;
  if (typeof score === 'string') {
    const trimmed = score.trim();
    if (!trimmed) return null;
    if (trimmed.includes('&')) return 'N/A';
    if (trimmed.toUpperCase() === 'N/A') return 'N/A';
    const num = Number(trimmed);
    return Number.isNaN(num) ? 'N/A' : clampScore(num);
  }
  if (typeof score === 'number' && Number.isFinite(score)) {
    return clampScore(score);
  }
  return 'N/A';
};

const sanitizeCompatibilityData = (data) => {
  const categories = Array.isArray(data?.categories)
    ? data.categories.map((category) => {
        const items = Array.isArray(category.items)
          ? category.items.map((item) => {
              const aScore = cleanPdfScore(item.a ?? item.partnerA ?? item.scoreA);
              const bScore = cleanPdfScore(item.b ?? item.partnerB ?? item.scoreB);
              return {
                ...item,
                a: aScore,
                partnerA: aScore,
                scoreA: aScore,
                b: bScore,
                partnerB: bScore,
                scoreB: bScore,
              };
            })
          : [];
        return { ...category, items };
      })
    : [];

  return {
    categories,
    history: Array.isArray(data?.history) ? data.history : [],
  };
};

const normalizeFontInput = (input) => {
  if (!input) return null;
  if (typeof input === 'string') {
    return { base: { family: input } };
  }
  if (isPlainObject(input)) {
    const cloned = deepMerge({}, input);
    if (typeof cloned.base === 'string') {
      cloned.base = { family: cloned.base };
    }
    return cloned;
  }
  return null;
};

const resolveFontSettings = (localOverride) => {
  const globalConfig = typeof window !== 'undefined' ? normalizeFontInput(window.compatibilityPdfFontSettings) : null;
  const localConfig = normalizeFontInput(localOverride);
  return deepMerge({}, DEFAULT_FONT_SETTINGS, sharedFontOverrides, globalConfig, localConfig);
};

const collectFontFiles = (config = {}) => {
  const files = [];
  const pushFiles = (candidate) => {
    if (!candidate) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(pushFiles);
      return;
    }
    if (isPlainObject(candidate)) {
      files.push(candidate);
    }
  };
  pushFiles(config.files);
  pushFiles(config.base?.files);
  if (config.roles) {
    Object.values(config.roles).forEach((role) => pushFiles(role?.files));
  }
  return files.filter((entry) => entry && entry.family && entry.data);
};

const registerFontSources = (doc, config) => {
  if (!doc || typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
    return;
  }
  const fonts = collectFontFiles(config);
  if (!fonts.length) return;
  if (!doc.__compatPdfFontCache) {
    Object.defineProperty(doc, '__compatPdfFontCache', {
      value: new Set(),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  fonts.forEach((font) => {
    const style = font.style || 'normal';
    const cacheKey = `${font.family}|${style}`;
    if (doc.__compatPdfFontCache.has(cacheKey)) return;
    const fileName = font.fileName || `${font.family}-${style}.ttf`;
    if (!font.data) {
      if (DEBUG) {
        console.warn('[compat-pdf] Skipping font registration: missing data for', font.family);
      }
      return;
    }
    try {
      doc.addFileToVFS(fileName, font.data);
      doc.addFont(fileName, font.family, style);
      doc.__compatPdfFontCache.add(cacheKey);
    } catch (error) {
      if (DEBUG) {
        console.warn('[compat-pdf] Failed to register font', font.family, error);
      }
    }
  });
};

const applyFontRole = (doc, config, role) => {
  if (!doc) return null;
  const base = config?.base || {};
  const roleConfig = (role && config?.roles?.[role]) ? config.roles[role] : {};
  const resolved = deepMerge({}, base, roleConfig);
  const family = resolved.family || base.family;
  const style = resolved.style || base.style || 'normal';
  if (family && typeof doc.setFont === 'function') {
    let applied = false;
    try {
      doc.setFont(family, style);
      applied = true;
    } catch (error) {
      if (DEBUG) {
        console.warn('[compat-pdf] Failed to apply font', family, error);
      }
    }
    if (!applied && family !== 'helvetica') {
      try {
        doc.setFont('helvetica', style);
        resolved.family = 'helvetica';
      } catch (_) {
        // Ignore if jsPDF rejects the fallback as well
      }
    }
  }
  if (typeof resolved.size === 'number' && typeof doc.setFontSize === 'function') {
    doc.setFontSize(resolved.size);
  }
  return resolved;
};

export function setCompatibilityPdfFontSettings(overrides) {
  if (overrides == null) {
    sharedFontOverrides = null;
    if (typeof window !== 'undefined' && window.compatibilityPdfFontSettings) {
      delete window.compatibilityPdfFontSettings;
    }
    return null;
  }
  const normalized = normalizeFontInput(overrides) || {};
  sharedFontOverrides = deepMerge({}, sharedFontOverrides, normalized);
  if (typeof window !== 'undefined') {
    window.compatibilityPdfFontSettings = deepMerge({}, window.compatibilityPdfFontSettings || {}, normalized);
  }
  return sharedFontOverrides;
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

const coerceScore = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const pickScore = (...candidates) => {
  for (const candidate of candidates) {
    const coerced = coerceScore(candidate);
    if (coerced !== null) return coerced;
  }
  return null;
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
    const partnerWidth = Math.max(remaining * 0.32, 40);
    const matchWidth = Math.max(remaining - partnerWidth * 2, 40);

    const colLabel = startX;
    const colAStart = colLabel + labelWidth;
    const colACenter = colAStart + partnerWidth / 2;
    const colBarStart = colAStart + partnerWidth;
    const colBarCenter = colBarStart + matchWidth / 2;
    const colBStart = colBarStart + matchWidth;
    const colBCenter = colBStart + partnerWidth / 2;

    return {
      startX,
      width,
      colLabel,
      colA: colACenter,
      colBar: colBarCenter,
      colB: colBCenter,
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
    const rowSeparatorInset = 2;
    doc.setFontSize(10);
    doc.text('Kinks', layout.colLabel, currentY);
    doc.text('Partner A', layout.colA, currentY, { align: 'center' });
    doc.text('Match %', layout.colBar, currentY, { align: 'center' });
    doc.text('Partner B', layout.colB, currentY, { align: 'center' });

    currentY += layout.columnHeaderGap;
    const labelWidth = layout.labelWidth || 60;

    items.forEach((item) => {
      doc.setFontSize(10);
      const lines = typeof doc.splitTextToSize === 'function'
        ? doc.splitTextToSize(item.label || '', labelWidth)
        : [item.label || ''];
      doc.text(lines, layout.colLabel, currentY);

      doc.text(formatScore(item.partnerA), layout.colA, currentY, { align: 'center' });
      const match = item.match ?? getMatchPercentage(item.partnerA, item.partnerB);
      const matchLabel = match == null
        ? 'N/A'
        : `${match}%${match >= 85 ? ' ⭐' : match <= 30 ? ' 🚩' : ''}`;
      doc.text(matchLabel, layout.colBar, currentY, { align: 'center' });
      doc.text(formatScore(item.partnerB), layout.colB, currentY, { align: 'center' });
      if (borderWidth > 0 && typeof doc.line === 'function') {
        doc.setDrawColor(...toColorArray(borderColor));
        doc.setLineWidth(Math.max(0.2, borderWidth / 2));
        doc.line(
          layout.startX + rowSeparatorInset,
          currentY + layout.rowHeight,
          layout.startX + layout.width - rowSeparatorInset,
          currentY + layout.rowHeight,
        );
        doc.setLineWidth(0);
      }
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

export async function generateCompatibilityPDF(data = { categories: [] }, options = {}) {
  if (DEBUG) {
    console.log('PDF function triggered');
  }

  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor({ orientation: 'landscape' });
  doc.setFontSize(10);

  const {
    filename = 'compatibility_report.pdf',
    save = true,
    saveHook = null,
    fontSettings: fontSettingsOverride = null,
    font = null,
    fontFamily = null,
  } = options || {};

  const fontSettings = resolveFontSettings(fontSettingsOverride || font || fontFamily);
  registerFontSources(doc, fontSettings);

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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(255, 255, 255);
  };

  const sanitized = sanitizeCompatibilityData(Array.isArray(data) ? { categories: data } : data || {});
  const categories = sanitized.categories;
  if (categories.length === 0) {
    console.warn('generateCompatibilityPDF called without data');
  }
  let y = 20;

  drawBackground();
  applyFontRole(doc, fontSettings, 'title');
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
        const aScoreRaw = pickScore(item.a, item.partnerA, item.scoreA);
        const bScoreRaw = pickScore(item.b, item.partnerB, item.scoreB);

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
        };
      });

      const sectionLabel = index === 0
        ? (category.category || category.name)
        : `${category.category || category.name} (cont.)`;

      applyFontRole(doc, fontSettings, 'table');
      doc.setFontSize(10);
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
      applyFontRole(doc, fontSettings, 'table');
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
    if (typeof saveHook === 'function') {
      await saveHook(doc, filename);
    } else if (typeof doc.save === 'function') {
      await doc.save(filename);
    }
  }

  return doc;
}

if (typeof document !== 'undefined') {
  const attachHandler = () => {
    const button = document.getElementById('downloadPdfBtn');
    if (button) {
      button.addEventListener('click', async () => {
        try {
          if (typeof window.showSpinner === 'function') window.showSpinner();
          await generateCompatibilityPDF(window.compatibilityData);
        } finally {
          if (typeof window.hideSpinner === 'function') window.hideSpinner();
        }
      });
    } else {
      console.error('Download button not found');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandler);
  } else {
    // DOM already parsed when script loaded
    attachHandler();
  }
}

export async function generateCompatibilityPDFLandscape(data, options = {}) {
  const sanitized = sanitizeCompatibilityData(Array.isArray(data) ? { categories: data } : data || {});
  const categories = sanitized.categories;
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(10);
  const fontSettings = resolveFontSettings(options.fontSettings || options.font || options.fontFamily);
  registerFontSources(doc, fontSettings);
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

  drawTitle(doc, pageWidth, fontSettings);
  y += 15;

  applyFontRole(doc, fontSettings, 'landscapeHeader');
  doc.text('Kink', margin, y);
  doc.text('Combined Score', pageWidth - margin, y, { align: 'right' });
  y += 6;

  const allItems = categories.flatMap(cat => cat.items);
  allItems.forEach(kink => {
    const score = combinedScore(kink.a ?? kink.partnerA, kink.b ?? kink.partnerB);
    applyFontRole(doc, fontSettings, 'landscapeBody');
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

function drawTitle(doc, pageWidth, fontSettings) {
  applyFontRole(doc, fontSettings, 'landscapeTitle');
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
}

function combinedScore(a, b) {
  const aNum = coerceScore(a);
  const bNum = coerceScore(b);
  if (aNum === null && bNum === null) return '-';
  if (aNum === null) return String(bNum);
  if (bNum === null) return String(aNum);
  const avg = (aNum + bNum) / 2;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}
