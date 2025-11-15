export const TK_FLAG_GREEN = '🟩';
export const TK_FLAG_YELLOW = '🟨';
export const TK_FLAG_RED = '🟥';

export function getFlagColor(matchPercent, aScore, bScore) {
  // normalize to numbers
  const m = Number(matchPercent);
  const a = Number(aScore);
  const b = Number(bScore);

  // High match → green
  if (Number.isFinite(m) && m >= 90) return 'green';

  // Very low match → red
  if (Number.isFinite(m) && m <= 30) return 'red';

  // One partner is a 5 and the other is lower → yellow soft warning
  const oneIsFive = a === 5 || b === 5;
  if (oneIsFive && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) >= 1) {
    return 'yellow';
  }

  // No flag
  return '';
}

// Determine the TalkKink flag square for a given survey row
export function getFlagSymbol(row) {
  if (!row || !row.hasData) return '';

  const match = typeof row.matchPct === 'number' ? row.matchPct : 0;
  const a = row.aScore;
  const b = row.bScore;

  if (a == null || b == null) return '';

  const color = getFlagColor(match, a, b);
  if (color === 'green') return TK_FLAG_GREEN;
  if (color === 'yellow') return TK_FLAG_YELLOW;
  if (color === 'red') return TK_FLAG_RED;
  return '';
}

// Backwards compatibility helper – prefer getFlagSymbol(row)
export function getFlagEmoji(percent, a, b) {
  const hasData = a != null && b != null && percent != null;
  return getFlagSymbol({
    hasData,
    matchPct: typeof percent === 'number' ? percent : 0,
    aScore: a,
    bScore: b,
  });
}

// Determine bar color based on percentage
export function getMatchColor(percent) {
  if (percent === null || percent === undefined) return 'black';
  if (percent >= 90) return 'green';
  if (percent >= 60) return 'yellow';
  return 'red';
}

// Calculate the percentage of items where both partners match on a rating
// Ignoring entries that are missing or marked with '-' for either partner
export function calculateCategoryMatch(categoryData) {
  let total = 0;
  let matched = 0;
  for (const item of categoryData) {
    const a = item.partnerA;
    const b = item.partnerB;
    if (
      a !== null &&
      a !== undefined &&
      a !== '-' &&
      b !== null &&
      b !== undefined &&
      b !== '-'
    ) {
      total++;
      if (a === b) matched++;
    }
  }
  return total > 0 ? Math.round((matched / total) * 100) : 0;
}
