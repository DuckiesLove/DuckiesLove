const clampScore = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(5, Math.max(0, num));
};

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const escapeHtml = (value) =>
  cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const computeMatch = (a, b) => {
  const aScore = clampScore(a);
  const bScore = clampScore(b);
  if (aScore === null || bScore === null) return '';
  const diff = Math.abs(aScore - bScore);
  const pct = Math.round(100 - diff * 20);
  const bounded = Math.min(100, Math.max(0, pct));
  return `${bounded}%`;
};

const normalizeMatch = (matchValue, a, b) => {
  const cleaned = cleanText(matchValue);
  if (cleaned) return cleaned.replace(/%+$/, '') + '%';
  return computeMatch(a, b);
};

export const normalizeRows = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row) return null;

      let label = '';
      let a = '';
      let b = '';
      let match = '';

      if (Array.isArray(row)) {
        [label, a, match, b] = row;
      } else if (typeof row === 'object') {
        label = row.kink ?? row.label ?? row.name ?? '';
        a = row.a ?? row.partnerA ?? row.scoreA ?? row.self ?? row.valueA ?? '';
        b = row.b ?? row.partnerB ?? row.scoreB ?? row.partner ?? row.valueB ?? '';
        match = row.match ?? row.matchPercent ?? row.matchPct ?? '';
      }

      const labelText = cleanText(label);
      const aText = cleanText(a);
      const bText = cleanText(b);
      const matchText = normalizeMatch(match, aText, bText);

      if (!labelText && !aText && !bText && !matchText) return null;

      return {
        label: labelText,
        partnerA: aText,
        match: matchText,
        partnerB: bText,
      };
    })
    .filter(Boolean);
};

const BEHAVIORAL_PLAY_LABELS = [
  'Giving: Assigning corner time or time-outs',
  'General: Attitude toward funishment vs serious correction',
  'Receiving: Being placed in the corner or given a time-out',
  'Receiving: Getting scolded or lectured for correction',
  'Receiving: Having privileges revoked (phone, TV)',
  'Giving: Lecturing or scolding to modify behavior',
  'Giving: Playful punishments that still reinforce rules',
  'General: Preferred style of discipline (strict vs lenient)',
];

const parseStorageValue = (value) => {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn('[behavioral-play] Failed to parse storage value', err);
    return null;
  }
};

const extractRowCandidates = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.behavioralPlay)) return payload.behavioralPlay;
  if (Array.isArray(payload?.behavioralPlay?.rows)) return payload.behavioralPlay.rows;
  return [];
};

const collectRatings = (payload) => {
  const scores = new Map();
  const entries = Array.isArray(payload?.answers) ? payload.answers : Array.isArray(payload) ? payload : [];

  entries.forEach((entry) => {
    const label = cleanText(entry?.label ?? entry?.name ?? entry?.kink ?? entry?.id);
    const rating = clampScore(entry?.rating ?? entry?.value ?? entry?.score ?? entry?.answer);
    if (!label || rating === null) return;
    scores.set(label, rating);
  });

  return scores;
};

export const extractBehavioralRowsFromStorage = (selfData, partnerData) => {
  const selfPayload = parseStorageValue(selfData);
  const partnerPayload = parseStorageValue(partnerData);

  const embeddedRows = extractRowCandidates(selfPayload).length
    ? extractRowCandidates(selfPayload)
    : extractRowCandidates(partnerPayload);

  if (embeddedRows.length) {
    return normalizeRows(embeddedRows);
  }

  const selfRatings = collectRatings(selfPayload);
  const partnerRatings = collectRatings(partnerPayload);

  const rows = BEHAVIORAL_PLAY_LABELS.map((label) => {
    const partnerA = selfRatings.has(label) ? selfRatings.get(label) : '';
    const partnerB = partnerRatings.has(label) ? partnerRatings.get(label) : '';
    return { label, partnerA, partnerB };
  }).filter((row) => row.partnerA !== '' || row.partnerB !== '');

  return normalizeRows(rows);
};

const buildRowHtml = (row) => {
  const label = escapeHtml(row.label);
  const a = escapeHtml(row.partnerA ?? '');
  const b = escapeHtml(row.partnerB ?? '');
  const match = escapeHtml(row.match ?? '');
  return `
    <tr>
      <td class="label">${label}</td>
      <td class="num">${a}</td>
      <td class="num">${match}</td>
      <td class="num">${b}</td>
    </tr>`;
};

export const renderBehavioralPlayHTML = (rows = [], options = {}) => {
  const preparedRows = normalizeRows(rows);
  const title = cleanText(options.title) || 'TalkKink Compatibility Survey';
  const sectionTitle = cleanText(options.sectionTitle) || 'Behavioral Play';
  const timestampRaw =
    options.timestamp instanceof Date
      ? options.timestamp.toLocaleString()
      : cleanText(options.timestamp) || new Date().toLocaleString();
  const buttonText = cleanText(options.buttonLabel) || 'Download PDF';

  const bodyHtml = preparedRows.length
    ? preparedRows.map(buildRowHtml).join('\n')
    : '<tr class="empty"><td colspan="4">No compatibility rows yet</td></tr>';

  const html = `
    <div class="page" id="tk-root">
      <h1 class="hx h1">${escapeHtml(title)}</h1>
      <div class="sub" id="tk-ts">Generated: ${escapeHtml(timestampRaw)}</div>
      <div class="rule"></div>
      <h2 class="hx h2">${escapeHtml(sectionTitle)}</h2>
      <table class="compat" id="compatTable" aria-label="Behavioral play compatibility">
        <colgroup>
          <col class="label"><col class="pa"><col class="match"><col class="pb">
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Kinks</th>
            <th scope="col">Partner A</th>
            <th scope="col">Match</th>
            <th scope="col">Partner B</th>
          </tr>
        </thead>
        <tbody id="compatBody">
          ${bodyHtml}
        </tbody>
      </table>
      <div class="bar">
        <button class="btn" id="downloadPdfBtn" type="button">${escapeHtml(buttonText)}</button>
      </div>
    </div>`;

  return { html, rows: preparedRows, timestamp: timestampRaw };
};

