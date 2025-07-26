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

export const pdfStyles = `
  @media print {
    :root {
      --bg-color: #e6f0fa !important;
      --text-color: #000000 !important;
      --panel-color: #f9f9f9 !important;
    }

    html, body {
      background: var(--bg-color) !important;
      color: #000000 !important;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      letter-spacing: 0.3px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .category-title {
      font-size: 18px !important;
      font-weight: bold !important;
      color: #b00020 !important; /* deep red */
      margin-top: 20px;
    }

    .item-label {
      font-size: 14px;
      color: #333333 !important;
    }

    .match-bar {
      height: 12px !important;
      border-radius: 6px;
      background-color: #e0e0e0 !important;
      box-shadow: none !important;
    }

    .match-bar-fill {
      background-color: #00c853 !important; /* bright green */
    }

    .score-flag-high {
      color: #ffb300 !important; /* gold */
    }

    .score-flag-low {
      color: #d32f2f !important; /* red */
    }

    .score-flag-mismatch {
      color: #fbc02d !important; /* yellow */
    }
  }
`;

export function applyPrintStyles() {
  if (document.getElementById('pdf-print-style')) return;
  const style = document.createElement('style');
  style.id = 'pdf-print-style';
  style.textContent = pdfStyles + `


      #comparison-chart {
        max-width: 900px;
        margin: 20px auto;
        padding: 30px;
        background-color: var(--bg-color, #e6f0fa) !important;
        color: var(--text-color, #111111) !important;
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
        margin: 24px 0 8px;
        padding-top: 8px;
        color: #b00020 !important;
      }
      .category-header.green { color: #00c853 !important; }
      .category-header.yellow { color: #fbc02d !important; }
      .category-header.red { color: #d32f2f !important; }

      .compare-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid #ccc;
        background-color: #ffffff !important;
      }

      .compare-label {
        flex: 2;
        padding-right: 8px;
        font-weight: 500;
        font-size: 14px;
        color: #333 !important;
      }
      .compare-label.green { color: #00c853 !important; }
      .compare-label.yellow { color: #fbc02d !important; }
      .compare-label.red { color: #d32f2f !important; }

      .partner-bar {
        flex: 1;
        position: relative;
        height: 12px;
        background: #e0e0e0;
        border-radius: 6px;
        margin: 0 6px;
        box-shadow: none !important;
      }
      .partner-fill.green { background-color: #00c853; }
      .partner-fill.yellow { background-color: #fbc02d; }
      .partner-fill.red { background-color: #d32f2f; }

      .partner-text {
        position: absolute;
        top: -2px;
        left: 0;
        width: 100%;
        font-size: 12px;
        text-align: center;
        pointer-events: none;
        color: #ffffff !important;
      }
      .partner-text.green { color: #ffffff !important; }
      .partner-text.yellow { color: #333333 !important; }
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
        color: var(--text-color, #111111) !important;
      }
      .percentage.green { color: #00FF88 !important; }
      .percentage.yellow { color: #FFD700 !important; }
      .percentage.red { color: #FF4C4C !important; }
      .role {
        flex: 1.5;
        color: var(--text-color, #111111) !important;
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
      .bar-fill.green { background: #00c853; }
      .bar-fill.yellow { background: #fbc02d; }
      .bar-fill.red { background: #d32f2f; }
      .more-info {
        flex-shrink: 0;
        font-size: 12px;
        color: #ccc !important;
      }

      .category-wrapper {
        margin-bottom: 24px;
        padding: 6px;
        border-bottom: 1px solid #ddd;
        background-color: #ffffff !important;
      }

      .print-footer {
        position: fixed;
        bottom: 10px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 12px;
        color: #666;
      }

      @media print {
        body { counter-reset: page; }
        .print-footer:after { content: counter(page); }
      }

      .page-break {
        display: none;
      }

      @media print {
        body, .pdf-export-area {
          background-color: #ffffff !important;
          color: #111111 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact !important;
        }

        .discord-button, .dark-button {
          background-color: #f2f2f2 !important;
          color: #111111 !important;
          border: 1px solid #cccccc;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }

        .category-wrapper {
          background-color: #ffffff !important;
          color: #111111 !important;
          border: 1px solid #cccccc;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .page-break {
          display: block;
          height: 0;
          page-break-before: always;
          break-before: page;
          page-break-after: always;
        }
      }
    }
  `;
  document.head.appendChild(style);
}
