const roles = [
  'dominant',
  'switch',
  'sadist',
  'emotional sadist',
  'primal (hunter)',
  'emotional primal',
  'owner',
  'handler',
  'caregiver',
  'service top',
  'mindfuck dominant / manipulator',
  'objectifier / dehumanizer',
  'masochist',
  'emotional masochist',
  'prey',
  'emotional prey',
  'pet',
  'little',
  'service submissive',
  'brat',
  'internal conflict sub',
  'performance sub',
  'mindfuck enthusiast / manipulation sub'
];

export function calculateRoleScores(surveyData, maxRating = 5) {
  if (!surveyData || typeof surveyData !== 'object') return [];

  const scores = {};
  const counts = {};
  roles.forEach(role => {
    scores[role] = 0;
    counts[role] = 0;
  });

  Object.values(surveyData).forEach(category => {
    ['Giving', 'Receiving', 'General'].forEach(action => {
      const items = Array.isArray(category[action]) ? category[action] : [];
      items.forEach(item => {
        if (item && typeof item.rating === 'number' && item.rating > 0 && item.roles) {
          item.roles.forEach(r => {
            const name = (typeof r === 'string' ? r : r.name).toLowerCase();
            if (scores[name] === undefined) return;
            scores[name] += item.rating;
            counts[name] += maxRating;
          });
        }
      });
    });
  });

  return roles
    .map(role => ({
      name: role,
      percent: counts[role] > 0 ? Math.round((scores[role] / counts[role]) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent);
}

export { roles };
