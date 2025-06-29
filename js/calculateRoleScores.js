function calculateRoleScores(surveyData, maxRating = 5) {
  const roleScores = {};
  const roleMaxScores = {};

  for (const category in surveyData) {
    const items = surveyData[category];
    for (const item of items) {
      if (item.rating !== null && Array.isArray(item.roles)) {
        for (const role of item.roles) {
          const roleName = role.name;
          const weight = role.weight || 1;
          const score = item.rating * weight;
          const maxScore = maxRating * weight;

          if (!roleScores[roleName]) {
            roleScores[roleName] = 0;
            roleMaxScores[roleName] = 0;
          }

          roleScores[roleName] += score;
          roleMaxScores[roleName] += maxScore;
        }
      }
    }
  }

  const results = Object.keys(roleScores).map(role => {
    const percent = (roleScores[role] / roleMaxScores[role]) * 100;
    return {
      name: role,
      percent: Math.round(percent)
    };
  });

  results.sort((a, b) => b.percent - a.percent);
  return results;
}

export { calculateRoleScores };
