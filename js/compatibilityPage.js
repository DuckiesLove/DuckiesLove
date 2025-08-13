// Compatibility results page logic and PDF export helpers
import { initTheme } from './theme.js';
import { getFlagEmoji, calculateCategoryMatch, getMatchColor } from './matchFlag.js';
import { calculateCompatibility } from './compatibility.js';

let surveyA = null;
let surveyB = null;
let lastResult = null;
const PAGE_BREAK_CATEGORIES = new Set([
  'Communication',
  'Service',
  'Impact Play'
]);
const RATING_LABELS = {
  0: 'Not for me / Hard Limit',
  1: 'Dislike / Haven\u2019t Considered',
  2: 'Would Try for Partner',
  3: 'Curious / Might Enjoy',
  4: 'Like / Regular Interest',
  5: 'Love / Core Interest'
};

// ----- Compatibility history helpers -----
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('compatHistory')) || [];
  } catch {
    return [];
  }
}

function addHistoryEntry(score) {
  const history = loadHistory();
  history.push({ score, date: new Date().toISOString() });
  while (history.length > 5) history.shift();
  localStorage.setItem('compatHistory', JSON.stringify(history));
  if (typeof window !== 'undefined') {
    window.compatibilityHistory = history;
  }
  return history;
}
if (typeof window !== 'undefined') {
  window.compatibilityHistory = loadHistory();
}

function parseSurveyJSON(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1 && first < last) {
      return JSON.parse(clean.slice(first, last + 1));
    }
    throw new Error('Invalid JSON');
  }
}

function formatRating(val) {
  return val === null || val === undefined
    ? '-'
    : `${val} - ${RATING_LABELS[val]}`;
}


function toPercent(val) {
  return typeof val === 'number' ? Math.round((val / 5) * 100) : null;
}

