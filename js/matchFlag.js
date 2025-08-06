// Generate flag emoji based on compatibility percentage
export function getFlagEmoji(percent) {
  if (percent === null || percent === undefined) return '';
  if (percent >= 90) return '⭐'; // Star for strong compatibility
  if (percent <= 50) return '🚩'; // Red flag for low compatibility
  return '';
}

// Determine bar color based on percentage
export function getMatchColor(percent) {
  if (percent === null || percent === undefined) return 'black';
  if (percent >= 80) return 'green';
  if (percent >= 51) return 'yellow';
  return 'red'; // 50 or less
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
