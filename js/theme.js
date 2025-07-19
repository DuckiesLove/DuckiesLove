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

export function applyPrintStyles() {
  if (document.getElementById('pdf-print-style')) return;
  const style = document.createElement('style');
  style.id = 'pdf-print-style';
  style.innerHTML = `
    @media print {
      body {
        background: var(--bg-color, #000) !important;
        color: var(--text-color, #fff) !important;
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        letter-spacing: 0.3px;
      }

      #comparison-chart {
        max-width: 900px;
        margin: auto;
        padding: 20px;
        background-color: var(--bg-color, #000) !important;
        color: var(--text-color, #fff) !important;
        border-radius: 10px;
        font-size: 16px;
      }

      .col-labels,
      .col-labels .col-label {
        color: #ffffff !important;
      }

      .category-header {
        font-size: 18px;
        font-weight: bold;
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid #444;
      }
      .category-header.green { color: #00FF88 !important; }
      .category-header.yellow { color: #FFD700 !important; }
      .category-header.red { color: #FF4C4C !important; }

      .compare-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
        border-bottom: 1px solid #333;
      }

      .compare-label {
        flex: 2;
        padding-right: 8px;
        font-weight: 500;
        font-size: 16px;
      }
      .compare-label.green { color: #00FF88 !important; }
      .compare-label.yellow { color: #FFD700 !important; }
      .compare-label.red { color: #FF4C4C !important; }

      .partner-bar {
        flex: 1;
        position: relative;
        height: 12px;
        background: #222;
        border-radius: 6px;
        margin: 0 6px;
      }
      .partner-fill.green { background-color: #00FF88; }
      .partner-fill.yellow { background-color: #FFD700; }
      .partner-fill.red { background-color: #FF4C4C; }

      .partner-text {
        position: absolute;
        top: -2px;
        left: 0;
        width: 100%;
        font-size: 16px;
        text-align: center;
        pointer-events: none;
        color: #ffffff !important;
      }
      .partner-text.green { color: #ffffff !important; }
      .partner-text.yellow { color: #ffffff !important; }
      .partner-text.red { color: #ffffff !important; }

      .compare-icons {
        width: 40px;
        text-align: right;
        font-size: 14px;
      }

      /* legacy role list styles */
      .result-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
        border-bottom: 1px solid #333;
      }
      .percentage {
        width: 60px;
        font-weight: bold;
        text-align: right;
        color: var(--text-color, #fff) !important;
      }
      .percentage.green { color: #00FF88 !important; }
      .percentage.yellow { color: #FFD700 !important; }
      .percentage.red { color: #FF4C4C !important; }
      .role {
        flex: 1.5;
        color: var(--text-color, #fff) !important;
      }
      .bar-container {
        flex: 2;
        background: #222;
        border-radius: 4px;
        height: 10px;
        position: relative;
      }
      .bar-fill {
        height: 100%;
        border-radius: 4px;
        position: absolute;
        left: 0;
        top: 0;
      }
      .bar-fill.green { background: #00cc66; }
      .bar-fill.yellow { background: #e6c300; }
      .bar-fill.red { background: #cc0033; }
      .more-info {
        flex-shrink: 0;
        font-size: 12px;
        color: #ccc !important;
      }
    }
  `;
  document.head.appendChild(style);
}