function maxRating(obj) {
  const vals = [obj.giving, obj.receiving, obj.general].filter(v => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}

function colorClass(percent) {
  if (percent === null || percent === undefined) return 'black';
  if (percent >= 80) return 'green';
  if (percent >= 60) return 'yellow';
  return 'red';
}

function compatNormalizeKey(s){
  return String(s || '')
    .replace(/[\u2018\u2019\u2032]/g,"'")
    .replace(/[\u201C\u201D\u2033]/g,'"')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/\u2026/g,'')
    .replace(/\s*\.\.\.\s*$/,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
if (typeof window !== 'undefined') window.compatNormalizeKey = compatNormalizeKey;

function makeBar(percent) {
  const outer = document.createElement('div');
  outer.className = 'partner-bar';
  const fill = document.createElement('div');
  fill.className = 'partner-fill ' + colorClass(percent);
  fill.style.width = percent === null ? '0%' : percent + '%';
  fill.style.backgroundColor = getMatchColor(percent);
  outer.appendChild(fill);
  const text = document.createElement('span');
  text.className = 'partner-text ' + colorClass(percent);
  text.textContent = percent === null ? '-' : percent + '%';
  outer.appendChild(text);
  return outer;
}

function buildIcons(ratingA, ratingB) {
  const youP = toPercent(ratingA);
  const partnerP = toPercent(ratingB);
  const symbols = [];
  if (youP !== null && partnerP !== null && youP >= 90 && partnerP >= 90) {
    symbols.push('<span class="icon-green-flag">✅</span>');
  }
  if (
    (youP !== null && youP <= 30) ||
    (partnerP !== null && partnerP <= 30)
  ) {
    symbols.push('<span class="icon-red-flag">🚩</span>');
  }
  if (
    (ratingA === 5 && ratingB !== null && ratingB < 5) ||
    (ratingB === 5 && ratingA !== null && ratingA < 5)
  ) {
    symbols.push('<span class="icon-yellow-flag">🟨</span>');
  }
  return symbols.join(' ');
}

function groupKinksByCategory(data) {
  const grouped = {};
  data.forEach(item => {
    const category = item.category || 'Uncategorized';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });
  return grouped;
}
function loadSavedSurvey() {
  const saved = localStorage.getItem('savedSurvey');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    surveyA = normalizeSurveyFormat(parsed.survey || parsed);
    mergeSurveyWithTemplate(surveyA, window.templateSurvey);
    normalizeRatings(surveyA);
    filterGeneralOptions(surveyA);
  } catch (err) {
    console.warn('Failed to parse saved survey:', err);
  }
}

function filterGeneralOptions(survey) {
  Object.values(survey).forEach(cat => {
    if (!cat.General) return;
    const neutralNames = new Set(cat.General.map(k => k.name.trim().toLowerCase()));
    ['Giving', 'Receiving'].forEach(role => {
      if (Array.isArray(cat[role])) {
        cat[role] = cat[role].filter(k => !neutralNames.has(k.name.trim().toLowerCase()));
      }
    });
  });
}

function normalizeRatings(survey) {
  Object.values(survey).forEach(cat => {
    ['Giving', 'Receiving', 'General'].forEach(role => {
      if (Array.isArray(cat[role])) {
        cat[role].forEach(item => {
          if (typeof item.rating === 'number') {
            if (item.rating > 5) item.rating = 5;
            if (item.rating < 0) item.rating = 0;
          }
        });
      }
    });
  });
}

function normalizeSurveyFormat(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const actions = ['Giving', 'Receiving', 'General'];
  const keys = Object.keys(obj);
  if (keys.every(k => actions.includes(k))) {
    return {
      Misc: {
        Giving: Array.isArray(obj.Giving) ? obj.Giving : [],
        Receiving: Array.isArray(obj.Receiving) ? obj.Receiving : [],
        General: Array.isArray(obj.General) ? obj.General : []
      }
    };
  }

  const normalized = {};
  Object.entries(obj).forEach(([cat, val]) => {
    if (Array.isArray(val)) {
      normalized[cat] = { Giving: [], Receiving: [], General: val };
    } else {
      normalized[cat] = { ...val };
      actions.forEach(role => {
        if (!Array.isArray(normalized[cat][role])) normalized[cat][role] = [];
      });
    }
  });
  return normalized;
}

function mergeSurveyWithTemplate(survey, template) {
  if (!template || typeof template !== 'object') return;
  Object.entries(template).forEach(([cat, tmpl]) => {
    if (!survey[cat]) {
      survey[cat] = JSON.parse(JSON.stringify(tmpl));
      return;
    }
    ['Giving', 'Receiving', 'General'].forEach(role => {
      const tItems = Array.isArray(tmpl[role]) ? tmpl[role] : [];
      if (!Array.isArray(survey[cat][role])) survey[cat][role] = [];
      const existing = new Set(
        survey[cat][role].map(i => (i.name || '').trim().toLowerCase())
      );
      tItems.forEach(it => {
        if (!existing.has(it.name.trim().toLowerCase())) {
          const obj = { name: it.name, rating: null };
          if (it.type) obj.type = it.type;
          if (it.options) obj.options = it.options;
          if (it.roles) obj.roles = it.roles;
          survey[cat][role].push(obj);
        } else {
          const ex = survey[cat][role].find(
            i => i.name.trim().toLowerCase() === it.name.trim().toLowerCase()
          );
          if (ex) {
            if (it.type) ex.type = it.type;
            if (it.options) ex.options = it.options;
            if (it.roles) ex.roles = it.roles;
          }
        }
      });
    });
  });
}


function buildKinkBreakdown(surveyA, surveyB = {}) {
  const breakdown = {};
  const categories = Object.keys(surveyA).sort((a, b) => a.localeCompare(b));
  categories.forEach(category => {
    const catA = surveyA[category];
    const catB = surveyB[category] || {};
    const names = new Set();
    ['Giving', 'Receiving', 'General'].forEach(role => {
      (catA[role] || []).forEach(k => names.add(k.name));
      (catB[role] || []).forEach(k => names.add(k.name));
    });
    breakdown[category] = [];
    names.forEach(name => {
      const getRating = (cat, role) => {
        const item = (cat[role] || []).find(
          i => i.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        const r = item ? parseInt(item.rating) : null;
        return Number.isInteger(r) ? r : null;
      };

      const aG = getRating(catA, 'Giving');
      const aR = getRating(catA, 'Receiving');
      const aGen = getRating(catA, 'General');
      const bG = getRating(catB, 'Giving');
      const bR = getRating(catB, 'Receiving');
      const bGen = getRating(catB, 'General');

      breakdown[category].push({
        name,
        you: { giving: aG, receiving: aR, general: aGen },
        partner: { giving: bG, receiving: bR, general: bGen }
      });
    });
  });
  return breakdown;
}

function loadFileA(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = parseSurveyJSON(ev.target.result);
      surveyA = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyA, window.templateSurvey);
      normalizeRatings(surveyA);
      filterGeneralOptions(surveyA);
      window.partnerASurvey = surveyA;
      updateComparison();
    } catch (err) {
      console.warn('Failed to load Survey A:', err);
      alert('Invalid JSON for Survey A.\nPlease upload the unmodified JSON file exported from this site.');
    }
  };
  reader.readAsText(file);
}

