// Theme switching logic
const themeSelector = document.getElementById('themeSelector');
const savedTheme = localStorage.getItem('selectedTheme');

// Collect all banner references
const banners = {
  'theme-monster-prom': document.getElementById('monsterPromBanner'),
  'theme-outer-wilds': document.getElementById('outerWildsBanner'),
  'theme-blue': document.getElementById('blueBanner'),
  'theme-rainbow': document.getElementById('rainbowBanner'),
  'dark-mode': document.getElementById('darkBanner'),
  'light-mode': document.getElementById('lightBanner'),
};

if (savedTheme) {
  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
  updateBannerVisibility(savedTheme);
}

themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
  updateBannerVisibility(selectedTheme);
});

function updateBannerVisibility(theme) {
  Object.keys(banners).forEach(key => {
    if (banners[key]) {
      banners[key].style.display = key === theme ? 'block' : 'none';
    }
  });
}

// Tab switching logic
let currentAction = 'Giving';
let currentCategory = null;
let surveyA = null;

function switchTab(action) {
  currentAction = action;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  const activeTab = document.getElementById(`${action.toLowerCase()}Tab`);
  if (activeTab) activeTab.classList.add('active');

  showCategories();
  if (currentCategory) {
    showKinks(currentCategory);
  }
}

document.getElementById('givingTab')?.addEventListener('click', () => switchTab('Giving'));
document.getElementById('receivingTab')?.addEventListener('click', () => switchTab('Receiving'));
document.getElementById('neutralTab')?.addEventListener('click', () => switchTab('Neutral'));

// Load default template survey
document.getElementById('newSurveyBtn')?.addEventListener('click', () => {
  fetch('template-survey.json')
    .then(response => response.json())
    .then(data => {
      surveyA = data;
      showCategories();
    })
    .catch(error => alert('Failed to load survey template.'));
});

// Render categories
function showCategories() {
  const container = document.getElementById('categoryContainer');
  container.innerHTML = '';
  if (!surveyA) return;

  Object.keys(surveyA).forEach(category => {
    const btn = document.createElement('button');
    btn.textContent = category;
    if (currentCategory === category) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCategory = category;
      showCategories();
      showKinks(category);
    });
    container.appendChild(btn);
  });
}

// Render kinks for selected category + action
function showKinks(category) {
  const list = document.getElementById('kinkList');
  list.innerHTML = '';
  if (!surveyA || !surveyA[category]) return;

  const items = surveyA[category][currentAction];
  if (!items || items.length === 0) {
    list.textContent = 'No items in this section.';
    return;
  }

  items.forEach((kink, index) => {
    const row = document.createElement('div');
    row.style.marginBottom = '10px';

    const label = document.createElement('span');
    label.textContent = kink.name + ': ';
    row.appendChild(label);

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

    select.addEventListener('change', () => {
      kink.rating = select.value === '' ? null : Number(select.value);
    });

    row.appendChild(select);
    list.appendChild(row);
  });
}

// Download updated JSON
document.getElementById('downloadBtn')?.addEventListener('click', () => {
  if (!surveyA) return;
  const blob = new Blob([JSON.stringify(surveyA, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'kink-survey.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

// Initialize default view
switchTab('Giving');
