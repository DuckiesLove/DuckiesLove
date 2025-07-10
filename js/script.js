import { calculateCompatibility } from './compatibility.js';
import { pruneSurvey } from './pruneSurvey.js';

// ================== Password Protection ==================
const PASSWORD = 'toopoortosue';

function setupPasswordProtection(callback) {
  const overlay = document.getElementById('passwordOverlay');
  if (sessionStorage.getItem('authenticated') === 'true') {
    if (overlay) overlay.style.display = 'none';
    if (typeof callback === 'function') callback();
    return;
  }
  overlay.style.display = 'flex';
  document.getElementById('passwordSubmit').onclick = () => {
    const val = document.getElementById('passwordInput').value;
    if (val === PASSWORD) {
      sessionStorage.setItem('authenticated', 'true');
      overlay.style.display = 'none';
      if (typeof callback === 'function') callback();
    } else {
      alert('Incorrect password');
    }
  };
}

// ================== Theme Setup ==================
function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
  document.body.className = savedTheme;
  if (themeSelector) {
    themeSelector.value = savedTheme;
    themeSelector.addEventListener('change', function () {
      const selectedTheme = themeSelector.value;
      document.body.className = selectedTheme;
      localStorage.setItem('selectedTheme', selectedTheme);
    });
  }
}


// ================== Tab Switching ==================
let currentAction = 'Giving';
const ACTION_LABELS = {
  Giving: 'Giving',
  Receiving: 'Receiving',
  General: 'Non-Specific Role'
};
const RATING_MAX = 5;
const RATING_LABELS = {
  0: 'Hard No',
  1: 'Dislike / Haven\u2019t Considered',
  2: 'Would Try for Partner',
  3: 'Okay / Neutral',
  4: 'Like',
  5: 'Love / Core Interest'
};
const HIGH_INTENSITY_CATEGORY = 'High-Intensity Kinks (SSC-Aware)';
const HIGH_INTENSITY_WARNING =
  'The High-Intensity Kinks category includes intense but SSC-aware kink options that require strong negotiation, emotional readiness, and safe aftercare. Only explore if you feel prepared.';


