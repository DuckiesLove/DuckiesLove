export function calculateCategoryScores(survey, maxRating = 5) {
  if (!survey || typeof survey !== 'object') return [];
  const results = [];
  Object.entries(survey).forEach(([category, data]) => {
    let total = 0;
    let count = 0;
    ['Giving', 'Receiving', 'General'].forEach(role => {
      const items = Array.isArray(data[role]) ? data[role] : [];
      items.forEach(item => {
        if (typeof item.rating === 'number') {
          total += item.rating;
          count += maxRating;
        }
      });
    });
    const percent = count > 0 ? Math.round((total / count) * 100) : 0;
    results.push({ name: category, percent });
  });
  return results.sort((a, b) => b.percent - a.percent);
}
