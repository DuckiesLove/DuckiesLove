import { ensureJsPDF } from '../loadJsPDF.js';
import { PDF_FONT_FAMILY, registerPdfFonts } from './pdfFonts.js';

function shortenLabel(label) {
  if (!label) return '';
  return String(label)
    .replace(/^Giving:\s*/, 'G:')
    .replace(/^Receiving:\s*/, 'R:')
    .replace(/\(.*?\)/g, '')
    .trim()
    .slice(0, 35);
}

function formatScore(score) {
  return typeof score === 'number' ? score : '—';
}

function calculateMatch(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  const diff = Math.abs(a - b);
  return Math.max(0, 100 - diff * 20);
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

export async function generateCompactCompatibilityPDF(partnerAData = {}, partnerBData = {}, options = {}) {
  const jsPDFCtor = options.doc ? options.jsPDF : options.jsPDF || (await ensureJsPDF());
  const doc = options.doc || new jsPDFCtor();
  ensureAutoTable(doc, jsPDFCtor);
  await registerPdfFonts(doc);

  const allItems = Object.keys(partnerAData || {});
  const compared = allItems
    .filter((key) => Object.prototype.hasOwnProperty.call(partnerBData || {}, key))
    .map((key) => {
      const aScore = partnerAData[key];
      const bScore = partnerBData[key];
      const matchValue = calculateMatch(aScore, bScore);

      return {
        label: shortenLabel(key),
        aScore: formatScore(aScore),
        bScore: formatScore(bScore),
        match: matchValue === null ? 'N/A' : `${matchValue}%`,
        matchValue,
      };
    });

  const validMatches = compared.filter((item) => typeof item.matchValue === 'number');
  const avgMatch = validMatches.length
    ? Math.round(validMatches.reduce((acc, item) => acc + item.matchValue, 0) / validMatches.length)
    : null;
  const strongAlignments = validMatches.filter((item) => item.matchValue >= 80).length;

  doc.setTextColor(0, 255, 255);
  doc.setFontSize(24);
  doc.setFont(PDF_FONT_FAMILY, 'bold');
  doc.text('TalkKink Compatibility', 20, 20);

  doc.setFontSize(10);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
  doc.text(`Generated ${new Date().toLocaleString()}`, 20, 28);

  const boxY = 35;
  const boxHeight = 20;
  const boxWidth = 60;

  const drawBox = (x, label, value) => {
    doc.setDrawColor(0, 255, 255);
    doc.setFillColor(10, 25, 35);
    doc.rect(x, boxY, boxWidth, boxHeight, 'F');
    doc.setTextColor(0, 255, 255);
    doc.setFontSize(14);
    doc.text(String(value), x + 5, boxY + 10);
    doc.setTextColor(200);
    doc.setFontSize(10);
    doc.text(label, x + 5, boxY + 18);
  };

  drawBox(20, 'Items Compared', compared.length);
  drawBox(90, 'Avg Match', avgMatch === null ? 'N/A' : `${avgMatch}%`);
  drawBox(160, '80%+ Alignments', strongAlignments);

  const rows = compared.map((item) => [item.label, item.aScore, item.match, item.bScore]);

  doc.autoTable({
    startY: boxY + boxHeight + 10,
    head: [['Item', 'Partner A', 'Match', 'Partner B']],
    body: rows,
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
    },
    headStyles: {
      fillColor: [0, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: [255, 255, 255],
      fontSize: 10,
    },
    styles: {
      fillColor: [10, 10, 20],
      font: PDF_FONT_FAMILY,
    },
    theme: 'grid',
  });

  if (options.save !== false && typeof doc.save === 'function') {
    doc.save(options.filename || 'talkkink_compatibility.pdf');
  }

  return doc;
}

export default generateCompactCompatibilityPDF;
