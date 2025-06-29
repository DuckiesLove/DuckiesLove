export function calculateRoleScores(surveyData, maxRating = 5) {
  const roleScores = {};
  const roleMaxScores = {};
  if (!surveyData || typeof surveyData !== 'object') return [];

  // Iterate over categories
  Object.values(surveyData).forEach(category => {
    ['Giving', 'Receiving', 'General'].forEach(action => {
      const items = Array.isArray(category[action]) ? category[action] : [];
      items.forEach(item => {
        if (item && typeof item.rating === 'number' && item.roles) {
          item.roles.forEach(r => {
            const name = r.name;
            const weight = r.weight ?? 1;
            if (!roleScores[name]) roleScores[name] = 0;
            if (!roleMaxScores[name]) roleMaxScores[name] = 0;
            roleScores[name] += item.rating * weight;
            roleMaxScores[name] += maxRating * weight;
          });
        } else if (item && typeof item.rating === 'number') {
          // if item has rating but no roles, do nothing
        }
      });
    });
  });

  return Object.keys(roleScores)
    .map(role => ({
      name: role,
      percent: roleMaxScores[role]
        ? Math.round((roleScores[role] / roleMaxScores[role]) * 100)
        : 0
    }))
    .sort((a, b) => b.percent - a.percent);
}
