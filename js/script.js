import { calculateCompatibility } from './compatibility.js';
import { pruneSurvey } from './pruneSurvey.js';

// ================== Password Protection ==================
const PASSWORD = 'toopoortosue';

function setupPasswordProtection() {
  if (sessionStorage.getItem('authenticated') === 'true') return;
  const overlay = document.getElementById('passwordOverlay');
  overlay.style.display = 'flex';
  document.getElementById('passwordSubmit').onclick = () => {
    const val = document.getElementById('passwordInput').value;
    if (val === PASSWORD) {
      sessionStorage.setItem('authenticated', 'true');
      overlay.style.display = 'none';
    } else {
      alert('Incorrect password');
    }
  };
}

setupPasswordProtection();

// ================== Theme Setup ==================
const themeSelector = document.getElementById('themeSelector');

const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
document.body.className = savedTheme;
themeSelector.value = savedTheme;

themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
});


// ================== Tab Switching ==================
let currentAction = 'Giving';
const ACTION_LABELS = {
  Giving: 'Giving',
  Receiving: 'Receiving',
  General: 'Neutral'
};
const RATING_MAX = 5;
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
  renderMainCategories();
  const cats = showCategories();
  if (!cats.includes(currentCategory)) {
    currentCategory = null;
  }
  if (currentCategory) {
    showKinks(currentCategory);
  } else {
    subCategoryWrapper.style.display = 'none';
    categoryPanel.classList.remove('extended');
  }
  applyAnimation(categoryContainer, 'fade-in');
}

function renderMainCategories() {
  mainCategoryList.innerHTML = '';
  ['Giving', 'Receiving', 'General'].forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = ACTION_LABELS[action] || action;
    if (action === currentAction) btn.classList.add('active');
    btn.onclick = () => switchTab(action);
    attachRipple(btn);
    mainCategoryList.appendChild(btn);
  });
}

document.getElementById('givingTab').onclick = () => switchTab('Giving');
document.getElementById('receivingTab').onclick = () => switchTab('Receiving');
document.getElementById('generalTab').onclick = () => switchTab('General');

// ================== Survey Logic ==================
let surveyA = null;
let surveyB = null;
let currentCategory = null;

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


const mainCategoryList = document.getElementById('mainCategoryList');
const categoryContainer = document.getElementById('categoryContainer');
const kinkList = document.getElementById('kinkList');
const categoryPanel = document.getElementById('categoryPanel');
const subCategoryWrapper = document.getElementById('subCategoryWrapper');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const closeSubSidebarBtn = document.getElementById('closeSubSidebarBtn');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const ratingLegend = document.getElementById('ratingLegend');
const categoryOverlay = document.getElementById('categoryOverlay');
const roleDefinitionsPanel = document.getElementById('roleDefinitionsPanel');
const roleDefinitionsOverlay = document.getElementById('roleDefinitionsOverlay');
const roleDefinitionsBtn = document.getElementById('roleDefinitionsBtn');
const closeRoleDefinitionsBtn = document.getElementById('closeRoleDefinitionsBtn');

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

function showOverlay() {
  if (window.innerWidth <= 768) {
    categoryOverlay.style.display = 'block';
  }
}

function hideOverlay() {
  categoryOverlay.style.display = 'none';
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

categoryPanel.style.display = 'none'; // Hide by default
subCategoryWrapper.style.display = 'none';
openSidebarBtn.style.display = 'none';

openSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.add('visible');
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
  showOverlay();
  openSidebarBtn.style.display = 'none';
});

closeSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.remove('visible');
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
  hideOverlay();
  if (window.innerWidth <= 768) openSidebarBtn.style.display = 'block';
});

closeSubSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
});

categoryOverlay.addEventListener('click', () => {
  categoryPanel.classList.remove('visible');
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
  hideOverlay();
  if (window.innerWidth <= 768) openSidebarBtn.style.display = 'block';
});

roleDefinitionsBtn.addEventListener('click', showRolePanel);
closeRoleDefinitionsBtn.addEventListener('click', hideRolePanel);
roleDefinitionsOverlay.addEventListener('click', hideRolePanel);

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
      categoryPanel.style.display = 'block';
      subCategoryWrapper.style.display = 'none';
      categoryPanel.classList.remove('extended');
      openSidebarBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
      renderMainCategories();
      showCategories();
    } catch {
      alert('Invalid JSON for Survey A.');
    }
  };
  reader.readAsText(file);
}

document.getElementById('fileA').addEventListener('change', e => {
  loadSurveyAFile(e.target.files[0]);
});

document.getElementById('fileB').addEventListener('change', e => {
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


document.getElementById('newSurveyBtn').addEventListener('click', () => {

  const initialize = data => {
    surveyA = data;
    normalizeRatings(surveyA);
    filterGeneralOptions(surveyA);
    updateTabsForCategory();
    categoryPanel.style.display = 'block'; // Show sidebar
    subCategoryWrapper.style.display = 'none';
    categoryPanel.classList.remove('extended');
    openSidebarBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    if (window.innerWidth <= 768) {
      categoryPanel.classList.add('visible');
      showOverlay();
      openSidebarBtn.style.display = 'none';
    }
    renderMainCategories();
    showCategories();
  };

  fetch('template-survey.json', { cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      window.templateSurvey = normalizeSurveyFormat(data); // cache latest template
      // use a fresh copy so future resets aren't mutated
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
});

// ================== Category + Kink Display ==================

function showCategories() {
  categoryContainer.innerHTML = '';
  if (!surveyA) return [];

  const categories = Object.keys(surveyA);
  const available = [];

  categories.forEach(cat => {
    const items = surveyA[cat][currentAction];
    const hasItems = Array.isArray(items) && items.length > 0;
    if (hasItems) available.push(cat);

    const createButton = () => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      if (cat === currentCategory) btn.classList.add('active');
      if (!hasItems) {
        btn.classList.add('disabled');
      }
      btn.onclick = () => {
        if (currentCategory === cat) return;
        currentCategory = cat;
        showCategories();
        if (hasItems) {
          showKinks(cat);
        } else {
          subCategoryWrapper.style.display = 'none';
          categoryPanel.classList.remove('extended');
        }
        
      };
      attachRipple(btn);
      return btn;
    };

    categoryContainer.appendChild(createButton());
  });
  applyAnimation(categoryContainer, 'fade-in');
  return available;
}

function showKinks(category) {
  currentCategory = category;
  kinkList.innerHTML = '';
  const categoryData = surveyA[category];
  updateTabsForCategory();
  const kinks = categoryData?.[currentAction];
  subCategoryWrapper.style.display = 'block';
  categoryPanel.classList.add('extended');
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
        opt.textContent = i;
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

// ================== Export My List ==================
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!surveyA) {
    alert('No survey loaded.');
    return;
  }
  const exportObj = { survey: pruneSurvey(surveyA) };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kink-survey.json';
  a.click();
  URL.revokeObjectURL(url);
  // Finished export
});

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

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button').forEach(attachRipple);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    hideOverlay();
    categoryPanel.classList.remove('visible');
    openSidebarBtn.style.display = 'none';
    hideRolePanel();
  } else if (!categoryPanel.classList.contains('visible')) {
    openSidebarBtn.style.display = 'block';
  }
});

