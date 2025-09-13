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
  'Caregiver'
];

export function calculateRoleScores(surveyAnswers) {
  const scores = {};
  for (const ans of surveyAnswers || []) {
    const rolesForQuestion = ROLE_MAP[ans.question];
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
