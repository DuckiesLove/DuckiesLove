(() => {
  const onSurvey = location.pathname.replace(/\/+$/, '') === '/kinksurvey';
  if (!onSurvey) return;

  const doc = document;
  const state = { started: false };
  const els = { host: null, left: null, main: null, right: null, start: null, score: null };

  const CSS = `
  html.tk-gated #tkDockRight,
  html.tk-gated #tkScoreDock,
  html.tk-gated .how-to-score,
  html.tk-gated [data-sticky="score"],
  html.tk-gated #questionArea,
  html.tk-gated #questionCard,
  html.tk-gated .survey-question-panel,
  html.tk-gated .question-layout,
  html.tk-gated [data-role="question-panel"]{display:none!important}

  #tkDockHost{display:grid;grid-template-columns:minmax(320px,360px) 1fr minmax(300px,0.9fr);gap:24px;align-items:start;margin:0 20px 40px}
  @media(max-width:1200px){#tkDockHost{grid-template-columns:minmax(320px,360px) 1fr}}
  @media(max-width:960px){#tkDockHost{grid-template-columns:1fr}}
  #tkDockLeft{position:sticky;top:96px;align-self:start}
  #tkDockLeft .tk-shell{background:#0b1016;border:1px solid #142331;border-radius:14px;box-shadow:0 8px 22px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.06);padding:10px}

  #tkStartBar{display:flex;justify-content:center;margin-top:10px}
  #tkStartBtn{
    appearance:none;cursor:not-allowed;opacity:.55;
    border-radius:999px;border:1px solid #1b2b3a;background:#121821;color:#eaf4ff;
    padding:10px 14px;font-weight:700;letter-spacing:.2px;
  }
  #tkStartBtn.is-ready{cursor:pointer;opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,.3) inset, 0 0 14px rgba(77,163,255,.35)}
  `;

  function injectCss() {
    if (doc.getElementById('tkDockGateCss')) return;
    const style = doc.createElement('style');
    style.id = 'tkDockGateCss';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function ensureRails() {
    els.host = doc.getElementById('tkDockHost') || els.host || doc.createElement('div');
    els.host.id = 'tkDockHost';

    els.left = doc.getElementById('tkDockLeft') || els.left || doc.createElement('aside');
    els.left.id = 'tkDockLeft';

    els.main = doc.getElementById('tkDockMain') || els.main || doc.createElement('section');
    els.main.id = 'tkDockMain';

    els.right = doc.getElementById('tkDockRight') || els.right || doc.createElement('aside');
    els.right.id = 'tkDockRight';

    if (!els.host.parentNode) {
      const anchor = doc.querySelector('#surveyApp .tk-wrap') || doc.getElementById('surveyApp') || doc.body;
      anchor.prepend(els.host);
    }

    if (els.left.parentNode !== els.host) {
      els.host.insertBefore(els.left, els.host.firstChild);
    }
    if (els.main.parentNode !== els.host) {
      if (els.host.children.length > 1) {
        els.host.insertBefore(els.main, els.host.children[1]);
      } else {
        els.host.appendChild(els.main);
      }
    }
    if (els.right.parentNode !== els.host) {
      els.host.appendChild(els.right);
    }
  }

  function moveCategories() {
    const panel = doc.querySelector('#categoryPanel, .category-panel, [data-role="category-panel"]');
    if (!panel) return false;

    panel.removeAttribute('style');

    let shell = els.left.querySelector('.tk-shell');
    if (!shell) {
      shell = doc.createElement('div');
      shell.className = 'tk-shell';
      els.left.appendChild(shell);
    }

    if (panel.parentNode !== shell) {
      shell.innerHTML = '';
      shell.appendChild(panel);
    }

    ensureStartBar(shell, panel);
    return true;
  }

  function ensureStartBar(shell, panel) {
    let bar = doc.getElementById('tkStartBar');
    if (!bar) {
      bar = doc.createElement('div');
      bar.id = 'tkStartBar';
      bar.innerHTML = '<button id="tkStartBtn" disabled>Start Survey</button>';
      shell.appendChild(bar);
    } else if (bar.parentNode !== shell) {
      shell.appendChild(bar);
    }

    els.start = bar.querySelector('#tkStartBtn');
    wireStartEnable(panel);
  }

  function moveQuestionAndScore() {
    const questionTargets = [
      '#ctaStack',
      '.tk-meta',
      '.tk-survey-shell',
      '#questionArea',
      '#questionCard',
      '.survey-question-panel',
      '.question-layout',
      '[data-role="question-panel"]',
    ];

    for (const sel of questionTargets) {
      const node = doc.querySelector(sel);
      if (!node) continue;
      if (node.parentNode !== els.main) {
        els.main.appendChild(node);
      }
    }

    const score = doc.querySelector('#tkScoreDock, .how-to-score, [data-sticky="score"]');
    if (score) {
      els.score = score;
      score.style.display = 'none';
    }
  }

  function selectedCount() {
    const scope = els.left || doc;
    if (!scope) return 0;
    const boxes = scope.querySelectorAll('input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"]');
    return boxes.length;
  }

  function updateStartButtons() {
    const any = selectedCount() > 0;
    if (els.start) {
      els.start.toggleAttribute('disabled', !any);
      els.start.classList.toggle('is-ready', any);
    }

    const nav = doc.getElementById('btnStart');
    if (nav) {
      nav.disabled = !any;
      nav.title = any ? '' : 'Select at least one category to start';
      nav.classList.toggle('tk-disabled', !any);
      nav.setAttribute('aria-disabled', String(!any));
    }
  }

  function handleStartClick(evt) {
    evt.preventDefault();
    if (selectedCount() < 1) return;

    const nav = doc.getElementById('btnStart');
    if (nav) {
      nav.click();
    }
    requestStart();
  }

  function wireStartEnable(panel) {
    if (!panel) return;
    if (els.start && !els.start.dataset.tkBound) {
      els.start.addEventListener('click', handleStartClick);
      els.start.dataset.tkBound = '1';
    }

    const boxes = panel.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
    boxes.forEach((box) => {
      if (box.dataset.tkGateBound) return;
      box.addEventListener('change', updateStartButtons);
      box.dataset.tkGateBound = '1';
    });

    updateStartButtons();
  }

  function requestStart() {
    if (state.started) return;
    const app = doc.getElementById('surveyApp');
    if (!app) return;

    if (!app.classList.contains('is-prestart')) {
      activateStart();
      return;
    }

    setTimeout(() => {
      if (!app.classList.contains('is-prestart')) {
        activateStart();
      }
    }, 120);
  }

  function activateStart() {
    if (state.started) return;
    if (selectedCount() < 1) return;

    state.started = true;
    doc.body.classList.remove('tk-prestart');
    doc.documentElement.classList.remove('tk-gated');

    if (els.score) {
      els.score.style.display = '';
      if (els.right && els.score.parentNode !== els.right) {
        els.right.appendChild(els.score);
      }
    }

    if (typeof window.startSurvey === 'function') {
      try { window.startSurvey(); } catch (err) { console.error('[TK] startSurvey error', err); }
    }

    doc.dispatchEvent(new CustomEvent('tk:survey:start'));

    const firstQuestion = doc.querySelector('#questionArea, #questionCard, .survey-question-panel, .question-layout, [data-role="question-panel"]');
    firstQuestion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function observeSurveyStart() {
    const app = doc.getElementById('surveyApp');
    if (!app) return;

    const observer = new MutationObserver(() => {
      if (!app.classList.contains('is-prestart')) {
        activateStart();
      }
    });

    observer.observe(app, { attributes: true, attributeFilter: ['class'] });
  }

  function remount() {
    ensureRails();
    const hasPanel = moveCategories();
    moveQuestionAndScore();
    if (hasPanel) updateStartButtons();
  }

  function boot() {
    injectCss();
    doc.body.classList.add('tk-prestart');
    doc.documentElement.classList.add('tk-gated');

    remount();
    updateStartButtons();

    const app = doc.getElementById('surveyApp') || doc.body;
    const observer = new MutationObserver(() => {
      remount();
      updateStartButtons();
    });
    observer.observe(app, { childList: true, subtree: true });

    observeSurveyStart();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
