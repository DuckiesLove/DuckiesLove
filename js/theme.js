export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  const fontSelector = document.getElementById('fontSelectorIntro');
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
      const currentFont = fontSelector ? fontSelector.value : null;
      if (currentFont) applyCustomFont(currentFont);
    });
  }

  if (fontSelector) {
    const savedFont = localStorage.getItem('selectedFont') || 'default';
    fontSelector.value = savedFont;
    applyCustomFont(savedFont);
    fontSelector.addEventListener('change', () => {
      const selectedFont = fontSelector.value;
      localStorage.setItem('selectedFont', selectedFont);
      applyCustomFont(selectedFont);
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
      dropdownBg: '#fff',
      dropdownText: '#111',
      borderColor: '#ccc'
    },
    'dark-mode': {
      fontColor: '#f2f2f2',
      bgColor: '#121212',
      fontFamily: 'Helvetica, sans-serif',
      dropdownBg: '#1f1f1f',
      dropdownText: '#f2f2f2',
      borderColor: '#444'
    },
    'theme-echoes-beyond': {
      fontColor: '#d0ffd0',
      bgColor: '#0f1b0f',
      fontFamily: '"Courier New", monospace',
      dropdownBg: '#1e2e1e',
      dropdownText: '#d0ffd0',
      borderColor: '#355935'
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

    surveyContent.querySelectorAll('select').forEach(select => {
      select.style.backgroundColor = selected.dropdownBg;
      select.style.color = selected.dropdownText;
      select.style.borderColor = selected.borderColor;
    });
  }

  if (categoryPanel) {
    categoryPanel.style.color = selected.fontColor;
    categoryPanel.style.fontFamily = selected.fontFamily;
  }
}

export function applyCustomFont(font) {
  const surveyContent = document.querySelector('#survey-section');
  const categoryPanel = document.querySelector('#categoryPanel');

  if (font === 'default') {
    applyThemeFontStyles(document.body.className);
    return;
  }

  if (surveyContent) {
    surveyContent.style.fontFamily = font;
    surveyContent.querySelectorAll('*').forEach(el => {
      el.style.fontFamily = font;
    });
  }

  if (categoryPanel) {
    categoryPanel.style.fontFamily = font;
  }
}
