// Shared utility for match flag generation
export function getMatchFlag(percent) {
  if (percent === 100) return '⭐'; // Gold star for perfect match
  if (percent >= 85) return '🟩';   // Green flag
  if (percent <= 40) return '🚩';   // Red flag
  return '';                        // No flag
}

// Determine progress bar color based on percentage
export function getProgressBarColor(percent) {
  if (percent >= 80) return '#00cc66';   // Green for 80% and above
  if (percent >= 60) return '#ffcc00';   // Yellow for 60-79%
  return '#ff4444';                     // Red for below 60%
}

// Calculate the percentage of items where both partners match on a rating
// Accepts two parallel arrays representing ratings for Partner A and Partner B
// Ignores entries that are missing or marked with '-' for either partner
export function calculateCategoryMatch(partnerA, partnerB) {
  if (!Array.isArray(partnerA) || !Array.isArray(partnerB)) return 0;
  const len = Math.min(partnerA.length, partnerB.length);
  let total = 0;
  let matched = 0;
  for (let i = 0; i < len; i++) {
    const a = partnerA[i];
    const b = partnerB[i];
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
