export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
  document.body.className = savedTheme;
  applyThemeFontStyles(savedTheme);
  if (themeSelector) {
    themeSelector.value = savedTheme;
    themeSelector.addEventListener('change', () => {
      const selectedTheme = themeSelector.value;
      document.body.className = selectedTheme;
      localStorage.setItem('selectedTheme', selectedTheme);
      applyThemeFontStyles(selectedTheme);
    });
  }
}

export function applyThemeFontStyles(theme) {
  const surveyContent = document.querySelector('#survey-section');
  const categoryPanel = document.querySelector('#categoryPanel');
  const themeStyles = {
    'light-mode': {
      fontColor: '#111',
      fontFamily: 'Arial, sans-serif'
    },
    'dark-mode': {
      fontColor: '#eee',
      fontFamily: 'Helvetica, sans-serif'
    },
    'theme-echoes-beyond': {
      fontColor: '#e0ffe0',
      fontFamily: '"Courier New", monospace'
    }
  };

  const selected = themeStyles[theme] || themeStyles['dark-mode'];

  if (surveyContent) {
    surveyContent.style.color = selected.fontColor;
    surveyContent.style.fontFamily = selected.fontFamily;
  }

  if (categoryPanel) {
    categoryPanel.style.color = selected.fontColor;
    categoryPanel.style.fontFamily = selected.fontFamily;
  }
}