function loadFileB(file) {
  if (!file) return;
  if (!confirm('Have you reviewed consent with your partner?')) {
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = parseSurveyJSON(ev.target.result);
      surveyB = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyB, window.templateSurvey);
      normalizeRatings(surveyB);
      filterGeneralOptions(surveyB);
      window.partnerBSurvey = surveyB;
      updateComparison();
    } catch (err) {
      console.warn('Failed to load Survey B:', err);
      alert('Invalid JSON for Survey B.\nPlease upload the unmodified JSON file exported from this site.');
    }
  };
  reader.readAsText(file);
}

function calculateMatchPercent(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, 100 - Math.abs(a - b) * 20);
}

function getFlagOrStar(match, scoreA, scoreB) {
  if (match >= 90) return '⭐';
  const high = val => Number.isFinite(val) && val >= 4;
  const missing = val => val === null || val === undefined || val === '' || val === 0;
  if (match <= 50 || ((high(scoreA) || high(scoreB)) && (missing(scoreA) || missing(scoreB)))) return '🚩';
  return '';
}

function renderFlags(root = document) {
  const rows = root.querySelectorAll('.item-row');
  rows.forEach(row => {
    const a = Number(row.dataset.a);
    const b = Number(row.dataset.b);
    const flagCell = row.querySelector('.flag-cell');
    const matchCell = row.querySelector('.match');

    flagCell.textContent = '';
    matchCell.textContent = '-';

    const match = calculateMatchPercent(a, b);
    if (match !== null) {
      matchCell.textContent = match + '%';
      flagCell.textContent = getFlagOrStar(match, a, b);
    }
  });
}

function markPartnerALoaded() {
  const table = document.querySelector('#compat-container table');
  if (!table) return;

  const ths = Array.from(table.querySelectorAll('thead th'));
  const idxA = ths.findIndex(th => (th.textContent || '').trim().toLowerCase() === 'partner a');

  if (idxA >= 0) {
    const cells = Array.from(table.querySelectorAll(`tbody tr td:nth-child(${idxA + 1})`));
    const hasAny = cells.some(td => (td.textContent || '').trim() !== '');
    if (hasAny) {
      cells.forEach(td => td.style.outline = '1px dashed rgba(255,255,255,.15)');
      console.log('[compat] Partner A column populated in the DOM. Ready for PDF.');
    } else {
      console.warn('[compat] Partner A column is empty. Did the JSON include ratings for these rows?');
    }
  } else {
    console.warn('[compat] Could not find a "Partner A" table header. Check your table markup.');
  }
}

