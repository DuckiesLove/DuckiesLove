import { calculateCategoryMatch } from './matchFlag.js';
import { calculateCompatibility } from './compatibility.js';

let surveyA = null;
let surveyB = null;
let pdfGenerating = false;
let latestCompatData = null;

const downloadButton = document.getElementById('downloadPdfBtn');

function refreshDownloadAvailability(options = {}) {
  if (!downloadButton) return;
  const forceDisable = options.forceDisable === true;
  const ready = !forceDisable && !!(surveyA && surveyB && latestCompatData);
  downloadButton.disabled = !ready;
  downloadButton.setAttribute('aria-disabled', String(!ready));
}

refreshDownloadAvailability();

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

async function generatePDF(data) {
  if (pdfGenerating) return;
  pdfGenerating = true;
  try {
    const { loadJsPDF } = await import('./loadJsPDF.js');
    await loadJsPDF();
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      throw new Error('jsPDF failed to load');
    }
    const { generateCompatibilityPDF } = await import('./compatibilityPdf.js');
    generateCompatibilityPDF(data);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    pdfGenerating = false;
  }
}

const PAGE_BREAK_CATEGORIES = new Set([
  'Communication',
  'Service',
  'Impact Play'
]);

function parseSurveyJSON(text) {
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\u0000/g, '')
    .trim();
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

function calculateCategoryScores(survey, maxRating = 5) {
  if (!survey || typeof survey !== 'object') return [];
  const results = [];
  Object.entries(survey).forEach(([category, data]) => {
    let total = 0;
    let count = 0;
    ['Giving', 'Receiving', 'General'].forEach(role => {
      const items = Array.isArray(data[role]) ? data[role] : [];
      items.forEach(item => {
        if (typeof item.rating === 'number') {
          total += item.rating;
          count += maxRating;
        }
      });
    });
    const percent = count > 0 ? Math.round((total / count) * 100) : 0;
    results.push({ name: category, percent });
  });
  return results.sort((a, b) => b.percent - a.percent);
}

function toPercent(val) {
  return typeof val === 'number' ? Math.round((val / 5) * 100) : null;
}

function maxRating(obj) {
  const vals = [obj.giving, obj.receiving, obj.general].filter(v => typeof v === 'number');
  return vals.length ? Math.max(...vals) : null;
}

function colorClass(percent) {
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

function barFillColor(percent) {
  if (percent >= 80) return '#00c853';
  if (percent >= 60) return '#fbc02d';
  return '#d32f2f';
}

function avgPercent(a, b) {
  const av = (a ?? 0) + (b ?? 0);
  return av / 2;
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

function buildCategoryIcons(youPercent, partnerPercent) {
  const symbols = [];
  if (youPercent >= 90 && partnerPercent >= 90) {
    symbols.push('<span class="icon-green-flag">✅</span>');
  }
  if (youPercent <= 30 || partnerPercent <= 30) {
    symbols.push('<span class="icon-red-flag">🚩</span>');
  }
  return symbols.join(' ');
}

function buildCategoryComparison(surveyA, surveyB) {
  const scoresA = calculateCategoryScores(surveyA);
  const scoresB = calculateCategoryScores(surveyB);
  const mapB = new Map(scoresB.map(s => [s.name, s.percent]));
  return scoresA
    .filter(s => mapB.has(s.name))
    .map(s => ({ name: s.name, you: s.percent, partner: mapB.get(s.name) }))
    .sort((a, b) => avgPercent(b.you, b.partner) - avgPercent(a.you, a.partner));
}

function buildKinkBreakdown(surveyA, surveyB) {
  const breakdown = {};
  const categories = Object.keys(surveyA).sort((a, b) => a.localeCompare(b));
  categories.forEach(category => {
    if (!surveyB[category]) return;
    const catA = surveyA[category];
    const catB = surveyB[category];
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
      updateComparison();
    } catch (err) {
      console.warn('Failed to load Survey A:', err);
      alert('Invalid JSON for Survey A.');
    }
  };
  reader.readAsText(file);
}

function loadFileB(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = parseSurveyJSON(ev.target.result);
      surveyB = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyB, window.templateSurvey);
      normalizeRatings(surveyB);
      filterGeneralOptions(surveyB);
      updateComparison();
    } catch (err) {
      console.warn('Failed to load Survey B:', err);
      alert('Invalid JSON for Survey B.');
    }
  };
  reader.readAsText(file);
}

const fileAInput = document.getElementById('fileA');
if (fileAInput) {
  fileAInput.addEventListener('change', e => loadFileA(e.target.files[0]));
}

const fileBInput = document.getElementById('fileB');
if (fileBInput) {
  fileBInput.addEventListener('change', e => loadFileB(e.target.files[0]));
}

if (downloadButton) {
  downloadButton.addEventListener('click', async () => {
    if (!surveyA || !surveyB || !latestCompatData) {
      alert('Please upload both surveys before downloading the PDF.');
      return;
    }

    refreshDownloadAvailability({ forceDisable: true });
    try {
      await generatePDF(latestCompatData);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('PDF export failed. Please try again.');
    } finally {
      refreshDownloadAvailability();
    }
  });
}

function updateComparison() {
  const container = document.getElementById('pdf-container');
  const msg = document.getElementById('comparisonResult');
  if (!surveyA || !surveyB) {
    if (msg) msg.textContent = surveyA || surveyB ? 'Please upload both surveys to compare.' : '';
    if (container) container.innerHTML = '';
    latestCompatData = null;
    window.compatibilityData = null;
    refreshDownloadAvailability();
    return;
  }
  if (msg) msg.textContent = '';
  if (!container) return;

  const categories = buildCategoryComparison(surveyA, surveyB);
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'results-table';
  table.innerHTML = '<thead><tr><th>Kink</th><th>Partner A</th><th>Partner B</th></tr></thead>';
  const tbody = document.createElement('tbody');

  const makeTd = percent => {
    const td = document.createElement('td');
    const pct = percent === null ? 0 : percent;
    const cls = colorClass(percent ?? 0);
    td.innerHTML =
      `<div class="bar-container"><div class="bar ${cls}" style="width: ${pct}%"></div></div>` +
      `<div class="percent-label">${percent === null ? '-' : percent + '%'}</div>`;
    return td;
  };

  categories.forEach(cat => {
    const row = document.createElement('tr');
    row.className = 'row';
    const fullLabel = cat.name;
    row.setAttribute('data-key', compatNormalizeKey(fullLabel));
    const nameTd = document.createElement('td');
    nameTd.className = 'kink-name';
    const icons = buildCategoryIcons(cat.you, cat.partner);
    nameTd.innerHTML = icons ? `${cat.name} ${icons}` : cat.name;
    const hidden = document.createElement('span');
    hidden.className = 'full-label';
    hidden.textContent = fullLabel;
    hidden.hidden = true;
    nameTd.appendChild(hidden);
    row.appendChild(nameTd);
    row.appendChild(makeTd(cat.you));
    row.appendChild(makeTd(cat.partner));
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  const breakdown = buildKinkBreakdown(surveyA, surveyB);
  const pdfCategories = Object.entries(breakdown).map(([category, items]) => ({
    category,
    items: items.map(it => ({
      label: it.name,
      a: maxRating(it.you),
      b: maxRating(it.partner)
    }))
  }));
  const compat = calculateCompatibility(surveyA, surveyB);
  const history = addHistoryEntry(compat.compatibilityScore);
  const compatData = { categories: pdfCategories, history };
  latestCompatData = compatData;
  window.compatibilityData = compatData;
  refreshDownloadAvailability();
}

