const themeStyles = {
  dark: {
    fontColor: '#f2f2f2',
    bgColor: '#000000',
    inputBg: '#000000',
    inputText: '#f2f2f2',
    borderColor: '#444'
  },
  lipstick: {
    fontColor: '#fceaff',
    bgColor: '#1a001f',
    inputBg: '#300030',
    inputText: '#fceaff',
    borderColor: '#ff91f0'
  },
  forest: {
    fontColor: '#1d3b1d',
    bgColor: '#f0f7f1',
    inputBg: '#e6f3ea',
    inputText: '#1d3b1d',
    borderColor: '#81b89b'
  }
};

export function setTheme(theme) {
  if (document.body.classList.contains('exporting')) {
    localStorage.setItem('theme', theme);
    return;
  }

  const current = Array.from(document.body.classList);
  current
    .filter(cls => cls.startsWith('theme-'))
    .forEach(cls => document.body.classList.remove(cls));

  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem('theme', theme);
  applyThemeColors(theme);
}
// Expose for inline handlers
window.setTheme = setTheme;

export function initTheme() {
  const themeSelector = document.getElementById('themeSelector');
  window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (themeSelector) themeSelector.value = savedTheme;
  });

  if (themeSelector) {
    themeSelector.addEventListener('change', () => {
      const selectedTheme = themeSelector.value;
      setTheme(selectedTheme);
    });
  }
}

export function applyThemeColors(theme) {
  const normalized = (theme || '').toLowerCase().replace(/\s+/g, '-');
  const selected = themeStyles[normalized] || themeStyles['dark'];

  document.querySelectorAll('select, input[type="text"]').forEach(input => {
    input.style.backgroundColor = selected.inputBg;
    input.style.color = selected.inputText;
    input.style.borderColor = selected.borderColor;
    input.style.borderRadius = '6px';
    input.style.boxShadow = 'none';
  });

  document.body.style.backgroundColor = selected.bgColor;
  document.body.style.color = selected.fontColor;
}

export const pdfStyles = `
  @media print {
    :root {
      --bg-color: #000000 !important;
      --text-color: #ffffff !important;
      --panel-color: #000 !important;
    }

    html, body, #compatibility-wrapper {
      background: var(--bg-color) !important;
      color: var(--text-color) !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      letter-spacing: 0.3px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #compatibility-wrapper {
      width: 100vw;
      min-height: 100vh;
      padding-bottom: 100px;
    }
    #compatibility-wrapper * {
      box-sizing: border-box !important;
    }

    .category-title {
      font-size: 18px !important;
      font-weight: bold !important;
      color: #b00020 !important; /* deep red */
      margin-top: 20px;
    }

    .item-label {
      font-size: 14px;
      color: #cccccc !important;
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

    #pdf-container, #compat-container {
      font-size: 11pt;
      line-height: 1.6;
      padding: 1.5em;
      color: var(--text-color);
      background-color: var(--bg-color);
    }

    .category-section {
      margin-bottom: 2em;
      page-break-inside: avoid;
    }

    .category-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 0.5em;
      page-break-inside: avoid;
    }

    .row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 0.7em;
      page-break-inside: avoid;
    }

    .row > div {
      flex: 1;
      min-width: 120px;
      padding-right: 10px;
      word-break: break-word;
      white-space: normal;
    }
  }
`;

export const lightPdfStyles = `
  @media print {
    :root {
      --bg-color: #ffffff !important;
      --text-color: #000000 !important;
      --panel-color: #f0f0f0 !important;
    }

    html, body, #compatibility-wrapper {
      background: var(--bg-color) !important;
      color: var(--text-color) !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      letter-spacing: 0.3px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #compatibility-wrapper {
      width: 100vw;
      min-height: 100vh;
      padding-bottom: 100px;
    }
    #compatibility-wrapper * {
      box-sizing: border-box !important;
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

export function applyPrintStyles(mode = 'dark') {
  if (document.getElementById('pdf-print-style')) return;
  const style = document.createElement('style');
  style.id = 'pdf-print-style';
  const base = pdfStyles;
  const vars = themeStyles[mode] || themeStyles.dark;
  style.textContent = `
    :root {
      --bg-color: ${vars.bgColor} !important;
      --text-color: ${vars.fontColor} !important;
      --panel-color: ${vars.inputBg || vars.bgColor} !important;
    }
  ` + base + `


      #comparison-chart {
        max-width: 900px;
        margin: 20px auto;
        padding: 30px;
        background-color: var(--bg-color, #000000) !important;
        color: var(--text-color, #ffffff) !important;
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
        background-color: var(--panel-color, #000) !important;
      }

      .compare-label {
        flex: 2;
        padding-right: 8px;
        font-weight: 500;
        font-size: 14px;
        color: #dddddd !important;
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

      .results-table {
        max-width: 700px;
        margin: 20px auto;
        width: 100%;
        border-collapse: collapse;
      }
      .results-table th,
      .results-table td {
        padding: 8px 12px;
        text-align: left;
      }
      .results-table th {
        border-bottom: 2px solid #444;
        font-size: 1rem;
        color: #ccc;
      }
      .results-table .kink-name {
        color: #ccc;
        font-weight: bold;
        white-space: normal;
        word-break: break-word;
        line-height: 1.4;
        max-width: 220px;
      }
      .results-table .row {
        border-bottom: 1px solid #333;
      }
      .results-table .bar-container {
        width: 100%;
        background-color: #000000;
        border-radius: 4px;
        overflow: hidden;
        height: 12px;
      }
      .results-table .bar {
        height: 12px;
      }
      .results-table .green { background-color: #00e676; }
      .results-table .yellow { background-color: #ffee58; }
      .results-table .red { background-color: #f44336; }
      .results-table .percent-label {
        font-size: 0.85rem;
        color: #aaa;
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
        color: var(--text-color, #ffffff) !important;
      }
      .percentage.green { color: #00FF88 !important; }
      .percentage.yellow { color: #FFD700 !important; }
      .percentage.red { color: #FF4C4C !important; }
      .role {
        flex: 1.5;
        color: var(--text-color, #ffffff) !important;
      }
      .bar-container {
        flex: 2;
        background: #000000;
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
        break-inside: avoid;
        page-break-inside: avoid;
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

      #export-container {
        background-color: #000 !important;
        color: #f1f1f1 !important;
        padding: 1rem;
        width: 100%;
      }

      .comparison-card {
        background-color: #000000 !important;
        color: #f1f1f1 !important;
        border-radius: 8px;
        margin: 0.5rem 0;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
      }

      .comparison-card .label {
        color: #ccc !important;
      }

      .comparison-card .bar {
        background-color: #333 !important;
      }

      .comparison-card .bar-fill {
        background-color: limegreen !important;
      }

      @media print {
        body { counter-reset: page; }
        .print-footer:after { content: counter(page); }
      }

      .page-break {
        display: none;
      }

      @media print {
        body, #compatibility-wrapper, .pdf-export-area {
          background-color: var(--bg-color, #000000) !important;
          color: var(--text-color, #ffffff) !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact !important;
        }

        .discord-button, .dark-button {
          background-color: var(--panel-color, #000) !important;
          color: var(--text-color, #ffffff) !important;
          border: 1px solid #cccccc;
          padding: 0.5rem 1rem;
          border-radius: 6px;
        }

        .category-wrapper {
          color: var(--text-color, #ffffff) !important;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          break-inside: avoid;
          page-break-inside: avoid;
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
