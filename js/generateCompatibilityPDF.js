import { ensureJsPDF } from './loadJsPDF.js';
import { shortenLabel as baseShortenLabel } from './labelShortener.js';
import { PDF_FONT_FAMILY, registerPdfFonts } from './helpers/pdfFonts.js';

const replacementLabels = {
  'Assigning corner time or time-outs': 'Corner time',
  'Attitude toward funishment vs serious correction': 'Funishment vs correction',
  'Being placed in the corner or given a time-out': 'Receiving time-out',
  'Getting scolded or lectured for correction': 'Receiving scolding',
  'Having privileges revoked (phone, TV)': 'Privileges revoked',
  'Lecturing or scolding to modify behavior': 'Giving scolding',
  'Playful punishments that still reinforce rules': 'Playful rule-punishment',
  'Preferred style of discipline (strict vs lenient)': 'Discipline style',
};

function shortenLabel(label) {
  const mapped = replacementLabels[label];
  const shortened = baseShortenLabel(mapped ?? label ?? '');
  return shortened || '—';
}

function flagStatus(a, b, match) {
  const pct = Number(match);
  if (!Number.isFinite(pct)) return '';
  if (pct >= 90) return '⭐';
  if (pct <= 30) return '🚩';
  const oneIsFive = a === 5 || b === 5;
  if (oneIsFive && Math.abs((a ?? 0) - (b ?? 0)) >= 1) return '🟨';
  return '';
}

function drawCenteredBar(doc, cell, match) {
  const { x, y, width, height } = cell;
  const barWidth = width * 0.9;
  const centerX = x + (width - barWidth) / 2;
  const centerY = y + height / 4;

  doc.setFillColor(30, 30, 30);
  doc.rect(centerX, centerY, barWidth, 6, 'F');

  if (match !== null && match !== undefined) {
    if (match === 'N/A') {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.text('N/A', x + width / 2, centerY + 4, { align: 'center' });
      return;
    }

    const fill = parseInt(match, 10);
    let fillColor = [0, 255, 0];
    if (fill < 80) fillColor = [255, 215, 0];
    if (fill < 60) fillColor = [255, 80, 80];

    doc.setFillColor(...fillColor);
    doc.rect(centerX, centerY, (barWidth * fill) / 100, 6, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text(`${fill}%`, x + width / 2, centerY + 4, { align: 'center' });
  }
}

function ensureAutoTable(doc, ctor) {
  if (doc && typeof doc.autoTable === 'function') return;

  const api = ctor?.API || globalThis?.jspdf?.jsPDF?.API || globalThis?.jsPDF?.API;
  if (api && typeof api.autoTable === 'function') {
    doc.autoTable = function autoTableProxy() {
      return api.autoTable.apply(this, arguments);
    };
    return;
  }
  throw new Error('jsPDF autoTable plugin not available');
}

function normalizeScore(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeMatch(matchValue, aScore, bScore) {
  if (matchValue === undefined) {
    if (aScore == null || bScore == null) return 'N/A';
    const pct = Math.max(0, Math.min(100, Math.round(100 - Math.abs(aScore - bScore) * 20)));
    return pct;
  }
  if (matchValue === null) return 'N/A';
  if (typeof matchValue === 'string' && matchValue.trim().toUpperCase() === 'N/A') return 'N/A';
  const num = Number(matchValue);
  return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 'N/A';
}

function normalizeResponses(data) {
  const fromResponses = Array.isArray(data?.responses) ? data.responses : null;
  const fromCategories = Array.isArray(data?.categories)
    ? data.categories.flatMap((category) => category.items || [])
    : null;
  const rows = fromResponses || fromCategories || (Array.isArray(data) ? data : []);

  return rows.map((row) => {
    const aScore = normalizeScore(
      row?.a ?? row?.partnerA ?? row?.scoreA ?? row?.partnerScoreA,
    );
    const bScore = normalizeScore(
      row?.b ?? row?.partnerB ?? row?.scoreB ?? row?.partnerScoreB,
    );
    const match = normalizeMatch(
      row?.match ?? row?.matchPercent ?? row?.matchPct,
      aScore,
      bScore,
    );
    return {
      kink: shortenLabel(row?.kink ?? row?.label ?? row?.name ?? row?.item ?? ''),
      a: aScore ?? '—',
      b: bScore ?? '—',
      matchBar: match,
      flag: flagStatus(aScore, bScore, match),
    };
  });
}

export async function generateCompatibilityPDF(data = {}, options = {}) {
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor();
  await registerPdfFonts(doc);
  ensureAutoTable(doc, jsPDFCtor);

  const useHeaderFont = () => doc.setFont(PDF_FONT_FAMILY, 'bold');
  const useBodyFont = () => doc.setFont(PDF_FONT_FAMILY, 'normal');

  const pageWidth = doc.internal?.pageSize?.getWidth?.() ?? 210;
  const headerTitle = data.title || options.title || 'TalkKink Compatibility Summary';
  const generatedAt =
    data.generatedAt || options.generatedAt || options.generatedTime || new Date().toLocaleString();
  const sectionTitle = data.sectionTitle || options.sectionTitle || 'Compatibility Results';

  useHeaderFont();
  doc.setFontSize(24);
  doc.setTextColor(0, 255, 255);
  const titleY = 20;
  doc.text(headerTitle, pageWidth / 2, titleY, { align: 'center' });

  useBodyFont();
  doc.setFontSize(12);
  doc.setTextColor(200);
  const timestampY = 27;
  doc.text(`Generated: ${generatedAt}`, pageWidth / 2, timestampY, { align: 'center' });

  doc.setDrawColor(0, 255, 255);
  const dividerY = 32;
  doc.line(20, dividerY, pageWidth - 20, dividerY);

  useHeaderFont();
  doc.setFontSize(20);
  doc.setTextColor(0, 255, 255);
  doc.text(sectionTitle, pageWidth / 2, dividerY + 10, { align: 'center' });

  const columns = [
    { header: 'Kinks', dataKey: 'kink' },
    { header: 'Partner A', dataKey: 'a', styles: { halign: 'center' } },
    { header: '', dataKey: 'flag', styles: { halign: 'center' } },
    { header: 'Partner B', dataKey: 'b', styles: { halign: 'center' } },
    { header: 'Match', dataKey: 'matchBar' },
  ];

  const rows = normalizeResponses(data);

  doc.autoTable({
    startY: 48,
    columns,
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => row[col.dataKey])),
    didDrawCell: (ctx) => {
      const column = columns[ctx.column.index];
      if (column?.dataKey === 'matchBar') {
        drawCenteredBar(doc, ctx.cell, ctx.cell.raw ?? rows[ctx.row.index]?.matchBar);
      }
    },
    styles: {
      font: PDF_FONT_FAMILY,
      fontSize: 8,
      cellPadding: 2,
      valign: 'middle',
      textColor: 255,
      fontStyle: 'normal',
    },
    headStyles: {
      fillColor: [0, 255, 255],
      textColor: 0,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [30, 30, 30] },
    bodyStyles: { halign: 'left' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 70 },
    },
    theme: 'grid',
  });

  if (options.save !== false && typeof doc.save === 'function') {
    const filename = options.filename || 'compatibility.pdf';
    doc.save(filename);
  }

  return doc;
}

export default generateCompatibilityPDF;
