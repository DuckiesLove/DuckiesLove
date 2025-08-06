// Shared utility for match flag generation
export function getMatchFlag(percent) {
  if (percent === null || percent === undefined) return '';
  if (percent >= 90) return '⭐'; // Star for strong compatibility
  if (percent <= 50) return '🚩'; // Red flag for low compatibility
  return '';
}

// Determine progress bar color based on percentage
export function getProgressBarColor(percent) {
  if (percent >= 80) return '#00cc66';   // Green for 80% and above
  if (percent >= 60) return '#ffcc00';   // Yellow for 60-79%
  return '#ff4444';                     // Red for below 60%
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
