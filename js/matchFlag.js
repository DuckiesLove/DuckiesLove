// Generate flag emoji based on compatibility percentage and individual scores
export function getFlagEmoji(percent, a, b) {
  if (percent === null || percent === undefined) return '';
  if (percent >= 90) return '⭐';
  if (percent >= 80) return '🟩';
  if (percent <= 40) return '🚩';
  if (
    (a === 5 && typeof b === 'number' && b < 5) ||
    (b === 5 && typeof a === 'number' && a < 5)
  )
    return '🟨';
  return '';
}

// Determine bar color based on percentage
export function getMatchColor(percent) {
  if (percent === null || percent === undefined) return 'black';
  if (percent >= 80) return 'green';
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
