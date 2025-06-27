function calculateCompatibility(surveyA, surveyB) {
  const categories = Object.keys(surveyA);
  let totalScore = 0;
  let count = 0;
  let redFlags = [];
  let yellowFlags = [];

  categories.forEach(category => {
    if (!surveyB[category]) return;

    ['Giving', 'Receiving', 'Neutral'].forEach(action => {
      const listA = surveyA[category][action] || [];
      const listB = surveyB[category][
        action === 'Giving' ? 'Receiving' :
        action === 'Receiving' ? 'Giving' : 'Neutral'
      ] || [];

      listA.forEach(itemA => {
        const match = listB.find(itemB =>
          itemB.name.trim().toLowerCase() === itemA.name.trim().toLowerCase()
        );
        if (match) {
          const ratingA = parseInt(itemA.rating);
          const ratingB = parseInt(match.rating);
          if (Number.isInteger(ratingA) && Number.isInteger(ratingB)) {
            const diff = Math.abs(ratingA - ratingB);
            totalScore += Math.max(0, 100 - diff * 20);
            count++;
            if ((ratingA === 6 && ratingB === 1) || (ratingA === 1 && ratingB === 6)) {
              redFlags.push(itemA.name);
            } else if (
              (ratingA === 6 && ratingB === 2) || (ratingA === 2 && ratingB === 6) ||
              (ratingA === 5 && ratingB === 1) || (ratingA === 1 && ratingB === 5)
            ) {
              yellowFlags.push(itemA.name);
            }
          }
        }
      });
    });
  });

  const avg = count ? Math.round(totalScore / count) : 0;

  // Similarity Score (same role)
  let simScore = 0;
  let simCount = 0;
  categories.forEach(category => {
    if (!surveyB[category]) return;
    ['Giving', 'Receiving', 'Neutral'].forEach(action => {
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

  return {
    compatibilityScore: avg,
    similarityScore: avgSim,
    redFlags: [...new Set(redFlags)],
    yellowFlags: [...new Set(yellowFlags)]
  };
}

if (typeof module !== 'undefined') {
  module.exports = { calculateCompatibility };
}