function applyAnimation(el, cls) {
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function createRipple(e) {
  const button = e.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
  circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
  circle.classList.add('ripple');
  const ripple = button.querySelector('.ripple');
  if (ripple) ripple.remove();
  button.appendChild(circle);
}

function attachRipple(btn) {
  btn.addEventListener('click', createRipple);
}

function updateTabsForCategory() {
  const generalTab = document.getElementById('generalTab');
  if (!surveyA) {
    generalTab.style.display = 'none';
    return;
  }

  const hasGeneral = Object.values(surveyA).some(
    cat => Array.isArray(cat.General) && cat.General.length > 0
  );

  if (hasGeneral) {
    generalTab.style.display = 'block';
    generalTab.classList.remove('disabled');
    generalTab.title = '';
  } else {
    generalTab.style.display = 'none';
    if (currentAction === 'General') switchTab('Giving');
  }
}

function switchTab(action) {
  currentAction = action;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  const tabEl = document.getElementById(`${action.toLowerCase()}Tab`);
  if (tabEl) tabEl.classList.add('active');
  const cats = showCategories();
  if (!cats.includes(currentCategory)) {
    currentCategory = null;
  }
  if (currentCategory) {
    showKinks(currentCategory);
  } else {
    kinkList.innerHTML = '';
    categoryTitle.textContent = '';
  }
  applyAnimation(kinkList, 'fade-in');
}

document.getElementById('givingTab').onclick = () => switchTab('Giving');
document.getElementById('receivingTab').onclick = () => switchTab('Receiving');
document.getElementById('generalTab').onclick = () => switchTab('General');

// ================== Survey Logic ==================
let surveyA = null;
let surveyB = null;
let currentCategory = null;
let guidedMode = false;
let categoryOrder = [];
let categoryIndex = 0;

// Remove any General items from Giving/Receiving so tabs never mix options
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

// Constrain legacy ratings to the current 0–5 scale
function normalizeRatings(survey) {
  Object.values(survey).forEach(cat => {
    ['Giving', 'Receiving', 'General'].forEach(role => {
      if (Array.isArray(cat[role])) {
        cat[role].forEach(item => {
          if (typeof item.rating === 'number') {
            if (item.rating > RATING_MAX) item.rating = RATING_MAX;
            if (item.rating < 0) item.rating = 0;
          }
        });
      }
    });
  });
}

// Convert a template with only top-level roles into a single-category structure
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

// Ensure a survey object includes all categories and items from the template
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


const kinkList = document.getElementById('kinkList');
const categoryTitle = document.getElementById('categoryTitle');
const surveyContainer = document.getElementById('surveyContainer');
const finalScreen = document.getElementById('finalScreen');
const saveSurveyBtn = document.getElementById('saveSurveyBtn');
const returnHomeBtn = document.getElementById('returnHomeBtn');
const homeBtn = document.getElementById('homeBtn');
const buttonGroup = document.querySelector('.button-group');
const categoryOverlay = document.getElementById('categoryOverlay');
const categoryPanel = document.getElementById('categoryPanel');
const previewList = document.getElementById('previewList');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const templateJson = document.getElementById('templateJson');
const beginSurveyBtn = document.getElementById('beginSurveyBtn');
const ratingLegend = document.getElementById('ratingLegend');
const roleDefinitionsPanel = document.getElementById('roleDefinitionsPanel');
const roleDefinitionsOverlay = document.getElementById('roleDefinitionsOverlay');
const roleDefinitionsBtn = document.getElementById('roleDefinitionsBtn');
const closeRoleDefinitionsBtn = document.getElementById('closeRoleDefinitionsBtn');
const surveyIntro = document.getElementById('surveyIntro');
const startSurveyBtn = document.getElementById('startSurveyBtn');
const categoryDescription = document.getElementById('categoryDescription');
const newSurveyBtn = document.getElementById('newSurveyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressBanner = document.getElementById('progressBanner');
const progressLabel = document.getElementById('progressLabel');
const progressFill = document.getElementById('progressFill');
const nextCategoryBtn = document.getElementById('nextCategoryBtn');
const skipCategoryBtn = document.getElementById('skipCategoryBtn');
const mainNavButtons = document.querySelector('.main-nav-buttons');

function showRatingLegend(target) {
  const rect = target.getBoundingClientRect();
  ratingLegend.style.top = `${rect.top + window.scrollY}px`;
  ratingLegend.style.left = `${rect.right + 10 + window.scrollX}px`;
  ratingLegend.style.display = 'block';
}

function hideRatingLegend() {
  ratingLegend.style.display = 'none';
}

function shouldDisplayItem(item) {
  return true;
}


function showRolePanel() {
  roleDefinitionsPanel.style.display = 'block';
  if (window.innerWidth <= 768) {
    roleDefinitionsPanel.classList.add('visible');
  }
  roleDefinitionsOverlay.style.display = 'block';
}

function hideRolePanel() {
  roleDefinitionsPanel.classList.remove('visible');
  roleDefinitionsPanel.style.display = 'none';
  roleDefinitionsOverlay.style.display = 'none';
}




roleDefinitionsBtn.addEventListener('click', showRolePanel);
closeRoleDefinitionsBtn.addEventListener('click', hideRolePanel);
roleDefinitionsOverlay.addEventListener('click', hideRolePanel);

function startNewSurvey() {
  guidedMode = true;
  if (newSurveyBtn) newSurveyBtn.style.display = 'none';
  if (downloadBtn) downloadBtn.style.display = 'none';
  if (homeBtn) homeBtn.style.display = 'block';
  if (mainNavButtons) mainNavButtons.style.display = 'none';

  categoryOverlay.style.display = 'flex';
  const initialize = data => {
    surveyA = data;
    normalizeRatings(surveyA);
    filterGeneralOptions(surveyA);
    updateTabsForCategory();
    previewList.innerHTML = '';
    Object.keys(surveyA).forEach(cat => {
      const label = document.createElement('label');
      label.className = 'category-card';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = cat;
      cb.checked = false;

      const updateSelected = () => {
        label.classList.toggle('selected', cb.checked);
      };

      label.addEventListener('click', e => {
        e.preventDefault();
        if (!cb.checked) {
          if (cat === HIGH_INTENSITY_CATEGORY) {
            if (confirm(HIGH_INTENSITY_WARNING)) {
              cb.checked = true;
            }
          } else {
            cb.checked = true;
          }
        } else {
          cb.checked = false;
        }
        updateSelected();
      });

      cb.addEventListener('change', updateSelected);

      label.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = ' ' + cat;
      label.appendChild(span);
      previewList.appendChild(label);
    });
    if (templateJson) {
      templateJson.textContent = JSON.stringify(surveyA, null, 2);
    }
  };

  if (location.protocol.startsWith('http')) {
    fetch('template-survey.json', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        window.templateSurvey = normalizeSurveyFormat(data);
        initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
      })
      .catch(err => {
        if (window.templateSurvey) {
          console.warn('Failed to load template, using embedded copy:', err);
          initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
        } else {
          alert('Failed to load template: ' + err.message);
        }
      });
  } else if (window.templateSurvey) {
    // When opened directly from the file system, use the embedded template
    initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
  } else {
    alert('Failed to load template: unsupported protocol');
  }
}

startSurveyBtn.addEventListener('click', () => {
  guidedMode = true;
  if (surveyIntro) surveyIntro.style.display = 'none';
  startNewSurvey();
});

if (newSurveyBtn) {
  newSurveyBtn.addEventListener('click', startNewSurvey);
}

if (selectAllBtn) {
  selectAllBtn.addEventListener('click', () => {
    previewList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.checked) {
        if (cb.value === HIGH_INTENSITY_CATEGORY) {
          if (confirm(HIGH_INTENSITY_WARNING)) {
            cb.checked = true;
          }
        } else {
          cb.checked = true;
        }
      }
      cb.dispatchEvent(new Event('change'));
    });
  });
}

