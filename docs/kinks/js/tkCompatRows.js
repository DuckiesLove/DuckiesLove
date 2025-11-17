function normalizeScore(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDisplay(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function resolveLabel(labelMap, category, item) {
  if (!labelMap) return item;
  const catMap = labelMap?.[category];
  if (catMap && typeof catMap === 'object') {
    const direct = catMap[item];
    if (direct) return direct;
  }
  const flat = labelMap[item];
  if (flat) return flat;
  return item;
}

function sanitizeMatch(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function tk_matchFlag(partnerA, partnerB, matchPercent) {
  const a = normalizeScore(partnerA);
  const b = normalizeScore(partnerB);
  const pct = typeof matchPercent === 'number' ? matchPercent : null;

  if (pct !== null && pct >= 90) return '⭐';
  if (pct !== null && pct <= 30) return '🚩';
  if (a === null || b === null) return '';
  const oneIsFive = a === 5 || b === 5;
  if (oneIsFive && Math.abs(a - b) >= 1) return '🟨';
  return '';
}

export function tkGenerateCompatRows(dataA = {}, dataB = {}, labelMap = null) {
  const rows = [];
  const categories = new Set([
    ...Object.keys(dataA || {}),
    ...Object.keys(dataB || {}),
  ]);

  const sortedCategories = Array.from(categories).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  );

  sortedCategories.forEach((category) => {
    const aItems =
      dataA && typeof dataA[category] === 'object'
        ? Object.keys(dataA[category])
        : [];
    const bItems =
      dataB && typeof dataB[category] === 'object'
        ? Object.keys(dataB[category])
        : [];
    const items = new Set([...aItems, ...bItems]);
    const sortedItems = Array.from(items).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    );

    sortedItems.forEach((item) => {
      const rawA = dataA?.[category]?.[item];
      const rawB = dataB?.[category]?.[item];
      if (
        rawA === undefined &&
        rawB === undefined
      ) {
        return;
      }

      const aScore = normalizeScore(rawA);
      const bScore = normalizeScore(rawB);
      let matchPercent = '';
      let sanitizedMatchStr = '';

      if (aScore !== null && bScore !== null) {
        const pct = Math.round(((5 - Math.abs(aScore - bScore)) / 5) * 100);
        matchPercent = Math.max(0, Math.min(100, pct));
        const emoji = tk_matchFlag(aScore, bScore, matchPercent);
        const matchStr = `${matchPercent}%${emoji ? ` ${emoji}` : ''}`;
        sanitizedMatchStr = sanitizeMatch(matchStr);
      }

      const shortLabel = resolveLabel(labelMap, category, item) ?? item;
      rows.push([
        shortLabel,
        formatDisplay(rawA ?? ''),
        sanitizedMatchStr,
        formatDisplay(rawB ?? ''),
      ]);
    });
  });

  return rows;
}
