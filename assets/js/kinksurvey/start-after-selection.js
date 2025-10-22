(() => {
  const onSurveyPage = location.pathname.replace(/\/+$/, '') === '/kinksurvey';
  if (!onSurveyPage) return;

  const doc = document;
  const state = { started: false };
  const els = { host: null, left: null, main: null, right: null, start: null, score: null };

  const CSS = `
  :root{ --dock-gap:24px; --dock-w:360px; --dock-edge:#142331; --dock-bg:#0b1016; }
  html.tk-gated #tkDockRight,
  html.tk-gated [data-sticky="score"],
  html.tk-gated .how-to-score,
  html.tk-gated #tkScoreDock{display:none !important;}
  html.tk-gated #questionArea,
  html.tk-gated #questionCard,
  html.tk-gated .survey-question-panel,
  html.tk-gated .question-layout,
  html.tk-gated [data-role="question-panel"]{display:none !important;}
  #tkDockHost{display:grid;grid-template-columns:minmax(320px,var(--dock-w)) 1fr minmax(280px,0.85fr);gap:var(--dock-gap);align-items:start;margin:0 20px 40px;}
  @media (max-width:1200px){#tkDockHost{grid-template-columns:minmax(320px,var(--dock-w)) 1fr}}
  @media (max-width:960px){#tkDockHost{grid-template-columns:1fr}}
  #tkDockLeft,#tkDockMain,#tkDockRight{min-height:1px}
  #tkDockLeft{position:sticky;top:96px;align-self:start}
  #tkDockLeft .tk-panel{background:var(--dock-bg);border:1px solid var(--dock-edge);border-radius:14px;box-shadow:0 8px 22px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.06);padding:8px}
  #tkIntro{display:none;margin:0 auto 16px;max-width:980px;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 8px 22px rgba(0,0,0,.35), inset 0 0 0 1px rgba(0,170,255,.15);padding:18px 20px}
  #tkIntro .cta{display:inline-flex;gap:10px;align-items:center;padding:10px 14px;border-radius:999px;background:#121821;border:1px solid #1b2b3a;cursor:not-allowed;opacity:.55;transition:opacity .15s ease, box-shadow .15s ease}
  #tkIntro .cta.is-ready{cursor:pointer;opacity:1;box-shadow:0 0 0 1px rgba(0,0,0,.35) inset, 0 0 14px rgba(77,163,255,.35)}
  `;

  function injectCss() {
    if (doc.getElementById('tkDockGateCss')) return;
    const style = doc.createElement('style');
    style.id = 'tkDockGateCss';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function ensureDockLayoutNodes() {
    if (!els.host) {
      let host = doc.getElementById('tkDockHost');
      if (!host) {
        host = doc.createElement('div');
        host.id = 'tkDockHost';
        const anchor = doc.querySelector('#surveyApp .tk-wrap') || doc.getElementById('surveyApp') || doc.body;
        if (anchor.firstChild) {
          anchor.insertBefore(host, anchor.firstChild);
        } else {
          anchor.appendChild(host);
        }
      }
      els.host = host;
    }

    if (!els.left) {
      let left = doc.getElementById('tkDockLeft');
      if (!left) {
        left = doc.createElement('aside');
        left.id = 'tkDockLeft';
      }
      if (left.parentNode !== els.host) {
        els.host.insertBefore(left, els.host.firstChild);
      }
      els.left = left;
    }

    if (!els.main) {
      let main = doc.getElementById('tkDockMain');
      if (!main) {
        main = doc.createElement('section');
        main.id = 'tkDockMain';
      }
      if (main.parentNode !== els.host) {
        if (els.host.children.length > 1) {
          els.host.insertBefore(main, els.host.children[1]);
        } else {
          els.host.appendChild(main);
        }
      }
      els.main = main;
    }

    if (!els.right) {
      let right = doc.getElementById('tkDockRight');
      if (!right) {
        right = doc.createElement('aside');
        right.id = 'tkDockRight';
      }
      if (right.parentNode !== els.host) {
        els.host.appendChild(right);
      }
      els.right = right;
    }
  }

  function mountDockPanel() {
    const panel = doc.querySelector('#categoryPanel, .category-panel, [data-role="category-panel"]');
    if (!panel) return false;

    panel.removeAttribute('style');
    let shell = panel.parentElement;
    if (!shell || !shell.classList.contains('tk-panel')) {
      shell = doc.createElement('div');
      shell.className = 'tk-panel';
      shell.appendChild(panel);
    }
    if (shell.parentNode !== els.left) {
      els.left.innerHTML = '';
      els.left.appendChild(shell);
    }
    return true;
  }

  function mountQuestionArea() {
    const targets = [
      '#ctaStack',
      '.tk-meta',
      '.tk-survey-shell',
      '#questionArea',
      '#questionCard',
      '.survey-question-panel',
    ];
    let mounted = false;

    for (const sel of targets) {
      const node = doc.querySelector(sel);
      if (!node) continue;
      if (node.parentNode !== els.main) {
        els.main.appendChild(node);
      }
      mounted = true;
    }

    return mounted;
  }

  function findScoreDock() {
    if (els.score && doc.contains(els.score)) return;
    const dock = doc.querySelector('#tkScoreDock, .score-sidebar, [data-sticky="score"]');
    if (!dock) return;
    els.score = dock;
    dock.style.display = 'none';
  }

  function ensureGate() {
    if (state.started) return;
    if (els.start && doc.contains(els.start)) return;
    const intro = doc.createElement('div');
    intro.id = 'tkIntro';
    intro.innerHTML = `
      <h3 style="margin:0 0 6px 0;font-weight:800">Select at least one category to begin</h3>
      <ul style="margin:8px 0 14px 18px;line-height:1.45">
        <li>0 — skip for now</li>
        <li>1 — hard limit (no-go)</li>
        <li>2 — soft limit / willing to try</li>
        <li>3 — context-dependent</li>
        <li>4 — enthusiastic yes</li>
        <li>5 — favorite / please do</li>
      </ul>
      <button id="tkStart" class="cta" disabled>Start Survey</button>
    `;
    els.main.prepend(intro);
    intro.style.display = 'block';
    els.start = intro.querySelector('#tkStart');
    els.start?.addEventListener('click', handleIntroStart);
  }

  function selectedCount() {
    const scope = els.left || doc;
    return scope ? scope.querySelectorAll('input[type="checkbox"]:checked,[role="checkbox"][aria-checked="true"]').length : 0;
  }

  function updateStartButtons() {
    const any = selectedCount() > 0;
    if (els.start) {
      els.start.toggleAttribute('disabled', !any);
      els.start.classList.toggle('is-ready', any);
    }

    const navBtn = doc.getElementById('btnStart');
    if (navBtn) {
      if (!navBtn.dataset.tkGateBound) {
        navBtn.addEventListener('click', () => {
          if (selectedCount() > 0) {
            requestStart();
          }
        });
        navBtn.dataset.tkGateBound = '1';
      }
      navBtn.disabled = !any;
      navBtn.title = any ? '' : 'Select at least one category to start';
      navBtn.classList.toggle('tk-disabled', !any);
      navBtn.setAttribute('aria-disabled', String(!any));
    }
  }

  function bindCategoryWatcher() {
    const panel = doc.getElementById('categoryPanel');
    if (!panel) return;

    const register = () => {
      const boxes = panel.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
      boxes.forEach((box) => {
        if (box.dataset.tkGateBound) return;
        box.addEventListener('change', updateStartButtons);
        box.dataset.tkGateBound = '1';
      });
      updateStartButtons();
    };

    register();

    const mo = new MutationObserver(register);
    mo.observe(panel, { childList: true, subtree: true });
  }

  function handleIntroStart() {
    if (selectedCount() < 1) return;
    const navBtn = doc.getElementById('btnStart');
    if (navBtn) {
      navBtn.click();
    } else {
      requestStart();
    }
  }

  function requestStart() {
    if (state.started) return;
    const app = doc.getElementById('surveyApp');
    if (app && !app.classList.contains('is-prestart')) {
      activateStart();
      return;
    }
    setTimeout(() => {
      const host = doc.getElementById('surveyApp');
      if (host && !host.classList.contains('is-prestart')) {
        activateStart();
      }
    }, 120);
  }

  function activateStart() {
    if (state.started) return;
    if (selectedCount() < 1) return;
    state.started = true;

    window.TK_GATE = false;
    doc.body.classList.remove('tk-prestart');
    doc.documentElement.classList.remove('tk-gated');

    if (els.score) {
      els.score.style.display = '';
      if (els.right && els.score.parentNode !== els.right) {
        els.right.appendChild(els.score);
      }
      if (els.right) {
        els.right.style.display = '';
      }
    }

    const intro = doc.getElementById('tkIntro');
    intro?.remove();
    els.start = null;
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
    ensureDockLayoutNodes();
    const hasPanel = mountDockPanel();
    const hasMain = mountQuestionArea();
    if (hasPanel) bindCategoryWatcher();
    if (hasMain) ensureGate();
    findScoreDock();
    updateStartButtons();
  }

  function boot() {
    injectCss();
    window.TK_GATE = true;
    doc.body.classList.add('tk-prestart');
    doc.documentElement.classList.add('tk-gated');
    remount();

    const app = doc.getElementById('surveyApp') || doc.body;
    const observer = new MutationObserver(() => {
      remount();
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
