export function calculateCompatibility(surveyA, surveyB) {
  const categories = Object.keys(surveyA);
  let totalScore = 0;
  let count = 0;
  let redFlags = [];
  let yellowFlags = [];
  const catTotals = {};
  const catCounts = {};

  categories.forEach(category => {
    if (!surveyB[category]) return;
    catTotals[category] = 0;
    catCounts[category] = 0;

    ['Giving', 'Receiving'].forEach(action => {
      const listA = surveyA[category][action] || [];
      const listB =
        surveyB[category][action === 'Giving' ? 'Receiving' : 'Giving'] || [];

      listA.forEach(itemA => {
        const match = listB.find(
          itemB =>
            itemB.name.trim().toLowerCase() ===
            itemA.name.trim().toLowerCase()
        );
        if (!match) return;
        const ratingA = parseInt(itemA.rating);
        const ratingB = parseInt(match.rating);
        if (!Number.isInteger(ratingA) || !Number.isInteger(ratingB)) return;

        count++;
        catCounts[category]++;

        if ((ratingA >= 5 && ratingB <= 1) || (ratingB >= 5 && ratingA <= 1)) {
          redFlags.push(itemA.name);
        } else if (
          (ratingA >= 4 && ratingB <= 2) ||
          (ratingB >= 4 && ratingA <= 2)
        ) {
          yellowFlags.push(itemA.name);
        }

        if (ratingA >= 4 && ratingB >= 4) {
          totalScore += 1;
          catTotals[category] += 1;
        } else if (ratingA >= 3 && ratingB >= 3) {
          totalScore += 0.5;
          catTotals[category] += 0.5;
        }
      });
    });
  });

  const avg = count ? Math.round((totalScore / count) * 100) : 0;

  // Similarity Score (same role)
  let simScore = 0;
  let simCount = 0;
  categories.forEach(category => {
    if (!surveyB[category]) return;
    ['Giving', 'Receiving', 'General'].forEach(action => {
      const listA = surveyA[category][action] || [];
      const listB = surveyB[category][action] || [];
      listA.forEach(itemA => {
        const match = listB.find(itemB =>
          itemB.name.trim().toLowerCase() === itemA.name.trim().toLowerCase()
        );
        if (match) {
          const ratingA = parseInt(itemA.rating);
          const ratingB = parseInt(match.rating);
          if (Number.isInteger(ratingA) && Number.isInteger(ratingB)) {
            const diff = Math.abs(ratingA - ratingB);
            simScore += Math.max(0, 100 - diff * 20);
            simCount++;
          }
        }
      });
    });
  });

  const avgSim = simCount ? Math.round(simScore / simCount) : 0;

  const categoryBreakdown = {};
  Object.keys(catTotals).forEach(cat => {
    const c = catCounts[cat];
    categoryBreakdown[cat] = c ? Math.round((catTotals[cat] / c) * 100) : 0;
  });

  return {
    compatibilityScore: avg,
    similarityScore: avgSim,
    redFlags: [...new Set(redFlags)],
    yellowFlags: [...new Set(yellowFlags)],
    categoryBreakdown
  };
}


