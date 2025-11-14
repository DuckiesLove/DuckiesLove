export const TK_FLAG_GREEN = '🟩';
export const TK_FLAG_YELLOW = '🟨';
export const TK_FLAG_RED = '🟥';

// Determine the TalkKink flag square for a given survey row
export function getFlagSymbol(row) {
  if (!row || !row.hasData) return '';

  const match = typeof row.matchPct === 'number' ? row.matchPct : 0;
  const a = row.aScore;
  const b = row.bScore;

  if (a == null || b == null) return '';

  const diff = Math.abs(a - b);

  if (
    match <= 30 ||
    (a <= 1 && b >= 4) ||
    (b <= 1 && a >= 4)
  ) {
    return TK_FLAG_RED;
  }

  if (
    diff >= 3 ||
    (a === 5 && b <= 3) ||
    (b === 5 && a <= 3)
  ) {
    return TK_FLAG_YELLOW;
  }

  if (match >= 80) {
    return TK_FLAG_GREEN;
  }

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
