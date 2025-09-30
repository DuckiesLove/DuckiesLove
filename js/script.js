import { calculateCompatibility } from './compatibility.js';
import { pruneSurvey } from './pruneSurvey.js';
import { initTheme, setTheme, applyPrintStyles } from './theme.js';

// ================== Password Protection ==================
const PASSWORD = 'BLSUCKS';

function setupPasswordProtection(callback) {
  const overlay = document.getElementById('passwordOverlay');

  // If there's no overlay on the page, authentication isn't required.
  if (!overlay) {
    if (typeof callback === 'function') callback();
    return;
  }

  if (sessionStorage.getItem('authenticated') === 'true') {
    overlay.style.display = 'none';
    if (typeof callback === 'function') callback();
    return;
  }

  overlay.style.display = 'flex';

  const submitBtn = document.getElementById('passwordSubmit');
  if (submitBtn) {
    submitBtn.onclick = () => {
      const input = document.getElementById('passwordInput');
      const val = input ? input.value : '';
      if (val === PASSWORD) {
        sessionStorage.setItem('authenticated', 'true');
        overlay.style.display = 'none';
        if (typeof callback === 'function') callback();
      } else {
        alert('Incorrect password');
      }
    };
  }
}

// ================== Theme Setup (handled in theme.js) ==================
const RATING_MAX = 5;
const RATING_LABELS = {
  0: 'Not for me / Hard Limit',
  1: 'Dislike / Haven\u2019t Considered',
  2: 'Would Try for Partner',
  3: 'Curious / Might Enjoy',
  4: 'Like / Regular Interest',
  5: 'Love / Core Interest'
};
const HIGH_INTENSITY_CATEGORY = 'High-Intensity Kinks (SSC-Aware)';
const HIGH_INTENSITY_WARNING =
  'The High-Intensity Kinks category includes intense but SSC-aware kink options that require strong negotiation, emotional readiness, and safe aftercare. Only explore if you feel prepared.';

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

function updateTabsForCategory() {}

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

