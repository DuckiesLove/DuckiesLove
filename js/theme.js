export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  const savedTheme = localStorage.getItem('selectedTheme') || 'dark-mode';
  document.body.className = savedTheme;
  applyThemeColors(savedTheme);
  if (themeSelector) {
    themeSelector.value = savedTheme;
    themeSelector.addEventListener('change', () => {
      const selectedTheme = themeSelector.value;
      document.body.className = selectedTheme;
      localStorage.setItem('selectedTheme', selectedTheme);
      applyThemeColors(selectedTheme);
    });
  }
}

export function applyThemeColors(theme) {
  const surveyContent = document.querySelector('#survey-section');
  const categoryPanel = document.querySelector('#categoryPanel');
  const themeStyles = {
    'light-mode': {
      fontColor: '#111',
      bgColor: '#939e93',
      inputBg: '#f7f7f7',
      inputText: '#111',
      borderColor: '#ccc'
    },
    'dark-mode': {
      fontColor: '#f2f2f2',
      bgColor: '#121212',
      inputBg: '#2a2a2a',
      inputText: '#ffffff',
      borderColor: '#666'
    },
    'theme-blue': {
      fontColor: '#ffffff',
      bgColor: '#1a273f',
      inputBg: '#3a4b6b',
      inputText: '#ffffff',
      borderColor: '#4c5d7a'
    },
    'theme-blue-sky': {
      fontColor: '#002244',
      bgColor: '#b2bfcc',
      inputBg: '#c9e0ff',
      inputText: '#002244',
      borderColor: '#a9c9e6'
    },
    'theme-echoes-beyond': {
      fontColor: '#ffcc66',
      bgColor: '#101a31',
      inputBg: '#f9d7a5',
      inputText: '#003366',
      borderColor: '#cc7a00'
    },
    'theme-love-notes-lipstick': {
      fontColor: '#ffe0f5',
      bgColor: '#3b0a3b',
      inputBg: '#dca0d7',
      inputText: '#3b0a3b',
      borderColor: '#c286c2'
    },
    'theme-rainbow': {
      fontColor: '#222',
      bgColor: '#ccc0c4',
      inputBg: '#f8e6ff',
      inputText: '#222',
      borderColor: '#d8b0e6'
    }
  };

  const normalized = (theme || '').toLowerCase().replace(/\s+/g, '-');
  const selected = themeStyles[normalized] || themeStyles['dark-mode'];

  if (surveyContent) {
    surveyContent.style.color = selected.fontColor;
    surveyContent.style.backgroundColor = selected.bgColor;

    surveyContent.querySelectorAll('*').forEach(el => {
      el.style.color = selected.fontColor;
    });

    surveyContent.querySelectorAll('select, input[type="text"]').forEach(input => {
      input.style.backgroundColor = selected.inputBg;
      input.style.color = selected.inputText;
      input.style.borderColor = selected.borderColor;
      input.style.borderRadius = '6px';
      input.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
  }

  if (categoryPanel) {
    categoryPanel.style.color = selected.fontColor;
  }

  document.body.style.backgroundColor = selected.bgColor;
}