if (deselectAllBtn) {
  deselectAllBtn.addEventListener('click', () => {
    previewList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
    });
  });
}

beginSurveyBtn.addEventListener('click', () => {
  categoryOrder = Array.from(previewList.querySelectorAll('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  categoryIndex = 0;
  currentCategory = categoryOrder[0] || null;
  categoryOverlay.style.display = 'none';
  if (currentCategory) {
    showKinks(currentCategory);
    updateProgress();
  }
});

saveSurveyBtn.addEventListener('click', exportSurvey);
returnHomeBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});
if (homeBtn) homeBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

if (nextCategoryBtn) nextCategoryBtn.addEventListener('click', nextCategory);
if (skipCategoryBtn) skipCategoryBtn.addEventListener('click', skipCategory);

function loadSurveyAFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      surveyA = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyA, window.templateSurvey);
      normalizeRatings(surveyA);
      filterGeneralOptions(surveyA);
      updateTabsForCategory();
      if (guidedMode) {
        categoryOrder = Object.keys(surveyA);
        categoryIndex = 0;
        currentCategory = categoryOrder[0] || null;
        if (currentCategory) {
          showKinks(currentCategory);
          updateProgress();
        }
      }
    } catch {
      alert('Invalid JSON for Survey A.');
    }
  };
  reader.readAsText(file);
}

const fileAInput = document.getElementById('fileA');
if (fileAInput) {
  fileAInput.addEventListener('change', e => {
    loadSurveyAFile(e.target.files[0]);
  });
}

const fileBInput = document.getElementById('fileB');
if (fileBInput) {
  fileBInput.addEventListener('change', e => {
    const fileInput = e.target;
    if (!fileInput.files.length) {
      return;
    }
  if (!confirm('Have you reviewed consent with your partner?')) {
    fileInput.value = '';
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
      } catch {
        alert('Invalid JSON for Survey B.');
      }
    };
    reader.readAsText(fileInput.files[0]);
  });
}




// ================== Category + Kink Display ==================

function showCategories() {
  if (!surveyA) return [];
  return Object.keys(surveyA);
}

