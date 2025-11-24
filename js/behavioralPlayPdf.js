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

export const renderBehavioralPlaySection = (target, rows = [], options = {}) => {
  if (typeof document === 'undefined') return null;
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return null;
  const { html, rows: prepared, timestamp } = renderBehavioralPlayHTML(rows, options);
  root.innerHTML = html;
  return { rows: prepared, timestamp };
};

export default renderBehavioralPlayHTML;
