/*! TK Emergency Reveal — ensures UI remains visible + Start button enabled */
(() => {
  // 1) Force visible, readable styles
  const css = `
    html,body{background:#000!important;color:#e6f2ff!important;overflow:auto!important}
    *,*::before,*::after{color:#e6f2ff!important;opacity:1!important;visibility:visible!important}
    [hidden],.hidden,.sr-only{display:initial!important;clip:auto!important;height:auto!important;width:auto!important;position:static!important}
    a{color:#7fe8ff!important}
    input,select,button,textarea{color:#e6f2ff!important;background:#101010!important;border:1px solid #00e6ff55!important}
    .category-panel,.panel,.card{background:#0a0a0a!important;border-color:#00e6ff33!important}
  `;
  const style = document.createElement('style');
  style.id = 'tk-reveal';
  style.textContent = css;
  document.head.appendChild(style);

  // 2) If Start is present, make sure it can be clicked
  const start = document.querySelector('#start,#startSurvey');
  if (start) {
    start.disabled = false;
    start.removeAttribute('aria-disabled');
  }

  // 3) Log a quick status for data
  const KINK_URLS = [
    '/data/kinks.json',
    '/kinksurvey/data/kinks.json',
    '/kinksurvey/kinks.json',
    '/kinks.json',
    '/assets/kinks.json'
  ];

  (async () => {
    for (const url of KINK_URLS) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        console.log('[TK] kinks.json candidate', url, '→', response.status, response.headers.get('content-type'));
        if (response.ok) break;
      } catch (error) {
        console.log('[TK] kinks.json fetch failed for', url, ':', error);
      }
    }
  })();
})();