function showKinks(category) {
  currentCategory = category;
  kinkList.innerHTML = '';
  categoryTitle.textContent = category;
  if (category === 'High-Intensity Kinks (SSC-Aware)') {
    categoryDescription.textContent = 'This category includes intense but SSC-aware kink options. These scenes require strong negotiation, emotional readiness, and safe aftercare. Only explore if you feel prepared.';
    categoryDescription.style.display = 'block';
  } else {
    categoryDescription.textContent = '';
    categoryDescription.style.display = 'none';
  }
  surveyContainer.style.display = 'block';
  finalScreen.style.display = 'none';
  const categoryData = surveyA[category];
  updateTabsForCategory();
  updateProgress();
  const kinks = categoryData?.[currentAction];
  if (!kinks || kinks.length === 0) {
    kinkList.textContent = 'No items here.';
    return;
  }

  const visible = kinks.filter(shouldDisplayItem);

  visible.forEach(kink => {
    const container = document.createElement('div');
    container.classList.add('kink-container');

    const label = document.createElement('span');
    label.classList.add('kink-label');
    label.textContent = kink.name + ':';
    container.appendChild(label);

    if (kink.type === 'text') {
      const textarea = document.createElement('textarea');
      textarea.value = kink.value || '';
      textarea.oninput = () => {
        kink.value = textarea.value;
      };
      container.appendChild(textarea);
    } else if (kink.type === 'multi') {
      kink.value = Array.isArray(kink.value) ? kink.value : [];
      kink.options.forEach(optText => {
        const lbl = document.createElement('label');
        lbl.style.marginRight = '8px';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = optText;
        cb.checked = kink.value.includes(optText);
        cb.onchange = () => {
          if (cb.checked) {
            if (!kink.value.includes(optText)) kink.value.push(optText);
          } else {
            kink.value = kink.value.filter(v => v !== optText);
          }
      };
        lbl.appendChild(cb);
        lbl.append(' ' + optText);
        container.appendChild(lbl);
      });
    } else if (kink.type === 'dropdown') {
      const select = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      select.appendChild(empty);
      kink.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (kink.value === o) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = () => {
        kink.value = select.value;
      };
      container.appendChild(select);
    } else {
      const select = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      select.appendChild(empty);
      for (let i = 0; i <= RATING_MAX; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i} - ${RATING_LABELS[i]}`;
        if (kink.rating == i) opt.selected = true;
        select.appendChild(opt);
      }
      select.onchange = () => {
        kink.rating = select.value === '' ? null : Number(select.value);
      };
      select.addEventListener('focus', () => showRatingLegend(select));
      select.addEventListener('blur', hideRatingLegend);
      select.addEventListener('mouseenter', () => showRatingLegend(select));
      select.addEventListener('mouseleave', hideRatingLegend);
      container.appendChild(select);
    }

    kinkList.appendChild(container);
  });
  applyAnimation(kinkList, 'fade-in');
}

function updateProgress() {
  if (!guidedMode || !categoryOrder.length) {
    progressBanner.style.display = 'none';
    return;
  }
  progressBanner.style.display = 'block';
  const total = categoryOrder.length;
  const percent = (categoryIndex / total) * 100;
  const remaining = total - categoryIndex - 1;
  progressLabel.textContent = `Category ${categoryIndex + 1} of ${total} (${remaining} left)`;
  progressFill.style.width = `${percent}%`;
}

function nextCategory() {
  if (!guidedMode) return;
  if (categoryIndex < categoryOrder.length - 1) {
    categoryIndex++;
    currentCategory = categoryOrder[categoryIndex];
    showKinks(currentCategory);
  } else {
    categoryIndex = categoryOrder.length;
    currentCategory = null;
    surveyContainer.style.display = 'none';
    finalScreen.style.display = 'flex';
    progressBanner.style.display = 'none';
  }
  updateProgress();
}

function skipCategory() {
  nextCategory();
}

// ================== Export My List ==================
function exportSurvey() {
  if (!surveyA) {
    alert('No survey loaded.');
    return;
  }
  const exportObj = {
    survey: pruneSurvey(surveyA),
    ratingLabels: RATING_LABELS
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `kink-survey-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  try {
    localStorage.setItem('savedSurvey', JSON.stringify(exportObj));
  } catch (err) {
    console.warn('Failed to save survey to localStorage:', err);
  }
}

if (downloadBtn) downloadBtn.addEventListener('click', exportSurvey);

// ================== See Our Compatibility ==================
const compareBtn = document.getElementById('compareBtn');
if (compareBtn) compareBtn.addEventListener('click', () => {
  const resultDiv = document.getElementById('comparisonResult');
  resultDiv.innerHTML = '';

  if (!surveyA) {
    resultDiv.textContent = 'Please upload your survey first.';
    return;
  }

  const runComparison = () => {
    const result = calculateCompatibility(surveyA, surveyB);
    let output = `<h3>Compatibility Score: ${result.compatibilityScore}%</h3>`;
    output += `<h4>Similarity Score: ${result.similarityScore}%</h4>`;
    if (result.redFlags.length) {
      output += `<p>🚩 Red flags: ${result.redFlags.join(', ')}</p>`;
    }
    if (result.yellowFlags.length) {
      output += `<p>⚠️ Yellow flags: ${result.yellowFlags.join(', ')}</p>`;
    }
    resultDiv.innerHTML = output;
  };

  if (!surveyB) {
    const fileInput = document.getElementById('fileB');
    if (!fileInput.files.length) {
      resultDiv.textContent = 'Please select a partner survey file.';
      return;
    }
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
        runComparison();
      } catch {
        alert('Invalid JSON for Survey B.');
      }
    };
    reader.readAsText(fileInput.files[0]);
  } else {
    runComparison();
  }
});

// ================== Start ==================
switchTab('Giving');

function init() {
  initTheme();
  document.querySelectorAll('button').forEach(attachRipple);
  startNewSurvey();
}

if (document.readyState !== 'loading') {
  setupPasswordProtection(init);
} else {
  window.addEventListener('DOMContentLoaded', () => setupPasswordProtection(init));
}


