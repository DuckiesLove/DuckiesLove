// ========== Theme Switching Logic ==========
const themeSelector = document.getElementById('themeSelector');
const savedTheme = localStorage.getItem('selectedTheme');
const outerWildsBanner = document.getElementById('outerWildsBanner');
const monsterPromBanner = document.getElementById('monsterPromBanner');

function updateBannerVisibility(theme) {
  if (outerWildsBanner) {
    outerWildsBanner.style.display = theme === 'theme-outer-wilds' ? 'block' : 'none';
  }
  if (monsterPromBanner) {
    monsterPromBanner.style.display = theme === 'theme-monster-prom' ? 'block' : 'none';
  }
}

if (savedTheme) {
  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
  updateBannerVisibility(savedTheme);
} else {
  document.body.className = 'dark-mode';
  updateBannerVisibility('dark-mode');
}

themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
  updateBannerVisibility(selectedTheme);
});

// ========== Tab Switching ==========
let currentAction = 'Giving';
let currentCategory = null;

function switchTab(action) {
  currentAction = action;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${action.toLowerCase()}Tab`).classList.add('active');
  showCategories();
  if (currentCategory) showKinks(currentCategory);
}

document.getElementById('givingTab')?.addEventListener('click', () => switchTab('Giving'));
document.getElementById('receivingTab')?.addEventListener('click', () => switchTab('Receiving'));
document.getElementById('neutralTab')?.addEventListener('click', () => switchTab('Neutral'));

// ========== Survey Logic ==========
const categoryContainer = document.getElementById('categoryContainer');
const kinkList = document.getElementById('kinkList');
let surveyA = null;
let surveyB = null;

document.getElementById('fileA').addEventListener('change', (e) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      surveyA = JSON.parse(ev.target.result);
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
  fetch('template-survey.json?v=61')
    .then(res => res.json())
    .then(data => {
      surveyA = data;
      showCategories();
    })
    .catch(err => alert('Error loading template: ' + err.message));
});

// ========== Displaying Categories & Kinks ==========
function showCategories() {
  categoryContainer.innerHTML = '';
  if (!surveyA) return;

  const categories = Object.keys(surveyA);
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    if (currentCategory === cat) btn.classList.add('active');
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
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '—';
    select.appendChild(emptyOption);

    for (let i = 1; i <= 6; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      if (kink.rating == i) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      kink.rating = select.value === '' ? null : Number(select.value);
    });

    container.appendChild(select);
    kinkList.appendChild(container);
  });
}

// ========== Download ==========
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

// ========== Compare ==========
document.getElementById('compareBtn').addEventListener('click', () => {
  const resultDiv = document.getElementById('comparisonResult');
  resultDiv.innerHTML = '';

  if (!surveyA || !surveyB) {
    resultDiv.textContent = 'Please upload both surveys to compare.';
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
            const score = Math.max(0, 100 - diff * 20);
            totalScore += score;
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

  let output = '';
  if (count === 0 || isNaN(totalScore)) {
    output += `<h3>Compatibility Score: 0%</h3><p>No shared rated items to compare.</p>`;
  } else {
    const avgScore = Math.round(totalScore / count);
    output += `<h3>Compatibility Score: ${avgScore}%</h3>`;
  }

  // Similarity Score
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
            const score = Math.max(0, 100 - diff * 20);
            simScore += score;
            simCount++;
          }
        }
      });
    });
  });

  if (simCount > 0 && !isNaN(simScore)) {
    const avgSim = Math.round(simScore / simCount);
    output += `<h4>Similarity Score: ${avgSim}%</h4>`;
  } else {
    output += `<h4>Similarity Score: 0%</h4><p>No overlapping ratings in matching roles.</p>`;
  }

  if (redFlags.length) {
    output += `<p>🚩 Red flags: ${[...new Set(redFlags)].join(', ')}</p>`;
  }
  if (yellowFlags.length) {
    output += `<p>⚠️ Yellow flags: ${[...new Set(yellowFlags)].join(', ')}</p>`;
  }

  resultDiv.innerHTML = output;
});

// ========== Initialize ==========
switchTab('Giving');
