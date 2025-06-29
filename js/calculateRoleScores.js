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

function calculateRoleScores(surveyData, maxRating = 5) {
  const scores = {};
  const counts = {};
  roles.forEach(r => {
    scores[r] = 0;
    counts[r] = 0;
  });

  for (const category in surveyData) {
    const items = surveyData[category];
    for (const item of items) {
      if (item && typeof item.rating === 'number' && item.rating > 0 && Array.isArray(item.roles)) {
        for (const role of item.roles) {
          const roleName = (typeof role === 'string' ? role : role.name).toLowerCase();
          if (scores[roleName] === undefined) continue;
          scores[roleName] += item.rating;
          counts[roleName] += maxRating;
        }
      }
    }
  }

  const results = roles.map(role => ({
    name: role,
    percent: counts[role] > 0 ? Math.round((scores[role] / counts[role]) * 100) : 0
  }));

  results.sort((a, b) => b.percent - a.percent);
  return results;
}

export { calculateRoleScores, roles };
