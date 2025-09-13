import { ROLE_MAP } from './roleMappings.js';

export const roles = [
  'Dominant',
  'Submissive',
  'Switch',
  'Master',
  'Slave',
  'Owner',
  'Brat',
  'Brat Tamer',
  'Brat Handler',
  'Experimentalist',
  'Emotional Sadist',
  'Emotional Masochist',
  'Intellectual Sadist',
  'Primal Predator',
  'Primal Prey',
  'Rope Top',
  'Rope Bottom',
  'Rope Switch',
  'Service Top',
  'Service Submissive',
  'Service Switch',
  'Latex Top',
  'Latex Bottom',
  'Leather Top',
  'Leather Bottom',
  'Watersports Switch',
  'Daddy Dom',
  'Cum Princess',
  'Cock Worshipper',
  'Bondage Top',
  'Bondage Bottom',
  'Impact Top',
  'Impact Bottom',
  'Sadist',
  'Masochist',
  'Pet',
  'Caregiver',
  // Relationship styles
  'Poly Webs',
  'Kitchen Table Poly',
  'Triad / Throuple',
  'Vee',
  'Ethical Non-Monogamy (ENM)',
  'Solo Poly',
  'Quad',
  'Hierarchical Poly',
  'Polycule',
  'Comet',
  'Relationship Anarchy (RA)',
  'Parallel Poly',
  'Garden Party Poly',
  'Polyfidelity',
  'Monogamish',
  'Mono-Polyamorous',
  'Monogamy'
];

export function calculateRoleScores(surveyAnswers) {
  const scores = {};
  for (const ans of surveyAnswers || []) {
    const key = ans.id || ans.question || '';
    let rolesForQuestion = ROLE_MAP[key];
    if (!rolesForQuestion) {
      const lower = key.toLowerCase();
      for (const k of Object.keys(ROLE_MAP)) {
        if (lower.includes(k.toLowerCase())) {
          rolesForQuestion = ROLE_MAP[k];
          break;
        }
      }
    }
    if (!rolesForQuestion || typeof ans.value !== 'number') continue;
    for (const role of rolesForQuestion) {
      scores[role] = (scores[role] || 0) + ans.value;
    }
  }
  const max = Math.max(0, ...Object.values(scores));
  return roles
    .map(role => ({
      name: role,
      percent: max > 0 && scores[role] ? Math.round((scores[role] / max) * 100) : 0
    }))
    .sort((a, b) => b.percent - a.percent);
}

// expose for browsers
if (typeof window !== 'undefined') {
  window.IKA_scoreRoles = calculateRoleScores;
}
