// Shared utility for match flag generation
export function getMatchFlag(percent) {
  if (percent === 100) return '⭐'; // Gold star for perfect match
  if (percent >= 85) return '🟩';   // Green flag
  if (percent <= 40) return '🚩';   // Red flag
  return '';                        // No flag
}