// Set the orientation property of every item to an empty value
function resetItemOrientations(survey) {
  Object.values(survey).forEach(cat => {
    ['Giving', 'Receiving', 'General'].forEach(role => {
      if (Array.isArray(cat[role])) {
        cat[role].forEach(item => {
          item.orientation = '';
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
          const obj = { name: it.name, rating: null, orientation: '' };
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
// Some pages (like /index.html) don't include the panelContainer element used
// for the optional "all categories at once" view.  Grab it if present so the
// logic can gracefully skip related calls when it's missing.
const panelContainer = document.getElementById('panelContainer');
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
const startSurveyBtn = document.getElementById('startSurvey') || document.getElementById('startSurveyBtn');
const themeSelector = document.getElementById('themeSelector');
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

function getUnifiedItems(catData) {
  const map = new Map();
  ['Giving', 'Receiving', 'General'].forEach(role => {
    (catData[role] || []).forEach(it => {
      const key = it.name.trim().toLowerCase();
      let obj = map.get(key);
      if (!obj) {
        obj = { name: it.name, catData };
        map.set(key, obj);
      }
      obj[role] = it;
      if (typeof it.rating === 'number') obj.rating = it.rating;
      if (it.type) obj.type = it.type;
      if (it.options) obj.options = it.options;
      if (it.roles) obj.roles = it.roles;
      if (it.orientation !== undefined) obj.orientation = it.orientation;
    });
  });
  map.forEach(obj => {
    if (obj.orientation === undefined) {
      if (obj.Giving && obj.Receiving) obj.orientation = 'Both';
      else if (obj.Giving) obj.orientation = 'Giving';
      else if (obj.Receiving) obj.orientation = 'Receiving';
      else if (obj.General) obj.orientation = 'Both';
      else obj.orientation = '';
    }
    if (obj.rating === undefined) obj.rating = null;
  });
  return Array.from(map.values());
}

function setItemOrientation(info, val) {
  const cd = info.catData;
  const remove = (arr, obj) => {
    const idx = arr.indexOf(obj);
    if (idx > -1) arr.splice(idx, 1);
  };
  if (val !== '') {
    if (info.Giving) remove(cd.Giving, info.Giving);
    if (info.Receiving) remove(cd.Receiving, info.Receiving);
    if (info.General) remove(cd.General, info.General);
    info.Giving = info.Receiving = info.General = null;
  }
  info.orientation = val;
  if (info.Giving) info.Giving.orientation = val;
  if (info.Receiving) info.Receiving.orientation = val;
  if (info.General) info.General.orientation = val;
  if (val === 'Giving') {
    const o = { name: info.name, rating: info.rating, orientation: 'Giving' };
    if (info.type) o.type = info.type;
    if (info.options) o.options = info.options;
    if (info.roles) o.roles = info.roles;
    cd.Giving.push(o);
    info.Giving = o;
  } else if (val === 'Receiving') {
    const o = { name: info.name, rating: info.rating, orientation: 'Receiving' };
    if (info.type) o.type = info.type;
    if (info.options) o.options = info.options;
    if (info.roles) o.roles = info.roles;
    cd.Receiving.push(o);
    info.Receiving = o;
  } else if (val === 'Both') {
    const o1 = { name: info.name, rating: info.rating, orientation: 'Both' };
    const o2 = { name: info.name, rating: info.rating, orientation: 'Both' };
    if (info.type) {
      o1.type = info.type;
      o2.type = info.type;
    }
    if (info.options) {
      o1.options = info.options;
      o2.options = info.options;
    }
    if (info.roles) {
      o1.roles = info.roles;
      o2.roles = info.roles;
    }
    cd.Giving.push(o1);
    cd.Receiving.push(o2);
    info.Giving = o1;
    info.Receiving = o2;
  }
}

function setItemRating(info, val) {
  info.rating = val;
  if (info.Giving) info.Giving.rating = val;
  if (info.Receiving) info.Receiving.rating = val;
  if (info.General) info.General.rating = val;
}

function initializeSurvey(data) {
  surveyA = data;
  resetItemOrientations(surveyA);
  normalizeRatings(surveyA);
  filterGeneralOptions(surveyA);
  updateTabsForCategory();
  previewList.innerHTML = '';
  const categoryNames = Object.keys(surveyA).sort((a, b) => a.localeCompare(b));
  categoryNames.forEach(cat => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';
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
}

function loadSavedSurvey() {
  const saved = localStorage.getItem('savedSurvey');
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    const survey = normalizeSurveyFormat(parsed.survey || parsed);
    mergeSurveyWithTemplate(survey, window.templateSurvey);
    normalizeRatings(survey);
    filterGeneralOptions(survey);
    resetItemOrientations(survey);
    return survey;
  } catch (err) {
    console.warn('Failed to parse saved survey:', err);
    return null;
  }
}




if (roleDefinitionsBtn) roleDefinitionsBtn.addEventListener('click', showRolePanel);
if (closeRoleDefinitionsBtn) closeRoleDefinitionsBtn.addEventListener('click', hideRolePanel);
if (roleDefinitionsOverlay) roleDefinitionsOverlay.addEventListener('click', hideRolePanel);

async function startNewSurvey() {
  guidedMode = true;
  if (surveyIntro) surveyIntro.style.display = 'none';
  if (newSurveyBtn) newSurveyBtn.style.display = 'none';
  if (downloadBtn) downloadBtn.style.display = 'none';
  if (homeBtn) homeBtn.style.display = 'block';
  if (mainNavButtons) mainNavButtons.style.display = 'none';

  if (themeSelector) {
    setTheme(themeSelector.value);
  }

  categoryOverlay.style.display = 'flex';
  // Ensure the category selection panel is visible
  if (categoryPanel) categoryPanel.classList.remove('hidden');
  if (panelContainer) panelContainer.style.display = 'none';
  surveyContainer.style.display = 'none';
  finalScreen.style.display = 'none';
  if (exportControls) exportControls.style.display = 'none';
  progressBanner.style.display = 'none';
  const initialize = data => initializeSurvey(data);

  if (location.protocol.startsWith('http')) {
    try {
      const res = await fetch('../template-survey.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      window.templateSurvey = normalizeSurveyFormat(data);
      initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
    } catch (err) {
      if (window.templateSurvey) {
        console.warn('Failed to load template, using embedded copy:', err);
        initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
      } else {
        alert('Failed to load template: ' + err.message);
      }
    }
  } else if (window.templateSurvey) {
    // When opened directly from the file system, use the embedded template
    initialize(JSON.parse(JSON.stringify(window.templateSurvey)));
  } else {
    alert('Failed to load template: unsupported protocol');
  }
}

if (startSurveyBtn) {
  startSurveyBtn.addEventListener('click', () => {
    guidedMode = true;
    if (surveyIntro) surveyIntro.style.display = 'none';
    if (themeSelector) {
      setTheme(themeSelector.value);
    }
    startNewSurvey();
  });
}

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
  if (themeSelector) {
    setTheme(themeSelector.value);
  }
  categoryOrder = Array.from(previewList.querySelectorAll('input[type="checkbox"]'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  categoryIndex = 0;
  currentCategory = categoryOrder[0] || null;
  categoryOverlay.style.display = 'none';
  if (categoryOrder.length) {
    // When the page includes a panel container, show the expandable layout.
    // Otherwise fall back to the guided mode view starting with the first
    // selected category.
    if (panelContainer) {
      buildPanelLayout();
    } else if (currentCategory) {
      showKinks(currentCategory);
      updateProgress();
    }
    if (downloadBtn) downloadBtn.style.display = 'block';
  }
});

saveSurveyBtn.addEventListener('click', () => {
  exportSurvey().catch(err => {
    console.error('Export failed', err);
  });
});

function navigateHome() {
  // Always go to the main website
  const path = '/';
  window.location.href = path;
}

returnHomeBtn.addEventListener('click', navigateHome);
if (homeBtn) homeBtn.addEventListener('click', navigateHome);

if (nextCategoryBtn) nextCategoryBtn.addEventListener('click', nextCategory);
if (skipCategoryBtn) skipCategoryBtn.addEventListener('click', skipCategory);

function loadSurveyAFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = parseSurveyJSON(ev.target.result);
      surveyA = normalizeSurveyFormat(parsed.survey || parsed);
      mergeSurveyWithTemplate(surveyA, window.templateSurvey);
      normalizeRatings(surveyA);
      filterGeneralOptions(surveyA);
      updateTabsForCategory();
      if (guidedMode) {
        categoryOrder = Object.keys(surveyA).sort((a, b) => a.localeCompare(b));
        categoryIndex = 0;
        currentCategory = categoryOrder[0] || null;
        if (currentCategory) {
          showKinks(currentCategory);
          updateProgress();
        }
      }
    } catch {
        alert('Invalid JSON for Survey A.\nPlease upload the unmodified JSON file exported from this site.');
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
        const parsed = parseSurveyJSON(ev.target.result);
        surveyB = normalizeSurveyFormat(parsed.survey || parsed);
        mergeSurveyWithTemplate(surveyB, window.templateSurvey);
        normalizeRatings(surveyB);
        filterGeneralOptions(surveyB);
      } catch (err) {
        console.warn('Failed to load Survey B:', err);
        alert('Invalid JSON for Survey B.\nPlease upload the unmodified JSON file exported from this site.');
      }
    };
    reader.readAsText(fileInput.files[0]);
  });
}




// ================== Category + Kink Display ==================

function showCategories() {
  if (!surveyA) return [];
  return Object.keys(surveyA).sort((a, b) => a.localeCompare(b));
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
  if (exportControls) exportControls.style.display = 'none';
  const categoryData = surveyA[category];
  updateProgress();
  const items = getUnifiedItems(categoryData).filter(shouldDisplayItem);
  if (!items.length) {
    kinkList.textContent = 'No items here.';
    return;
  }

  items.forEach(info => {
    const container = document.createElement('div');
    container.classList.add('kink-container');

    const label = document.createElement('span');
    label.classList.add('kink-label');
    label.textContent = info.name;
    container.appendChild(label);

    const roleSelect = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '—';
    roleSelect.appendChild(blank);
    ['Giving', 'Receiving', 'Both'].forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (info.orientation === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.onchange = () => {
      setItemOrientation(info, roleSelect.value);
    };
    container.appendChild(roleSelect);

    const ratingSelect = document.createElement('select');
    const blankR = document.createElement('option');
    blankR.value = '';
    blankR.textContent = '—';
    ratingSelect.appendChild(blankR);
    for (let i = 0; i <= RATING_MAX; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} - ${RATING_LABELS[i]}`;
      if (info.rating == i) opt.selected = true;
      ratingSelect.appendChild(opt);
    }
    if (info.rating == null) {
      ratingSelect.value = '0';
      setItemRating(info, 0);
    }
    ratingSelect.onchange = () => {
      const val = ratingSelect.value === '' ? null : Number(ratingSelect.value);
      setItemRating(info, val);
    };
    ratingSelect.addEventListener('focus', () => showRatingLegend(ratingSelect));
    ratingSelect.addEventListener('blur', hideRatingLegend);
    ratingSelect.addEventListener('mouseenter', () => showRatingLegend(ratingSelect));
    ratingSelect.addEventListener('mouseleave', hideRatingLegend);
    container.appendChild(ratingSelect);

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
    if (exportControls) exportControls.style.display = 'flex';
    progressBanner.style.display = 'none';
    setTimeout(() => {
      downloadPDF();
    }, 0);
  }
  updateProgress();
}

function skipCategory() {
  nextCategory();
}

function renderPanelKinks(container, category) {
  const categoryData = surveyA[category];
  const items = getUnifiedItems(categoryData).filter(shouldDisplayItem);
  if (!items.length) {
    container.textContent = 'No items here.';
    return;
  }
  items.forEach(info => {
    const div = document.createElement('div');
    div.classList.add('kink-container');
    const label = document.createElement('span');
    label.classList.add('kink-label');
    label.textContent = info.name;
    div.appendChild(label);

    const roleSelect = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '—';
    roleSelect.appendChild(blank);
    ['Giving', 'Receiving', 'Both'].forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (info.orientation === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.onchange = () => setItemOrientation(info, roleSelect.value);
    div.appendChild(roleSelect);

    const ratingSelect = document.createElement('select');
    const blankR = document.createElement('option');
    blankR.value = '';
    blankR.textContent = '—';
    ratingSelect.appendChild(blankR);
    for (let i = 0; i <= RATING_MAX; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i} - ${RATING_LABELS[i]}`;
      if (info.rating == i) opt.selected = true;
      ratingSelect.appendChild(opt);
    }
    if (info.rating == null) {
      ratingSelect.value = '0';
      setItemRating(info, 0);
    }
    ratingSelect.onchange = () => {
      const val = ratingSelect.value === '' ? null : Number(ratingSelect.value);
      setItemRating(info, val);
    };
    ratingSelect.addEventListener('focus', () => showRatingLegend(ratingSelect));
    ratingSelect.addEventListener('blur', hideRatingLegend);
    ratingSelect.addEventListener('mouseenter', () => showRatingLegend(ratingSelect));
    ratingSelect.addEventListener('mouseleave', hideRatingLegend);
    div.appendChild(ratingSelect);

    container.appendChild(div);
  });
}

function buildPanelLayout() {
  if (!panelContainer) return;
  panelContainer.innerHTML = '';
  panelContainer.style.display = 'block';
  surveyContainer.style.display = 'none';
  finalScreen.style.display = 'none';
  if (exportControls) exportControls.style.display = 'none';
  progressBanner.style.display = 'none';
  const lastOpen = localStorage.getItem('lastPanel');
  categoryOrder.forEach((cat, idx) => {
    const details = document.createElement('details');
    details.className = 'expandable-panel';
    if (idx === 0 || lastOpen === cat) details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = cat;
    summary.addEventListener('click', e => {
      if (!details.open && cat === HIGH_INTENSITY_CATEGORY) {
        if (!confirm(HIGH_INTENSITY_WARNING)) {
          e.preventDefault();
          return;
        }
      }
    });
    details.addEventListener('toggle', () => {
      if (details.open) localStorage.setItem('lastPanel', cat);
    });
    const content = document.createElement('div');
    content.className = 'panel-content';
    renderPanelKinks(content, cat);
    details.appendChild(summary);
    details.appendChild(content);
    if (panelContainer) panelContainer.appendChild(details);
  });
}

// ================== Export My List ==================
async function downloadBlob(blob, filename) {
  const mime = blob.type && blob.type !== '' ? blob.type : 'application/octet-stream';
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const pickerOpts = {
        suggestedName: filename
      };
      if (ext) {
        pickerOpts.types = [{
          description: `${ext.toUpperCase().replace('.', '')} File`,
          accept: { [mime]: [ext] }
        }];
      }
      const handle = await window.showSaveFilePicker(pickerOpts);
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return false;
      }
      console.warn('showSaveFilePicker failed, falling back to download link', err);
    }
  }

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
  return true;
}

async function exportSurvey() {
  if (!surveyA) {
    alert('No survey loaded.');
    return;
  }
  const exportObj = {
    survey: pruneSurvey(surveyA),
    ratingLabels: RATING_LABELS
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
    type: 'application/json'
  });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const saved = await downloadBlob(blob, `kink-survey-${ts}.json`);
  try {
    localStorage.setItem('savedSurvey', JSON.stringify(exportObj));
  } catch (err) {
    console.warn('Failed to save survey to localStorage:', err);
  }
  if (saved) {
    // After exporting, send the user to the data tools page
    setTimeout(() => {
      window.location.href = '/data-tools.html';
    }, 0);
  }
}

