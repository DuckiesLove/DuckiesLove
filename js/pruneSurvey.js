export function pruneSurvey(survey) {
  const result = {};
  if (!survey || typeof survey !== 'object') return result;

  const sortedCategories = Object.keys(survey).sort((a, b) => a.localeCompare(b));
  for (const category of sortedCategories) {
    const data = survey[category];
    const cat = {};
    ['Giving', 'Receiving', 'General'].forEach(role => {
      const items = Array.isArray(data[role]) ? data[role] : [];
      const filled = items.filter(it => {
        if (it.type === 'text') {
          return !!(it.value && String(it.value).trim());
        }
        if (it.type === 'multi') {
          return Array.isArray(it.value) && it.value.length > 0;
        }
        if (it.type === 'dropdown') {
          return it.value !== undefined && it.value !== '';
        }
        return typeof it.rating === 'number';
      }).map(it => {
        const out = { name: it.name };
        if (typeof it.rating === 'number') out.rating = it.rating;
        if (it.type) out.type = it.type;
        if (it.options) out.options = it.options;
        if (it.value !== undefined) out.value = it.value;
        if (it.roles) out.roles = it.roles;
        return out;
      });
      if (filled.length) cat[role] = filled;
    });
    if (Object.keys(cat).length) result[category] = cat;
  }

  return result;
}
