window.addEventListener('DOMContentLoaded', () => {
  const themeSelector = document.getElementById('themeSelector');
  const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
  const outerWildsBanner = document.getElementById('outerWildsBanner');
  const monsterPromBanner = document.getElementById('monsterPromBanner');

  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
  updateBannerVisibility(savedTheme);

  themeSelector.addEventListener('change', () => {
    const selectedTheme = themeSelector.value;
    document.body.className = selectedTheme;
    localStorage.setItem('selectedTheme', selectedTheme);
    updateBannerVisibility(selectedTheme);
  });

  function updateBannerVisibility(theme) {
    outerWildsBanner.style.display = theme === 'theme-outer-wilds' ? 'block' : 'none';
    monsterPromBanner.style.display = theme === 'theme-monster-prom' ? 'block' : 'none';
  }

  const tabs = {
    Giving: document.getElementById('givingTab'),
    Receiving: document.getElementById('receivingTab'),
    Neutral: document.getElementById('neutralTab'),
  };

  let currentAction = 'Giving';

  Object.entries(tabs).forEach(([action, tab]) => {
    tab.addEventListener('click', () => {
      currentAction = action;
      Object.values(tabs).forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Set default tab
  tabs['Giving'].classList.add('active');
});
