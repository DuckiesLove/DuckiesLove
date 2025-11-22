import fs from 'fs';
import path from 'path';

const PAGE_WIDTH = 612; // 8.5in * 72
const PAGE_HEIGHT = 792; // 11in * 72

const OUTPUT_DIR = path.resolve('docs/compatibility-survey');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'talkkink-compatibility-survey.pdf');

const ACCENT = [0, 240 / 255, 1];
const BACKGROUND = [17 / 255, 17 / 255, 17 / 255];
const TEXT = [1, 1, 1];
const GRID = [51 / 255, 51 / 255, 51 / 255];

const escapeText = (text = '') =>
  String(text).replace(/([\\()\n\r])/g, (match) => ({
    '\\': '\\\\',
    '(': '\\(',
    ')': '\\)',
    '\n': '\\n',
    '\r': '',
  }[match]));

const setColor = ([r, g, b]) => `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;

const drawText = ({ text, x, y, size = 12, font = 'F1', color = TEXT }) => [
  'BT',
  `/${font} ${size} Tf`,
  setColor(color),
  `${x.toFixed(2)} ${y.toFixed(2)} Td`,
  `(${escapeText(text)}) Tj`,
  'ET',
];

const tableRows = [
  ['Kinks', 'Partner A', 'Match', 'Partner B'],
  ['Giving: Assigning corner time or time-outs', '0', '100%', '0'],
  ['General: Attitude toward funishment vs serious correction', '3', '100%', '3'],
  ['Receiving: Being placed in the corner or given a time-out', '5', '100%', '5'],
  ['Receiving: Getting scolded or lectured for correction', '5', '100%', '5'],
  ['Receiving: Having privileges revoked (phone, TV)', '3', '100%', '3'],
  ['Giving: Lecturing or scolding to modify behavior', '4', '100%', '4'],
  ['Giving: Playful punishments that still reinforce rules', '3', '100%', '3'],
  ['General: Preferred style of discipline (strict vs lenient)', '4', '100%', '4'],
];

const buildContentStream = () => {
  const parts = [];

  // Background fill
  parts.push(`${setColor(BACKGROUND)} 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);

  // Header
  parts.push(
    ...drawText({ text: 'TalkKink Compatibility Survey', x: PAGE_WIDTH / 2 - 170, y: 750, size: 22, font: 'F1', color: ACCENT }),
    ...drawText({ text: 'Generated: 11/19/2025, 1:08:06 AM', x: PAGE_WIDTH / 2 - 110, y: 732, size: 10, font: 'F1', color: ACCENT }),
    ...drawText({ text: 'Behavioral Play', x: PAGE_WIDTH / 2 - 70, y: 710, size: 16, font: 'F1', color: ACCENT }),
  );

  // Divider line using thin rectangles
  parts.push(`${setColor(ACCENT)} 32 700 ${PAGE_WIDTH - 64} 1 re f`);

  const startY = 675;
  const rowHeight = 20;
  const columns = [32, 320, 420, 500];

  tableRows.forEach((row, index) => {
    const y = startY - index * rowHeight;
    const isHeader = index === 0;
    const rowColor = isHeader ? ACCENT : TEXT;
    const gridColor = isHeader ? GRID : GRID;

    // Divider between rows
    if (index > 0) {
      parts.push(`${setColor(gridColor)} 32 ${y + 4} ${PAGE_WIDTH - 64} 0.5 re f`);
    }

    row.forEach((cell, colIdx) => {
      const x = columns[colIdx];
      parts.push(...drawText({
        text: cell,
        x,
        y,
        size: isHeader ? 11 : 10,
        font: 'F1',
        color: colIdx === 2 ? ACCENT : rowColor,
      }));
    });
  });

  const stream = parts.join('\n');
  const streamContent = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  return streamContent;
};

const buildPdf = () => {
  const objects = [];
  const contentStream = buildContentStream();

  // Content stream
  objects.push(contentStream);

  // Fonts
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // F1

  // Page object
  objects.push(
    `<< /Type /Page /Parent 4 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 2 0 R >> >> /Contents 1 0 R >>`,
  );

  // Pages
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');

  // Catalog
  objects.push('<< /Type /Catalog /Pages 4 0 R >>');

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  offsets.forEach((offset) => {
    body += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return body;
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const pdf = buildPdf();
fs.writeFileSync(OUTPUT_PATH, pdf, 'binary');
console.log(`PDF generated at: ${OUTPUT_PATH}`);

