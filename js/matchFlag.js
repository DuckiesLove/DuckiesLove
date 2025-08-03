// Shared utility for match flag generation
export function getMatchFlag(percent) {
  if (percent === 100) return '⭐'; // Gold star for perfect match
  if (percent >= 85) return '🟩';   // Green flag
  if (percent <= 40) return '🚩';   // Red flag
  return '';                        // No flag
}

// Calculate the percentage of items where both partners match on a rating
export function calculateCategoryMatch(categoryData) {
  const total = categoryData.length;
  let matched = 0;
  for (const item of categoryData) {
    if (
      item.partnerA !== null &&
      item.partnerA !== undefined &&
      item.partnerA === item.partnerB
    ) {
      matched++;
    }
  }
  return total === 0 ? 0 : Math.round((matched / total) * 100);
}
