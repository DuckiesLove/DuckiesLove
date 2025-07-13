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
      borderColor: '#ccc',
      buttonBg: '#e0e0e0',
      buttonText: '#111'
    },
    'dark-mode': {
      fontColor: '#f2f2f2',
      bgColor: '#121212',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#2a2a2a',
      inputText: '#ffffff',
      borderColor: '#666',
      buttonBg: '#333',
      buttonText: '#f2f2f2'
    },
    'theme-blue': {
      fontColor: '#ffffff',
      bgColor: '#001933',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#002244',
      inputText: '#ffffff',
      borderColor: '#003366',
      buttonBg: '#0055aa',
      buttonText: '#ffffff'
    },
    'theme-blue-sky': {
      fontColor: '#002244',
      bgColor: '#dfefff',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#b0d4ff',
      inputText: '#002244',
      borderColor: '#99c9f2',
      buttonBg: '#99c9f2',
      buttonText: '#002244'
    },
    'theme-echoes-beyond': {
      fontColor: '#ffcc66',
      bgColor: '#0b1d26',
      fontFamily: '"Courier New", monospace',
      inputBg: '#ffb347',
      inputText: '#003366',
      borderColor: '#cc7a00',
      buttonBg: '#0b1d26',
      buttonText: '#ffcc66'
    },
    'theme-love-notes-lipstick': {
      fontColor: '#fff0f5',
      bgColor: '#2b002b',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: '#a64ca6',
      inputText: '#fff0f5',
      borderColor: '#d47bd4',
      buttonBg: '#d47bd4',
      buttonText: '#2b002b'
    },
    'theme-rainbow': {
      fontColor: '#ffffff',
      bgColor: '#000000',
      fontFamily: 'Helvetica, sans-serif',
      inputBg: 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)',
      inputText: '#ffffff',
      borderColor: '#ffffff',
      buttonBg: 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)',
      buttonText: '#ffffff'
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

    surveyContent.querySelectorAll('button').forEach(btn => {
      btn.style.background = selected.buttonBg;
      btn.style.color = selected.buttonText;
    });
  }

  if (categoryPanel) {
    categoryPanel.style.color = selected.fontColor;
    categoryPanel.style.fontFamily = selected.fontFamily;
  }
}
