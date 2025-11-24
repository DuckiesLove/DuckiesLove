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

  const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  if (typeof doc.autoTable !== 'function') {
    throw new Error('jsPDF-AutoTable plugin is required to render the compatibility table.');
  }

  const timestamp =
    options.timestamp instanceof Date
      ? options.timestamp.toLocaleString()
      : cleanText(options.timestamp) || new Date().toLocaleString();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  doc.setTextColor(0, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(cleanText(options.title) || 'TalkKink Compatibility Survey', centerX, 60, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(180);
  doc.text(`Generated: ${timestamp}`, centerX, 80, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(0, 255, 255);
  doc.text(cleanText(options.sectionTitle) || 'Behavioral Play', centerX, 120, { align: 'center' });

  const tableRows = preparedRows.map((row) => [row.label, row.partnerA, row.match, row.partnerB]);

  doc.autoTable({
    startY: 140,
    head: [['Kinks', 'Partner A', 'Match', 'Partner B']],
    body: tableRows,
    styles: {
      fontSize: 10,
      halign: 'left',
      textColor: [255, 255, 255],
      fillColor: [20, 20, 20],
      lineColor: [60, 60, 60],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [0, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
    },
    theme: 'grid',
  });

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
