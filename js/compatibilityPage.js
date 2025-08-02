// Dark mode PDF export styling script using html2canvas and jsPDF
import { initTheme, applyPrintStyles } from './theme.js';
import { loadJsPDF } from './loadJsPDF.js';

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
  if (percent >= 80) return 'green';
  if (percent >= 60) return 'yellow';
  return 'red';
}

function barFillColor(percent) {
  if (percent >= 80) return '#00c853';
  if (percent >= 60) return '#fbc02d';
  return '#d32f2f';
}


function makeBar(percent) {
  const outer = document.createElement('div');
  outer.className = 'partner-bar';
  const fill = document.createElement('div');
  fill.className = 'partner-fill ' + colorClass(percent ?? 0);
  fill.style.width = percent === null ? '0%' : percent + '%';
  fill.style.backgroundColor = barFillColor(percent ?? 0);
  outer.appendChild(fill);
  const text = document.createElement('span');
  text.className = 'partner-text ' + colorClass(percent ?? 0);
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


async function generateComparisonPDF() {
  document.body.classList.add('exporting');
  let mode = 'dark';
  if (document.body.classList.contains('theme-lipstick')) mode = 'lipstick';
  else if (document.body.classList.contains('theme-forest')) mode = 'forest';
  applyPrintStyles(mode);
  const container = document.getElementById('pdf-container');
  const element = document.getElementById('compatibility-wrapper');
  if (!container || !element) return;
  window.scrollTo(0, 0);

  // ensure the export container has no margin or padding and a black background
  container.style.margin = '0 auto';
  container.style.padding = '0';
  container.style.background = '#000';
  container.style.paddingBottom = '0';

  const jsPDF = await loadJsPDF();
  const width = element.scrollWidth;
  const height = element.scrollHeight;
  const pdf = new jsPDF({
    unit: 'px',
    format: [width, height],
    orientation: 'landscape'
  });

  // fill the first page background with pure black
  pdf.setFillColor(0, 0, 0);
  pdf.rect(0, 0, width, height, 'F');

  const opt = {
    margin: 0,
    filename: 'kink-compatibility-results.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000000',
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height,
      logging: false,
      allowTaint: true,
      crossOrigin: 'anonymous'
    },
    pagebreak: { mode: ['avoid-all'] },
    jsPDF: pdf
  };

  const worker = html2pdf().set(opt).from(element).toPdf();
  await worker.get('pdf');

  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    // ensure each page background is pure black
    pdf.setFillColor(0, 0, 0);
    pdf.rect(0, 0, width, height, 'F');
  }

  await worker.save();
  document.body.classList.remove('exporting');
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
      updateComparison();
    } catch (err) {
      console.warn('Failed to load Survey B:', err);
      alert('Invalid JSON for Survey B.\nPlease upload the unmodified JSON file exported from this site.');
    }
  };
  reader.readAsText(file);
}
function updateComparison() {
  const container = document.getElementById('compatibility-report');
  const msg = document.getElementById('comparisonResult');
  if (!surveyA || !surveyB) {
    msg.textContent = surveyA || surveyB ? 'Please upload both surveys to compare.' : '';
    container.innerHTML = '';
    lastResult = null;
    return;
  }
  msg.textContent = '';
  lastResult = buildKinkBreakdown(surveyA, surveyB);
  container.innerHTML = '';

  const mergedKinkData = [];
  Object.entries(lastResult).forEach(([category, items]) => {
    items.forEach(it => {
      mergedKinkData.push({
        category,
        name: it.name,
        partnerA: maxRating(it.you),
        partnerB: maxRating(it.partner)
      });
    });
  });

  const groupedData = groupKinksByCategory(mergedKinkData);

  const table = document.createElement('table');
  table.className = 'results-table';
  table.innerHTML = '<thead><tr><th>Kink</th><th>Partner A</th><th>Partner B</th></tr></thead>';
  const tbody = document.createElement('tbody');

  const renderCell = rating => {
    const percent = toPercent(rating);
    const pct = percent === null ? 0 : percent;
    const cls = colorClass(percent ?? 0);
    const td = document.createElement('td');
    td.innerHTML = `<div class="bar-container"><div class="bar ${cls}" style="width: ${pct}%"></div></div>` +
      `<div class="percent-label">${percent === null ? '-' : percent + '%'}</div>`;
    return td;
  };

  for (const [category, kinks] of Object.entries(groupedData)) {
    const catRow = document.createElement('tr');
    catRow.innerHTML = `
      <td colspan="3" class="category-header"><strong>${category}</strong></td>
    `;
    tbody.appendChild(catRow);

    kinks.forEach(kink => {
      const row = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = kink.name;
      row.appendChild(nameTd);
      row.appendChild(renderCell(kink.partnerA));
      row.appendChild(renderCell(kink.partnerB));
      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  container.appendChild(table);

  const cardList = document.getElementById('print-card-list');
  if (cardList) cardList.innerHTML = '';
}


function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (input.id === 'uploadUser') {
    loadFileA(file);
  } else if (input.id === 'uploadPartner') {
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
  const btn = document.getElementById('downloadPdfBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const spinner = document.getElementById('loading-spinner');
      if (spinner) spinner.style.display = 'flex';
      try {
        await generateComparisonPDF();
      } finally {
        if (spinner) spinner.style.display = 'none';
      }
    });
  }
});