function updateComparison() {
  const container = document.getElementById('compatibility-report');
  const msg = document.getElementById('comparisonResult');
  if (!surveyA) {
    msg.textContent = surveyB ? 'Please upload both surveys to compare.' : '';
    container.innerHTML = '';
    lastResult = null;
    return;
  }

  if (!surveyB) {
    msg.textContent = 'Partner B data missing. Showing Partner A results only.';
  } else {
    msg.textContent = '';
  }

  lastResult = buildKinkBreakdown(surveyA, surveyB || {});
  container.innerHTML = '';

  // Calculate overall compatibility score and update history
  let history;
  if (surveyB) {
    const compat = calculateCompatibility(surveyA, surveyB);
    history = addHistoryEntry(compat.compatibilityScore);
  } else {
    history = loadHistory();
  }

  const mergedKinkData = [];
  Object.entries(lastResult).forEach(([category, items]) => {
    items.forEach(it => {
      mergedKinkData.push({
        category,
        name: it.name,
        partnerA: maxRating(it.you),
        partnerB: surveyB ? maxRating(it.partner) : null
      });
    });
  });

  const groupedData = groupKinksByCategory(mergedKinkData);

  const table = document.createElement('table');
  table.className = 'results-table compat';
  table.innerHTML = `
    <colgroup>
      <col class="label" />
      <col class="pa" />
      <col class="match" />
      <col class="flag" />
      <col class="pb" />
    </colgroup>
    <thead>
      <tr>
        <th class="label">Category</th>
        <th class="pa">Partner A</th>
        <th class="match">Match</th>
        <th class="flag">Flag/Star</th>
        <th class="pb">Partner B</th>
      </tr>
    </thead>
  `;

  for (const [category, kinks] of Object.entries(groupedData)) {
    const block = document.createElement('tbody');
    block.className = 'category-block';
    block.dataset.category = category;

    const titleRow = document.createElement('tr');
    // Remove decorative emoji from category headers in web view
    titleRow.innerHTML = `<td class="category-title" colspan="5">${category}</td>`;
    block.appendChild(titleRow);

    kinks.forEach(kink => {
      const row = document.createElement('tr');
      row.className = 'item-row';
      if (kink.partnerA != null) row.dataset.a = kink.partnerA;
      if (kink.partnerB != null) row.dataset.b = kink.partnerB;
      const fullLabel = kink.name;
      row.setAttribute('data-key', compatNormalizeKey(fullLabel));
      row.setAttribute('data-full', fullLabel);
      row.innerHTML = `
        <td class="label">${kink.name}</td>
        <td class="pa">${kink.partnerA ?? '-'}</td>
        <td class="match">-</td>
        <td class="flag flag-cell"></td>
        <td class="pb">${kink.partnerB ?? '-'}</td>
      `;
      const firstCell = row.querySelector('td.label');
      const hidden = document.createElement('span');
      hidden.className = 'full-label';
      hidden.textContent = fullLabel;
      hidden.hidden = true;
      firstCell.appendChild(hidden);
      block.appendChild(row);
    });

    table.appendChild(block);
  }

  container.appendChild(table);
  renderFlags(table);
  markPartnerALoaded();

  const categories = Object.entries(lastResult).map(([category, items]) => ({
    category,
    items: items.map(it => ({
      label: it.name,
      a: maxRating(it.you),
      b: maxRating(it.partner)
    }))
  }));
  window.compatibilityData = { categories, history };

  const cardList = document.getElementById('print-card-list');
  if (cardList) cardList.innerHTML = '';
}


function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (input.id === 'uploadSurveyA') {
    loadFileA(file);
  } else if (input.id === 'uploadSurveyB') {
    loadFileB(file);
  }
}

window.handleFileUpload = handleFileUpload;



function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

async function exportPNG() {
  const element = document.getElementById('pdf-container');
  if (!element) return;
  const canvas = await html2canvas(element, {
    backgroundColor: '#000000',
    scale: 2,
    useCORS: true
  });
  const link = document.createElement('a');
  link.download = 'kink-survey.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function exportHTML() {
  const element = document.getElementById('pdf-container');
  if (!element) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Kink Survey Results</title></head><body>${element.innerHTML}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, 'kink-survey.html');
}

function exportMarkdown() {
  if (!lastResult) {
    if (!surveyA || !surveyB) {
      alert('Please upload both surveys first.');
      return;
    }
    lastResult = buildKinkBreakdown(surveyA, surveyB);
  }
  const lines = ['# Kink Compatibility Results'];
  for (const [cat, items] of Object.entries(lastResult)) {
    lines.push(`\n## ${cat}`);
    items.forEach(it => {
      const a = maxRating(it.you);
      const b = maxRating(it.partner);
      lines.push(`- **${it.name}** - You: ${formatRating(a)} | Partner: ${formatRating(b)}`);
    });
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  downloadBlob(blob, 'kink-survey.md');
}

function exportCSV() {
  if (!lastResult) {
    if (!surveyA || !surveyB) {
      alert('Please upload both surveys first.');
      return;
    }
    lastResult = buildKinkBreakdown(surveyA, surveyB);
  }
  const rows = [['Category', 'Item', 'Partner A', 'Partner B']];
  Object.entries(lastResult).forEach(([cat, list]) => {
    list.forEach(it => {
      rows.push([cat, it.name, maxRating(it.you) ?? '', maxRating(it.partner) ?? '']);
    });
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'kink-survey.csv');
}

function exportJSON() {
  if (!lastResult) {
    if (!surveyA || !surveyB) {
      alert('Please upload both surveys first.');
      return;
    }
    lastResult = buildKinkBreakdown(surveyA, surveyB);
  }
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'kink-survey.json');
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedSurvey();
});
