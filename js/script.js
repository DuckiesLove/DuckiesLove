// ================== Theme Setup ==================
const themeSelector = document.getElementById('themeSelector');
const outerWildsBanner = document.getElementById('outerWildsBanner');
const monsterPromBanner = document.getElementById('monsterPromBanner');

function updateBannerVisibility(theme) {
  outerWildsBanner.style.display = theme === 'theme-outer-wilds' ? 'block' : 'none';
  monsterPromBanner.style.display = theme === 'theme-monster-prom' ? 'block' : 'none';
}

const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
document.body.className = savedTheme;
themeSelector.value = savedTheme;
updateBannerVisibility(savedTheme);

themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
  updateBannerVisibility(selectedTheme);
});

// ================== Tab Switching ==================
let currentAction = 'Giving';
function switchTab(action) {
  currentAction = action;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${action.toLowerCase()}Tab`).classList.add('active');
  showCategories();
  if (currentCategory) showKinks(currentCategory);
}

document.getElementById('givingTab').onclick = () => switchTab('Giving');
document.getElementById('receivingTab').onclick = () => switchTab('Receiving');
document.getElementById('neutralTab').onclick = () => switchTab('Neutral');

// ================== Survey Logic ==================
let surveyA = null;
let surveyB = null;
let currentCategory = null;

const categoryContainer = document.getElementById('categoryContainer');
const kinkList = document.getElementById('kinkList');
const categoryPanel = document.getElementById('categoryPanel');

document.getElementById('fileA').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      surveyA = JSON.parse(ev.target.result);
      categoryPanel.style.display = 'block';
      showCategories();
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
      surveyB = JSON.parse(ev.target.result);
    } catch {
      alert('Invalid JSON for Survey B.');
    }
  };
  reader.readAsText(e.target.files[0]);
});

document.getElementById('newSurveyBtn').addEventListener('click', () => {
  fetch('template-survey.json')
    .then(res => res.json())
    .then(data => {
      surveyA = data;
      categoryPanel.style.display = 'block'; // Show sidebar
      showCategories();
    })
    .catch(err => alert('Failed to load template: ' + err.message));
});

// ================== Category + Kink Display ==================
function showCategories() {
  categoryContainer.innerHTML = '';
  if (!surveyA) return;
  Object.keys(surveyA).forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    if (cat === currentCategory) btn.classList.add('active');
    btn.onclick = () => {
      if (currentCategory === cat) return;
      currentCategory = cat;
      showCategories();
      showKinks(cat);
    };
    categoryContainer.appendChild(btn);
  });
}

function showKinks(category) {
  currentCategory = category;
  kinkList.innerHTML = '';
  const kinks = surveyA[category]?.[currentAction];
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
    };

    container.appendChild(select);
    kinkList.appendChild(container);
  });
}

// ================== Download Survey ==================
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!surveyA) {
    alert('No survey loaded.');
    return;
  }
  const blob = new Blob([JSON.stringify(surveyA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kink-survey.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ================== Compare Surveys ==================
document.getElementById('compareBtn').addEventListener('click', () => {
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
