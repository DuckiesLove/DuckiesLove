// Shared utility for match flag generation
export function getMatchFlag(percent) {
  if (percent === 100) return '⭐'; // Gold star for perfect match
  if (percent >= 85) return '🟩';   // Green flag
  if (percent <= 40) return '🚩';   // Red flag
  return '';                        // No flag
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
