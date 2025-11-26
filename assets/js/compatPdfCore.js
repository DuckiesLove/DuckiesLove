import { jsPDF } from './vendor/jspdf.umd.min.js';
import './vendor/jspdf.plugin.autotable.min.js';

function buildPartnerMap(partner = {}) {
  const answers = Array.isArray(partner.answers) ? partner.answers : [];
  return answers.reduce((map, item) => {
    const key = `${item.category ?? ''}-${item.label ?? ''}`;
    map[key] = item.value;
    return map;
  }, {});
}

function normalizeValue(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function collectMatches(self = {}, partner = {}) {
  const answers = Array.isArray(self.answers) ? self.answers : [];
  const partnerMap = buildPartnerMap(partner);

  return answers
    .map((item) => {
      const key = `${item.category ?? ''}-${item.label ?? ''}`;
      const partnerVal = partnerMap[key];

      if (partnerVal === undefined || item.value === undefined) return null;

      const aVal = normalizeValue(item.value);
      const bVal = normalizeValue(partnerVal);
      if (aVal === undefined || bVal === undefined) return null;

      const match = aVal === bVal ? 100 : 0;
      return {
        label: item.label ?? '',
        category: item.category ?? '',
        a: aVal,
        b: bVal,
        match,
      };
    })
    .filter(Boolean);
}

function dedupeItems(items = []) {
  const seen = new Set();
  return items.filter(({ label, category }) => {
    const key = `${category}-${label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeMatches(items) {
  if (!items.length) {
    return { avgMatch: 0, alignments: 0 };
  }

  const total = items.reduce((sum, item) => sum + item.match, 0);
  const avgMatch = Math.round(total / items.length);
  const alignments = items.filter((item) => item.match >= 80).length;
  return { avgMatch, alignments };
}

function drawSummaryCards(doc, pageWidth, summaryData) {
  const boxWidth = 50;
  const boxHeight = 25;
  const gap = 10;
  const totalWidth = summaryData.length * boxWidth + (summaryData.length - 1) * gap;
  const startX = (pageWidth - totalWidth) / 2;

  summaryData.forEach(({ label, value }, index) => {
    const x = startX + index * (boxWidth + gap);
    doc.setDrawColor(0, 255, 255);
    doc.setFillColor(18, 26, 38);
    doc.roundedRect(x, 35, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFontSize(14);
    doc.setTextColor(0, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), x + boxWidth / 2, 45, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + boxWidth / 2, 55, { align: 'center' });
  });
}

export function generateCompatibilityPDF(self, partner, meta = {}) {
  const matches = dedupeItems(collectMatches(self, partner));
  if (!matches.length) {
    alert('No compatibility data available. Upload both surveys first.');
    return;
  }

  const now = new Date();
  const timestamp = meta.timestamp || now.toLocaleString();
  const title = meta.title || 'TalkKink Compatibility';
  const { avgMatch, alignments } = summarizeMatches(matches);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${timestamp}`, pageWidth / 2, 28, { align: 'center' });

  const summaryData = [
    { label: 'Items Compared', value: matches.length },
    { label: 'Avg Match', value: `${avgMatch}%` },
    { label: '80%+ Alignments', value: alignments },
  ];

  drawSummaryCards(doc, pageWidth, summaryData);

  const tableRows = matches.map((row) => ({
    category: row.label,
    a: row.a ?? 'N/A',
    match: `${row.match}%`,
    b: row.b ?? 'N/A',
  }));

  doc.autoTable({
    startY: 70,
    head: [['Category', 'Partner A', 'Match', 'Partner B']],
    body: tableRows.map((row) => [row.category, row.a, row.match, row.b]),
    styles: {
      fontSize: 10,
      halign: 'center',
      cellPadding: 2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [0, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 70 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
    },
    tableLineColor: [0, 255, 255],
    margin: { left: (pageWidth - 160) / 2 },
  });

  doc.save('TalkKink_Compatibility.pdf');
}

export default generateCompatibilityPDF;
