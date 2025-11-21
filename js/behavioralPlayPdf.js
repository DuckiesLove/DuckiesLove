import { ensureJsPDF } from './loadJsPDF.js';

const THEME_PRESETS = {
  dark: {
    titleFont: 'helvetica',
    titleSize: 22,
    subTitleSize: 16,
    textColor: '#00F0FF',
    lineColor: '#00F0FF',
    tableHeaderColor: '#00F0FF',
    tableTextColor: '#FFFFFF',
    backgroundColor: '#000000',
    matchColor: '#00F0FF',
  },
};

function clampPercent(value) {
  if (value == null) return '0%';
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return `${bounded}%`;
}

function computeMatch(a, b) {
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return '0%';
  const diff = Math.abs(Number(a) - Number(b));
  const pct = 100 - diff * 20;
  return clampPercent(pct);
}

function normalizeRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((row = {}) => {
    const partnerA = row.a ?? row.partnerA ?? row.scoreA ?? row.self ?? row.valueA;
    const partnerB = row.b ?? row.partnerB ?? row.scoreB ?? row.partner ?? row.valueB;
    return [
      row.kink || row.label || row.name || '',
      partnerA != null ? String(partnerA) : '',
      computeMatch(partnerA, partnerB),
      partnerB != null ? String(partnerB) : '',
    ];
  });
}

function ensureAutoTable(doc, ctor) {
  if (typeof doc.autoTable === 'function') return;
  const api = ctor?.API || globalThis?.jspdf?.jsPDF?.API || globalThis?.jsPDF?.API;
  if (api && typeof api.autoTable === 'function') {
    doc.autoTable = function autoTableProxy() {
      return api.autoTable.apply(this, arguments);
    };
    return;
  }
  throw new Error('jsPDF autoTable plugin not available');
}

export async function generateBehavioralPlayPDF(data = [], theme = 'dark', options = {}) {
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  ensureAutoTable(doc, jsPDFCtor);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const styles = { ...THEME_PRESETS[theme] };
  const marginX = options.marginX ?? 32;

  doc.setFillColor(styles.backgroundColor);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont(styles.titleFont, 'bold');
  doc.setFontSize(styles.titleSize);
  doc.setTextColor(styles.textColor);
  doc.text('TalkKink Compatibility Survey', pageWidth / 2, 32, { align: 'center' });

  const timestamp = options.timestamp || new Date().toLocaleString();
  doc.setFontSize(10);
  doc.text(`Generated: ${timestamp}`, pageWidth / 2, 44, { align: 'center' });

  doc.setFontSize(styles.subTitleSize);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(styles.textColor);
  doc.text('Behavioral Play', pageWidth / 2, 66, { align: 'center' });

  doc.setDrawColor(styles.lineColor);
  doc.setLineWidth(1);
  doc.line(marginX, 72, pageWidth - marginX, 72);

  const columns = ['Kinks', 'Partner A', 'Match', 'Partner B'];
  const rows = normalizeRows(data);

  doc.autoTable({
    startY: 84,
    head: [columns],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: styles.tableTextColor,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    headStyles: {
      fillColor: '#111111',
      textColor: styles.tableHeaderColor,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: '#111111' },
    tableLineColor: styles.lineColor,
    tableLineWidth: 0.1,
    columnStyles: {
      0: { halign: 'left', cellWidth: 260 },
      1: { cellWidth: 80 },
      2: { cellWidth: 70, textColor: styles.matchColor },
      3: { cellWidth: 80 },
    },
  });

  if (options.save !== false) {
    doc.save(options.filename || 'TalkKink_Compatibility_Survey.pdf');
  }

  return doc;
}

export default generateBehavioralPlayPDF;
