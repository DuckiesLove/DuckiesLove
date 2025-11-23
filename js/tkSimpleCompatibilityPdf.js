import { ensureJsPDF } from './loadJsPDF.js';
import { PDF_FONT_FAMILY, registerPdfFonts } from './helpers/pdfFonts.js';

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text || text === '&&&' || text.toLowerCase() === 'n/a') return '';
  return text;
}

function formatScore(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const cleaned = sanitizeText(value);
    if (!cleaned) return 'N/A';
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric.toString() : cleaned;
  }
  return 'N/A';
}

function clampPercent(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseMatchText(matchString) {
  const cleaned = sanitizeText(matchString);
  if (!cleaned) return '';

  if (!cleaned.includes('&&&')) return cleaned;

  const [percent = ''] = cleaned.split('&&&').map((s) => s.trim()).filter(Boolean);
  if (!percent) return '';

  const value = parseInt(percent, 10);

  let emoji = '';
  if (value >= 90) emoji = '⭐';
  else if (value <= 30) emoji = '🚩';
  else emoji = '🟩';

  return `${percent} ${emoji}`;
}

function formatMatchCell(item) {
  const directPct = clampPercent(
    item.matchPercent ?? item.matchPct ?? item.match,
  );
  if (directPct !== null) {
    const star = directPct >= 90 ? ' ⭐' : '';
    return `${directPct}%${star}`;
  }
  if (typeof item.matchText === 'string' && item.matchText.trim()) {
    return parseMatchText(item.matchText.trim()) || 'N/A';
  }
  return 'N/A';
}

function computeFlagSymbol(matchValue) {
  if (!Number.isFinite(matchValue)) return '';
  if (matchValue >= 90) return '⭐';
  if (matchValue <= 30) return '🚩';
  return '';
}

function normalizeRows(data = []) {
  return data
    .map((item) => {
      if (!item) return null;
      const kink =
        item.kink || item.label || item.name || item.item || '';
      const partnerA =
        item.partnerA ?? item.partnerScoreA ?? item.a ?? item.scoreA;
      const partnerB =
        item.partnerB ?? item.partnerScoreB ?? item.b ?? item.scoreB;

      const matchPercent = clampPercent(
        item.matchPercent ?? item.matchPct ?? item.match,
      );

      return [
        kink ? String(kink).trim() : '',
        formatScore(partnerA),
        formatMatchCell({ ...item, matchPercent }),
        computeFlagSymbol(matchPercent),
        formatScore(partnerB),
      ];
    })
    .filter(Boolean);
}

function ensureAutoTable(doc, ctor) {
  if (doc && typeof doc.autoTable === 'function') {
    return;
  }
  const api = ctor?.API || globalThis?.jspdf?.jsPDF?.API || globalThis?.jsPDF?.API;
  if (api && typeof api.autoTable === 'function') {
    doc.autoTable = function autoTableProxy() {
      return api.autoTable.apply(this, arguments);
    };
    return;
  }
  if (typeof globalThis.__tkAutoTableFallback === 'function') {
    doc.autoTable = function autoTableFallbackProxy() {
      return globalThis.__tkAutoTableFallback.apply(this, arguments);
    };
    if (ctor) {
      ctor.API = ctor.API || {};
      ctor.API.autoTable = ctor.API.autoTable || globalThis.__tkAutoTableFallback;
    }
    return;
  }
  throw new Error('jsPDF autoTable plugin not available');
}

export async function generateCompatibilityPDF(data = [], options = {}) {
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor('p', 'pt', 'a4');
  await registerPdfFonts(doc);
  ensureAutoTable(doc, jsPDFCtor);

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const useHeaderFont = () => {
    if (typeof doc.setFont === 'function') doc.setFont(PDF_FONT_FAMILY, 'bold');
  };
  const useBodyFont = () => {
    if (typeof doc.setFont === 'function') doc.setFont(PDF_FONT_FAMILY, 'normal');
  };

  const marginX = options.marginX ?? 40;
  let cursorY = options.marginY ?? 40;

  useHeaderFont();
  doc.setFontSize(28);
  doc.setTextColor(0, 255, 255);
  doc.text('TalkKink Compatibility Survey', centerX, cursorY, {
    align: 'center',
  });
  cursorY += 20;

  const timestamp =
    options.generatedAt || `Generated: ${new Date().toLocaleString()}`;
  useBodyFont();
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(timestamp, marginX, cursorY);
  cursorY += 30;

  const sectionTitle = options.sectionTitle || 'Compatibility Survey';
  useHeaderFont();
  doc.setFontSize(20);
  doc.setTextColor(0, 255, 255);
  doc.text(sectionTitle, marginX, cursorY);

  const rows = normalizeRows(Array.isArray(data) ? data : []);
  const body = rows.length ? rows : [['', 'N/A', 'N/A', '', 'N/A']];

  doc.autoTable({
    head: [['Kinks', 'Partner A', 'Match', 'Flag', 'Partner B']],
    body,
    startY: cursorY + 10,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      font: PDF_FONT_FAMILY,
      fontSize: 10,
      textColor: '#FFFFFF',
      cellPadding: 4,
      halign: 'center',
      overflow: 'linebreak',
      charSpace: 0,
    },
    headStyles: {
      fillColor: '#003b4c',
      textColor: '#00e0ff',
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      font: PDF_FONT_FAMILY,
      fontSize: 10,
      lineColor: '#198ca5',
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: null,
    },
    tableLineColor: '#198ca5',
    tableLineWidth: 0.2,
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (!data?.cell?.styles) return;
      data.cell.styles.fontSize = 10;
      data.cell.styles.cellPadding = 4;
      data.cell.styles.overflow = 'linebreak';
    },
  });

  if (options.save !== false && typeof doc.save === 'function') {
    const filename = options.filename || 'talkkink_compatibility_survey.pdf';
    doc.save(filename);
  }

  return doc;
}

export default generateCompatibilityPDF;