export const renderBehavioralPlayPDF = (rows = [], options = {}) => {
  const preparedRows = normalizeRows(rows);

  if (!preparedRows.length) {
    throw new Error('No behavioral play rows provided for PDF generation.');
  }

  const JsPDF = (typeof window !== 'undefined' && (window.jspdf?.jsPDF || window.jsPDF)) || null;
  if (!JsPDF) {
    throw new Error('jsPDF is not available. Include the library before generating PDFs.');
  }

  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  if (typeof doc.autoTable !== 'function') {
    throw new Error('jsPDF-AutoTable plugin is required to render the compatibility table.');
  }

  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp.toLocaleString()
      : cleanText(options.timestamp) || new Date().toLocaleString();

  const theme = {
    bg: [5, 19, 26],
    panel: [10, 29, 38],
    headerBg: [11, 23, 31],
    cyan: [16, 226, 240],
    ink: [232, 247, 251],
    sub: [183, 255, 255],
    zebra: [[9, 27, 38], [12, 36, 46]],
    numbers: [7, 28, 36],
    match: [12, 30, 40],
  };

  const title = cleanText(options.title) || 'TalkKink Compatibility Survey';
  const sectionTitle = cleanText(options.sectionTitle) || 'Behavioral Play';
  const margin = { top: 150, left: 40, right: 40 };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const paintBackground = () => {
    doc.setFillColor(...theme.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawHeader = () => {
    doc.setTextColor(...theme.cyan);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text(title, centerX, 52, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(...theme.sub);
    doc.text(`Generated: ${timestamp}`, centerX, 74, { align: 'center' });

    doc.setDrawColor(...theme.cyan);
    doc.setLineWidth(1.4);
    doc.line(margin.left, 86, pageWidth - margin.right, 86);

    doc.setFontSize(20);
    doc.setTextColor(...theme.cyan);
    doc.text(sectionTitle, centerX, 116, { align: 'center' });
  };

  const originalAddPage = doc.addPage.bind(doc);
  doc.addPage = (...args) => {
    const result = originalAddPage(...args);
    paintBackground();
    drawHeader();
    return result;
  };

  paintBackground();
  drawHeader();

  const usableWidth = pageWidth - (margin.left + margin.right);
  const labelWidth = Math.max(usableWidth * 0.6, usableWidth - 240);
  const numberWidth = Math.max((usableWidth - labelWidth) / 3, 72);

  const tableRows = preparedRows.map((row) => [row.label || '—', row.partnerA || '', row.match || '', row.partnerB || '']);

  doc.autoTable({
    head: [['Kinks', 'Partner A', 'Match', 'Partner B']],
    body: tableRows,
    startY: margin.top,
    margin,
    styles: {
      font: 'helvetica',
      fontSize: 11,
      textColor: theme.ink,
      fillColor: theme.panel,
      cellPadding: { top: 10, right: 8, bottom: 10, left: 10 },
      lineColor: theme.panel,
      lineWidth: 0.35,
      valign: 'middle',
    },
    headStyles: {
      fillColor: theme.headerBg,
      textColor: theme.cyan,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 12,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: theme.zebra[1] },
    columnStyles: {
      0: { cellWidth: labelWidth, halign: 'left' },
      1: { cellWidth: numberWidth, halign: 'center' },
      2: { cellWidth: numberWidth + 12, halign: 'center' },
      3: { cellWidth: numberWidth, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
        return;
      }

      if (data.section === 'body') {
        const zebra = data.row.index % 2 === 0 ? theme.zebra[0] : theme.zebra[1];
        const base = data.column.index === 0 ? zebra : theme.numbers;
        const fill = data.column.index === 2 ? theme.match : base;
        data.cell.styles.fillColor = fill;
        data.cell.styles.textColor = theme.ink;
        data.cell.styles.halign = data.column.index === 0 ? 'left' : 'center';
        data.cell.styles.lineColor = theme.panel;
        data.cell.styles.lineWidth = 0.35;
      }
    },
  });

  doc.addPage = originalAddPage;
  return doc;
};

export const generateBehavioralPlayPdfFromStorage = (options = {}) => {
  if (typeof window === 'undefined') return null;

  const storage = options.storage || window.localStorage;
  if (!storage) {
    throw new Error('localStorage is not available in this environment.');
  }

  const selfKey = options.selfKey || 'tk-self-survey';
  const partnerKey = options.partnerKey || 'tk-partner-survey';
  const selfData = storage.getItem(selfKey);
  const partnerData = storage.getItem(partnerKey);

  const rows = extractBehavioralRowsFromStorage(selfData, partnerData);

  if (!rows.length) {
    const message = 'Survey data missing.';
    if (typeof window.alert === 'function') alert(message);
    return null;
  }

  const doc = renderBehavioralPlayPDF(rows, options);
  const filename = cleanText(options.filename) || 'TalkKink-Compatibility.pdf';
  doc.save(filename);
  return doc;
};

export const renderBehavioralPlaySection = (target, rows = [], options = {}) => {
  if (typeof document === 'undefined') return null;
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return null;
  const { html, rows: prepared, timestamp } = renderBehavioralPlayHTML(rows, options);
  root.innerHTML = html;
  return { rows: prepared, timestamp };
};

export default renderBehavioralPlayHTML;
