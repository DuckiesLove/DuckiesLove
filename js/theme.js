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
      bgColor: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      inputBg: '#f7f7f7',
      inputText: '#111',
      borderColor: '#ccc'
    },
    'dark-mode': {
      fontColor: '#f2f2f2',
      bgColor: '#121212',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#2a2a2a',
      inputText: '#ffffff',
      borderColor: '#666'
    },
    'theme-blue': {
      fontColor: '#ffffff',
      bgColor: '#001933',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#002244',
      inputText: '#ffffff',
      borderColor: '#003366'
    },
    'theme-blue-sky': {
      fontColor: '#002244',
      bgColor: '#e6f2ff',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#cde6ff',
      inputText: '#002244',
      borderColor: '#99c9f2'
    },
    'theme-echoes-beyond': {
      fontColor: '#d0ffd0',
      bgColor: '#0f1b0f',
      fontFamily: '"Courier New", monospace',
      inputBg: '#1e2e1e',
      inputText: '#d0ffd0',
      borderColor: '#355935'
    },
    'theme-love-notes-lipstick': {
      fontColor: '#ffffff',
      bgColor: '#2b002b',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#a64ca6',
      inputText: '#fff0f5',
      borderColor: '#d47bd4'
    },
    'theme-rainbow': {
      fontColor: '#000000',
      bgColor: '#ffffff',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)',
      inputText: '#ffffff',
      borderColor: '#555'
    }
  };

  const selected = themeStyles[theme] || themeStyles['dark-mode'];

  if (surveyContent) {
    surveyContent.style.color = selected.fontColor;
    surveyContent.style.backgroundColor = selected.bgColor;
    surveyContent.style.fontFamily = selected.fontFamily;

    surveyContent.querySelectorAll('*').forEach(el => {
      el.style.color = selected.fontColor;
      el.style.fontFamily = selected.fontFamily;
    });

    surveyContent.querySelectorAll('select, input[type="text"]').forEach(input => {
      input.style.background = selected.inputBg;
      input.style.color = selected.inputText;
      input.style.borderColor = selected.borderColor;
      input.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
    });
  }

  if (categoryPanel) {
    categoryPanel.style.color = selected.fontColor;
    categoryPanel.style.fontFamily = selected.fontFamily;
  }
}
