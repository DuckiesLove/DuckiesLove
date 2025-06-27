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

function updateTabsForCategory(categoryData) {
  const generalTab = document.getElementById('neutralTab');
  generalTab.style.display = 'block';
  if (categoryData.Neutral && categoryData.Neutral.length > 0) {
    generalTab.classList.remove('disabled');
    generalTab.title = '';
  } else {
    generalTab.classList.add('disabled');
    generalTab.title = 'No general options';
    // fallback to Giving tab if General isn't available
    if (currentAction === 'Neutral') {
      switchTab('Giving');
    }
  }
}

function switchTab(action) {
  currentAction = action;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${action.toLowerCase()}Tab`).classList.add('active');
  const cats = showCategories();
  if (!cats.includes(currentCategory)) {
    currentCategory = null;
  }
  if (currentCategory) {
    showKinks(currentCategory);
  } else if (cats.length > 0) {
    showKinks(cats[0]);
  }
  applyAnimation(kinkList, 'bounce-in');
}

document.getElementById('givingTab').onclick = () => switchTab('Giving');
document.getElementById('receivingTab').onclick = () => switchTab('Receiving');
document.getElementById('neutralTab').onclick = () => switchTab('Neutral');

// ================== Survey Logic ==================
let surveyA = null;
let surveyB = null;
let currentCategory = null;
let unsavedTimer = null;
const saveStatusEl = document.getElementById('saveStatus');

function updateSaveStatus() {
  const ts = localStorage.getItem('lastSaved');
  if (ts) {
    const d = new Date(ts);
    saveStatusEl.textContent = `Last Saved: ${d.toLocaleString()}`;
    saveStatusEl.classList.remove('unsaved');
  } else {
    saveStatusEl.textContent = '';
  }
}

function saveProgress() {
  if (!surveyA) return;
  localStorage.setItem('savedSurvey', JSON.stringify(surveyA));
  localStorage.setItem('lastSaved', new Date().toISOString());
  updateSaveStatus();
}

// Remove any Neutral items from Giving/Receiving so tabs never mix options
function filterGeneralOptions(survey) {
  Object.values(survey).forEach(cat => {
    if (!cat.Neutral) return;
    const neutralNames = new Set(cat.Neutral.map(k => k.name.trim().toLowerCase()));
    ['Giving', 'Receiving'].forEach(role => {
      if (Array.isArray(cat[role])) {
        cat[role] = cat[role].filter(k => !neutralNames.has(k.name.trim().toLowerCase()));
      }
    });
  });
}

function markUnsaved() {
  saveStatusEl.textContent = 'Unsaved changes...';
  saveStatusEl.classList.add('unsaved');
  clearTimeout(unsavedTimer);
  unsavedTimer = setTimeout(saveProgress, 1000);
}

const categoryContainer = document.getElementById('categoryContainer');
const kinkList = document.getElementById('kinkList');
const categoryPanel = document.getElementById('categoryPanel');
const subCategoryWrapper = document.getElementById('subCategoryWrapper');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const closeSubSidebarBtn = document.getElementById('closeSubSidebarBtn');

categoryPanel.style.display = 'none'; // Hide by default
subCategoryWrapper.style.display = 'none';
toggleSidebarBtn.style.display = 'none';

toggleSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.toggle('visible');
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
});

closeSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.remove('visible');
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
});

closeSubSidebarBtn.addEventListener('click', () => {
  categoryPanel.classList.remove('extended');
  subCategoryWrapper.style.display = 'none';
});

document.getElementById('fileA').addEventListener('change', (e) => {
  localStorage.removeItem('savedSurvey');
  localStorage.removeItem('lastSaved');
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      surveyA = parsed.survey || parsed;
      filterGeneralOptions(surveyA);
      categoryPanel.style.display = 'block';
      subCategoryWrapper.style.display = 'none';
      categoryPanel.classList.remove('extended');
      toggleSidebarBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
      showCategories();
      saveProgress();
    } catch {
      alert('Invalid JSON for Survey A.');
    }
  };
  reader.readAsText(e.target.files[0]);
});

document.getElementById('fileB').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      surveyB = parsed.survey || parsed;
      filterGeneralOptions(surveyB);
    } catch {
      alert('Invalid JSON for Survey B.');
    }
  };
  reader.readAsText(e.target.files[0]);
});

document.getElementById('newSurveyBtn').addEventListener('click', () => {
  localStorage.removeItem('savedSurvey');
  localStorage.removeItem('lastSaved');
  fetch('template-survey.json')
    .then(res => res.json())
    .then(data => {
      surveyA = data;
      filterGeneralOptions(surveyA);
      categoryPanel.style.display = 'block'; // Show sidebar
      subCategoryWrapper.style.display = 'none';
      categoryPanel.classList.remove('extended');
      toggleSidebarBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
      showCategories();
      saveProgress();
    })
    .catch(err => alert('Failed to load template: ' + err.message));
});

// ================== Category + Kink Display ==================
function showCategories() {
  categoryContainer.innerHTML = '';
  if (!surveyA) return [];

  const available = Object.keys(surveyA).filter(cat => {
    if (cat === 'Other' && currentAction !== 'Neutral') {
      return false;
    }
    const items = surveyA[cat][currentAction];
    return Array.isArray(items) && items.length > 0;
  });

  available.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    if (cat === currentCategory) btn.classList.add('active');
    btn.onclick = () => {
      if (currentCategory === cat) return;
      currentCategory = cat;
      showCategories();
      showKinks(cat);
      if (window.innerWidth <= 768) {
        categoryPanel.classList.remove('visible');
      }
    };
    attachRipple(btn);
    categoryContainer.appendChild(btn);
  });
  applyAnimation(categoryContainer, 'fade-in');
  return available;
}

function showKinks(category) {
  currentCategory = category;
  kinkList.innerHTML = '';
  const categoryData = surveyA[category];
  updateTabsForCategory(categoryData);
  const kinks = categoryData?.[currentAction];
  subCategoryWrapper.style.display = 'block';
  categoryPanel.classList.add('extended');
  if (!kinks || kinks.length === 0) {
    kinkList.textContent = 'No items here.';
    return;
  }

  kinks.forEach(kink => {
    const container = document.createElement('div');
    container.style.marginBottom = '10px';

    const label = document.createElement('span');
    label.textContent = kink.name + ': ';
    container.appendChild(label);

    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    select.appendChild(empty);

    for (let i = 1; i <= 6; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      if (kink.rating == i) opt.selected = true;
      select.appendChild(opt);
    }

    select.onchange = () => {
      kink.rating = select.value === '' ? null : Number(select.value);
      markUnsaved();
    };

    container.appendChild(select);
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
  const exportObj = { survey: surveyA };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kink-survey.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ================== See Our Compatibility ==================
document.getElementById('compareBtn').addEventListener('click', () => {
  if (!confirm('Have you reviewed consent with your partner?')) return;
  const resultDiv = document.getElementById('comparisonResult');
  resultDiv.innerHTML = '';

  if (!surveyA || !surveyB) {
    resultDiv.textContent = 'Please upload both surveys.';
    return;
  }

  const categories = Object.keys(surveyA);
  let totalScore = 0;
  let count = 0;
  let redFlags = [];
  let yellowFlags = [];

  categories.forEach(category => {
    if (!surveyB[category]) return;

    ['Giving', 'Receiving', 'Neutral'].forEach(action => {
      const listA = surveyA[category][action] || [];
      const listB = surveyB[category][
        action === 'Giving' ? 'Receiving' :
        action === 'Receiving' ? 'Giving' : 'Neutral'
      ] || [];

      listA.forEach(itemA => {
        const match = listB.find(itemB =>
          itemB.name.trim().toLowerCase() === itemA.name.trim().toLowerCase()
        );
        if (match) {
          const ratingA = parseInt(itemA.rating);
          const ratingB = parseInt(match.rating);
          if (Number.isInteger(ratingA) && Number.isInteger(ratingB)) {
            const diff = Math.abs(ratingA - ratingB);
            totalScore += Math.max(0, 100 - diff * 20);
            count++;
            if ((ratingA === 6 && ratingB === 1) || (ratingA === 1 && ratingB === 6)) {
              redFlags.push(itemA.name);
            } else if (
              (ratingA === 6 && ratingB === 2) || (ratingA === 2 && ratingB === 6) ||
              (ratingA === 5 && ratingB === 1) || (ratingA === 1 && ratingB === 5)
            ) {
              yellowFlags.push(itemA.name);
            }
          }
        }
      });
    });
  });

  const avg = count ? Math.round(totalScore / count) : 0;
  let output = `<h3>Compatibility Score: ${avg}%</h3>`;

  // Similarity Score (same role)
  let simScore = 0;
  let simCount = 0;
  categories.forEach(category => {
    if (!surveyB[category]) return;
    ['Giving', 'Receiving', 'Neutral'].forEach(action => {
      const listA = surveyA[category][action] || [];
      const listB = surveyB[category][action] || [];
      listA.forEach(itemA => {
        const match = listB.find(itemB =>
          itemB.name.trim().toLowerCase() === itemA.name.trim().toLowerCase()
        );
        if (match) {
          const ratingA = parseInt(itemA.rating);
          const ratingB = parseInt(match.rating);
          if (Number.isInteger(ratingA) && Number.isInteger(ratingB)) {
            const diff = Math.abs(ratingA - ratingB);
            simScore += Math.max(0, 100 - diff * 20);
            simCount++;
          }
        }
      });
    });
  });

  const avgSim = simCount ? Math.round(simScore / simCount) : 0;
  output += `<h4>Similarity Score: ${avgSim}%</h4>`;

  if (redFlags.length) {
    output += `<p>🚩 Red flags: ${[...new Set(redFlags)].join(', ')}</p>`;
  }
  if (yellowFlags.length) {
    output += `<p>⚠️ Yellow flags: ${[...new Set(yellowFlags)].join(', ')}</p>`;
  }

  resultDiv.innerHTML = output;
});

// ================== Start ==================
switchTab('Giving');

// Resume previous session if available
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('savedSurvey');
  if (saved && !surveyA) {
    if (confirm('Resume unfinished survey?')) {
      surveyA = JSON.parse(saved);
      filterGeneralOptions(surveyA);
      categoryPanel.style.display = 'block';
      subCategoryWrapper.style.display = 'none';
      categoryPanel.classList.remove('extended');
      toggleSidebarBtn.style.display = window.innerWidth <= 768 ? 'block' : 'none';
      showCategories();
    } else {
      localStorage.removeItem('savedSurvey');
      localStorage.removeItem('lastSaved');
    }
  }
  updateSaveStatus();
  document.querySelectorAll('button').forEach(attachRipple);
});
