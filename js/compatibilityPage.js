import { initTheme, applyPrintStyles } from './theme.js';

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
  applyPrintStyles();
  let jsPDF;
  try {
    await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    jsPDF = window.jspdf.jsPDF;
  } catch (err) {
    alert('Failed to load PDF library: ' + err.message);
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let y = 20;

  // bar layout sizing
  const barWidth = 40;
  const barGap = 5;

  function toPercent(val) {
    return typeof val === 'number' ? Math.round((val / 5) * 100) : null;
  }

  function getColor(p) {
    if (p === null) return '#CCCCCC';
    if (p >= 90) return '#00CC66';
    if (p >= 50) return '#FFA500';
    if (p > 0) return '#CC3333';
    return '#999999';
  }

  function maxRating(obj) {
    const vals = [obj.giving, obj.receiving, obj.general].filter(v => typeof v === 'number');
    return vals.length ? Math.max(...vals) : null;
  }

  function drawBar(doc, x, y, width, percent, color) {
    doc.setDrawColor('#CCCCCC');
    doc.rect(x, y, width, 5); // border
    if (percent !== null && percent > 0) {
      doc.setFillColor(color);
      doc.rect(x, y, width * (percent / 100), 5, 'F');
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Comparison', pageWidth / 2, y, { align: 'center' });
  y += 10;

  Object.entries(breakdown).forEach(([cat, list]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(cat, margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    list.forEach(item => {
      const youP = toPercent(maxRating(item.you));
      const partnerP = toPercent(maxRating(item.partner));

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor('#000000');
      doc.text(item.name, margin, y);

      // Bars for you and partner
      drawBar(doc, pageWidth / 2, y, barWidth, youP, getColor(youP));
      drawBar(doc, pageWidth / 2 + barWidth + barGap, y, barWidth, partnerP, getColor(partnerP));

      // Labels
      doc.setFontSize(8);
      doc.setTextColor('#333333');
      doc.text('You', pageWidth / 2 + barWidth / 2, y + 10, { align: 'center' });
      doc.text('Partner', pageWidth / 2 + barWidth + barGap + barWidth / 2, y + 10, { align: 'center' });

      // Icons
      const mutualMatch = youP !== null && partnerP !== null && youP >= 90 && partnerP >= 90;
      const hardMismatch = youP === 0 && partnerP === 0;

      if (mutualMatch) {
        doc.setFontSize(12);
        doc.setTextColor('#FFD700');
        doc.text('⭐', pageWidth - margin, y + 4);
      } else if (hardMismatch) {
        doc.setFontSize(12);
        doc.setTextColor('#FF0033');
        doc.text('🚩', pageWidth - margin, y + 4);
      }

      y += 14;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    y += 6;
  });

  doc.setFontSize(10);
  doc.setTextColor('#333333');
  doc.text(
    '⭐ = 90%+ match, 🚩 = 0% mismatch, Green = 90–100%, Orange = 50–89%, Red = 1–49%, Gray = Not Rated/0%',
    margin,
    pageHeight - 10
  );

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
  downloadBtn.addEventListener('click', () => {
    if (!surveyA || !surveyB) {
      alert('Please upload both surveys first.');
      return;
    }
    if (!lastResult) {
      lastResult = buildKinkBreakdown(surveyA, surveyB);
    }
    generateComparisonPDF(lastResult);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedSurvey();
});
