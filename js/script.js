const themeSelector = document.getElementById('themeSelector');
const savedTheme = localStorage.getItem('selectedTheme');

const banners = {
  'theme-monster-prom': document.getElementById('monsterPromBanner'),
  'theme-outer-wilds': document.getElementById('outerWildsBanner')
};

// Apply saved theme on load
if (savedTheme) {
  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
  updateBannerVisibility(savedTheme);
} else {
  // Default to Monster Prom theme
  document.body.className = 'theme-monster-prom';
  themeSelector.value = 'theme-monster-prom';
  updateBannerVisibility('theme-monster-prom');
}

// Theme change event
themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
  updateBannerVisibility(selectedTheme);
});

// Show only the correct banner
function updateBannerVisibility(theme) {
  Object.entries(banners).forEach(([key, banner]) => {
    if (banner) {
      banner.style.display = key === theme ? 'block' : 'none';
    }
  });
}
