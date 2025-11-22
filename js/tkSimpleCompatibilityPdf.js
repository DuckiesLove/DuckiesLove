import { ensureJsPDF } from './loadJsPDF.js';
import { PDF_FONT_FAMILY, registerPdfFonts } from './helpers/pdfFonts.js';

function formatScore(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
}

function clampPercent(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
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
    return item.matchText.trim();
  }
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

      return [
        kink ? String(kink) : '',
        formatScore(partnerA),
        formatMatchCell(item),
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
  throw new Error('jsPDF autoTable plugin not available');
}

export async function generateCompatibilityPDF(data = [], options = {}) {
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor('p', 'pt', 'a4');
  await registerPdfFonts(doc);
  ensureAutoTable(doc, jsPDFCtor);

  const useHeaderFont = () => doc.setFont(PDF_FONT_FAMILY, 'bold');
  const useBodyFont = () => doc.setFont(PDF_FONT_FAMILY, 'normal');

  const marginX = options.marginX ?? 40;
  let cursorY = options.marginY ?? 40;

  useHeaderFont();
  doc.setFontSize(28);
  doc.setTextColor(0, 255, 255);
  doc.text('TalkKink Compatibility Survey', marginX, cursorY);
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
  const body = rows.length ? rows : [['', '', '', '']];

  doc.autoTable({
    head: [['Kinks', 'Partner A', 'Match %', 'Partner B']],
    body,
    startY: cursorY + 10,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      font: PDF_FONT_FAMILY,
      fontSize: 11,
      textColor: [255, 255, 255],
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [0, 255, 255],
      fontSize: 13,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [26, 26, 26],
    },
    tableLineColor: [0, 255, 255],
    tableLineWidth: 0.75,
  });

  if (options.save !== false && typeof doc.save === 'function') {
    const filename = options.filename || 'talkkink_compatibility_survey.pdf';
    doc.save(filename);
  }

  return doc;
}

export default generateCompatibilityPDF;