if (downloadBtn) downloadBtn.addEventListener('click', () => {
  exportSurvey().catch(err => {
    console.error('Export failed', err);
  });
});

function downloadPDF() {
  document.body.classList.add('exporting');
  if (typeof window.downloadCompatibilityPDF === 'function') {
    window.downloadCompatibilityPDF().finally(() => {
      document.body.classList.remove('exporting');
    });
  } else {
    console.error('downloadCompatibilityPDF not available');
    document.body.classList.remove('exporting');
  }
}




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
        const parsed = parseSurveyJSON(ev.target.result);
        surveyB = normalizeSurveyFormat(parsed.survey || parsed);
        mergeSurveyWithTemplate(surveyB, window.templateSurvey);
        normalizeRatings(surveyB);
        filterGeneralOptions(surveyB);
        runComparison();
      } catch (err) {
        console.warn('Failed to load Survey B:', err);
        alert('Invalid JSON for Survey B.\nPlease upload the unmodified JSON file exported from this site.');
      }
    };
    reader.readAsText(fileInput.files[0]);
  } else {
    runComparison();
  }
});

// ================== Start ==================

function init() {
  initTheme();
  document.querySelectorAll('button').forEach(attachRipple);
  const saved = loadSavedSurvey();
  if (saved) {
    initializeSurvey(saved);
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has('start')) {
    startNewSurvey();
  }
}

if (document.readyState !== 'loading') {
  setupPasswordProtection(init);
} else {
  window.addEventListener('DOMContentLoaded', () => setupPasswordProtection(init));
}


