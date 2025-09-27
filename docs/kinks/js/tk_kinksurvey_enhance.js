/*! Talk Kink kinksurvey enhancements */
(function(){
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, html = "") => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value == null) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    });
    if (html) node.innerHTML = html;
    return node;
  };

  function ensureHero(){
    // If an old hero exists, replace it to avoid duplicates/styles from prior patches
    $all('.tk-hero').forEach(n=>n.remove());

    const legacyWrap = $('.landing-wrapper');
    const wrap = legacyWrap?.parentElement || $('.wrap, main, .page, .kinks-root, body');
    const anchor = legacyWrap || $('#categoryPanel') || $('.category-panel') || wrap?.firstChild;
    if (!wrap || !anchor) return;

    const hero = el('section',{class:'tk-hero','aria-label':'Main actions'});
    hero.appendChild(el('h1',{class:'tk-title'},'Talk Kink — Survey'));

    const heroTop = el('div',{class:'tk-heroTop'});
    const startSelectors = ['#startSurvey','#startBtn','#start','#startSurveyBtn','[data-start]'];
    let startNode = null;
    for (const sel of startSelectors) {
      const candidate = $(sel);
      if (candidate) { startNode = candidate; break; }
    }

    let usingExistingStart = false;
    if (legacyWrap && startNode && legacyWrap.contains(startNode)) {
      startNode.classList.add('tk-btn','xl');
      heroTop.appendChild(startNode);
      usingExistingStart = true;
    } else {
      startNode = el('button',{class:'tk-btn xl', id:'tkHeroStart', type:'button'},'Start Survey');
      heroTop.appendChild(startNode);
    }
    hero.appendChild(heroTop);

    const pillRow = el('div',{class:'tk-heroRow'});
    pillRow.innerHTML = `
      <a class="tk-pill" href="/compatibility/">Compatibility Page</a>
      <a class="tk-pill" href="/ika/">Individual Kink Analysis</a>
      <a class="tk-pill" href="/apply/">Request to Join Mischief Manor</a>
    `;
    hero.appendChild(pillRow);

    const themeRow = el('div',{class:'tk-heroRow', id:'tkThemeRow'});
    hero.appendChild(themeRow);

    if (anchor && anchor.parentNode === wrap) {
      wrap.insertBefore(hero, anchor);
    } else {
      wrap.insertBefore(hero, wrap.firstChild);
    }

    // Move any existing theme selector into the theme row
    const themeContainer = $('#tkThemeRow', hero);
    const existingTheme =
      (legacyWrap && $('#themeSelector', legacyWrap)) ||
      $('#themeSelector') ||
      $('.theme-select') ||
      $('select[name="theme"]');
    if (existingTheme) {
      const label = el('label',{class:'tk-theme'},`Theme`);
      label.appendChild(existingTheme);
      themeContainer.appendChild(label);
    } else {
      // No theme selector present—hide the row
      themeContainer.style.display='none';
    }

    // Preserve warnings/info blocks that previously lived inside the landing wrapper
    if (legacyWrap) {
      const warning = $('#warning', legacyWrap) || $('#warning');
      if (warning && hero !== warning.parentNode) {
        hero.appendChild(warning);
      }
    }

    legacyWrap?.remove();

    // Scroll/focus to panel Start on big Start click if we had to create a synthetic button
    if (!usingExistingStart) {
      const go = ()=> {
        const panel = $('#categoryPanel') || $('.category-panel');
        const start = $('#startBtn') || $('#startSurvey') || $('#startSurveyBtn') || $('[data-start]');
        if (panel) panel.scrollIntoView({behavior:'smooth', block:'start'});
        setTimeout(()=> start && start.focus && start.focus(), 300);
      };
      startNode?.addEventListener('click', go);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureHero);
  } else {
    ensureHero();
  }
})();
