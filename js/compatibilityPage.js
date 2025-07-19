import { initTheme } from './theme.js';

let jsPDFLib = null;
async function loadJsPDF() {
  if (jsPDFLib) return jsPDFLib;
  if (window.jspdf && window.jspdf.jsPDF) {
    jsPDFLib = window.jspdf.jsPDF;
    return jsPDFLib;
  }
  await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
  jsPDFLib = window.jspdf.jsPDF;
  return jsPDFLib;
}

let surveyA = null;
let surveyB = null;
let lastResult = null;
const RATING_LABELS = {
  0: 'Hard No',
  1: 'Dislike / Haven\u2019t Considered',
  2: 'Would Try for Partner',
  3: 'Okay / Neutral',
  4: 'Like',
  5: 'Love / Core Interest'
};

function formatRating(val) {
  return val === null || val === undefined
    ? '-'
    : `${val} - ${RATING_LABELS[val]}`;
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
  const categories = Object.keys(surveyA);
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

async function generateComparisonPDF(breakdown) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 20;

  function toPercent(val) {
    return typeof val === 'number' ? Math.round((val / 5) * 100) : null;
  }

  function maxRating(obj) {
    const vals = [obj.giving, obj.receiving, obj.general].filter(v => typeof v === 'number');
    return vals.length ? Math.max(...vals) : null;
  }

  function getColorCode(percent) {
    if (percent >= 90) return '#00cc00'; // green
    if (percent >= 50) return '#ffaa00'; // orange
    if (percent > 0) return '#ff3333';   // red
    return '#bbbbbb';                   // gray
  }

  function drawVisualMark(doc, x, y, you, partner) {
    if (you >= 90 && partner >= 90) {
      doc.setTextColor('#00cc00');
      doc.text('⭐', x, y);
    } else if ((you === 0 && partner >= 80) || (partner === 0 && you >= 80)) {
      doc.setTextColor('#ff3333');
      doc.text('🚩', x, y);
    }
    doc.setTextColor('#000000');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Kink Compatibility Comparison', pageWidth / 2, y, { align: 'center' });
  y += 10;

  Object.entries(breakdown).forEach(([cat, list]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(cat, margin, y);
    y += 6;

    list.forEach(item => {
      const youP = toPercent(maxRating(item.you));
      const partnerP = toPercent(maxRating(item.partner));
      const barWidth = 40;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor('#000000');
      doc.text(item.name, margin, y);

      // "You" Bar
      if (youP !== null) {
        doc.setFillColor(getColorCode(youP));
        doc.rect(pageWidth / 2 - barWidth, y - 4, barWidth * (youP / 100), 5, 'F');
      }
      doc.text('You', pageWidth / 2 - barWidth - 8, y);

      // "Partner" Bar
      if (partnerP !== null) {
        doc.setFillColor(getColorCode(partnerP));
        doc.rect(pageWidth / 2 + 10, y - 4, barWidth * (partnerP / 100), 5, 'F');
      }
      doc.text('Partner', pageWidth / 2 + barWidth + 12, y);

      // Stars/Flags
      drawVisualMark(doc, pageWidth - margin - 10, y, youP, partnerP);

      y += 10;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    y += 6;
  });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  doc.save(`compatibility-${ts}.pdf`);
}

function loadFileA(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      surveyA = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyA, window.templateSurvey);
      normalizeRatings(surveyA);
      filterGeneralOptions(surveyA);
      updateComparison();
    } catch {
      alert('Invalid JSON for Survey A.');
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
      const parsed = JSON.parse(ev.target.result);
      surveyB = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyB, window.templateSurvey);
      normalizeRatings(surveyB);
      filterGeneralOptions(surveyB);
      updateComparison();
    } catch {
      alert('Invalid JSON for Survey B.');
    }
  };
  reader.readAsText(file);
}

function updateComparison() {
  const output = document.getElementById('comparisonResult');
  if (!surveyA || !surveyB) {
    output.textContent = surveyA || surveyB ? 'Please upload both surveys to compare.' : '';
    lastResult = null;
    return;
  }
  const kinkBreakdown = buildKinkBreakdown(surveyA, surveyB);
  lastResult = kinkBreakdown;
  output.innerHTML = '';

  Object.entries(kinkBreakdown).forEach(([cat, list]) => {
      const details = document.createElement('details');
      details.classList.add('accordion-panel');
      const summary = document.createElement('summary');
      summary.textContent = cat;
      details.appendChild(summary);

      const table = document.createElement('table');
      table.className = 'kink-table';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      ['Kink', 'You G', 'You R', 'You N', 'Partner G', 'Partner R', 'Partner N'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      list.forEach(item => {
        const tr = document.createElement('tr');
        const isMatch =
          item.you.giving === item.partner.receiving &&
          item.you.receiving === item.partner.giving &&
          item.you.general === item.partner.general;
        if (isMatch) tr.classList.add('match-row');
        const vals = [
          item.name,
          formatRating(item.you.giving),
          formatRating(item.you.receiving),
          formatRating(item.you.general),
          formatRating(item.partner.giving),
          formatRating(item.partner.receiving),
          formatRating(item.partner.general)
        ];
        vals.forEach(v => {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      details.appendChild(table);
      output.appendChild(details);
    });
}

const fileAInput = document.getElementById('fileA');
if (fileAInput) {
  fileAInput.addEventListener('change', e => {
    loadFileA(e.target.files[0]);
  });
}

const fileBInput = document.getElementById('fileB');
if (fileBInput) {
  fileBInput.addEventListener('change', e => {
    loadFileB(e.target.files[0]);
  });
}



const downloadBtn = document.getElementById('downloadResults');
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!surveyA || !surveyB) {
      alert('Please upload both surveys first.');
      return;
    }
    if (!lastResult) {
      lastResult = buildKinkBreakdown(surveyA, surveyB);
    }
    await generateComparisonPDF(lastResult);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedSurvey();
});
