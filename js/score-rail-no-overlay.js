(() => {
  const TAG = '[TK rail]';

  if (window.__TK_SCORE_RAIL__) {
    console.debug(TAG, 'already present; skipping');
    return;
  }
  window.__TK_SCORE_RAIL__ = true;

  const CSS_ID = 'tk-score-rail-css';
  if (!document.getElementById(CSS_ID)) {
    const css = document.createElement('style');
    css.id = CSS_ID;
    css.textContent = `
      :root{
        --rail-bg: rgba(8,14,18,.72);
        --rail-br: 16px;
        --rail-border: 1px solid rgba(0,255,255,.25);
        --rail-glow: 0 0 24px rgba(0,224,255,.25);
        --chip-bg: #0e1418;
        --chip-fg: #e8f6ff;
        --chip-br: 12px;
        --chip-pad: 8px 10px;
        --chip-gap: 10px;
        --muted: #88a3b8;
      }

      .tk-rail{
        position: fixed;
        top: 132px;
        right: 24px;
        z-index: 6000;
        width: 420px;
        background: var(--rail-bg);
        border-radius: var(--rail-br);
        border: var(--rail-border);
        box-shadow: var(--rail-glow);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        color: var(--chip-fg);
        padding: 14px;
      }

      .tk-rail h3{
        margin: 0 0 10px 0;
        font-size: 14px;
        letter-spacing:.02em;
        color: #bfefff;
        text-shadow: 0 0 10px rgba(0,224,255,.35);
      }

      .tk-rail .tk-row{
        display: flex;
        flex-wrap: wrap;
        gap: var(--chip-gap);
        align-items: stretch;
      }

      .tk-chip{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--chip-bg);
        color: var(--chip-fg);
        border-radius: var(--chip-br);
        padding: var(--chip-pad);
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
        white-space: nowrap;
        font-size: 13px;
        line-height: 1.15;
      }

      .tk-num{
        width: 22px; height: 22px; min-width: 22px;
        display: grid; place-items: center;
        font-weight: 700;
        border-radius: 999px;
        color: #021016;
        background: #9bdcff;
        box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset;
      }

      .tk-0 .tk-num{ background:#9bdcff; }
      .tk-1 .tk-num{ background:#ff7474; }
      .tk-2 .tk-num{ background:#ffd04d; }
      .tk-3 .tk-num{ background:#78f9a6; }
      .tk-4 .tk-num{ background:#57e28c; }
      .tk-5 .tk-num{ background:#35c970; }

      .tk-caption{ color: var(--chip-fg); }
      .tk-sub{ color: var(--muted); }

      .tk-mini{
        margin-top: 10px;
        font-size: 11px;
        color: var(--muted);
        opacity:.9;
      }

      @media (max-width: 1100px){
        .tk-rail{ width: 360px; right: 12px; }
      }
      @media (max-width: 920px){
        .tk-rail{ width: 320px; right: 8px; }
      }
    `;
    document.head.appendChild(css);
  }

  const rail = document.createElement('aside');
  rail.className = 'tk-rail';
  rail.setAttribute('role', 'complementary');
  rail.setAttribute('aria-label', 'How to score');

  const h3 = document.createElement('h3');
  h3.textContent = 'How to score';
  rail.appendChild(h3);

  const row = document.createElement('div');
  row.className = 'tk-row';
  row.append(
    chip(0, 'Brain did a cartwheel — skipped for now 😅'),
    chip(1, 'Hard Limit — full stop / non-negotiable'),
    chip(2, 'Soft Limit — willing to try with strong boundaries & aftercare'),
    chip(3, 'Curious / context-dependent — discuss & negotiate'),
    chip(4, 'Comfortable / enjoy — generally a yes'),
    chip(5, 'Favorite / enthusiastic yes — happily into it'),
  );
  rail.appendChild(row);

  const mini = document.createElement('div');
  mini.className = 'tk-mini';
  mini.textContent = 'Tip: the color system mirrors a traffic light — red stop, yellow caution, green go.';
  rail.appendChild(mini);

  const mount = () => {
    if (!document.body) {
      setTimeout(mount, 50);
      return;
    }
    const old = document.querySelector('.tk-rail');
    if (old) old.remove();
    document.body.appendChild(rail);
  };
  mount();

  console.debug(TAG, 'rendered (no overlay)');

  function chip(n, caption){
    const el = document.createElement('div');
    el.className = `tk-chip tk-${n}`;
    const num = document.createElement('span');
    num.className = 'tk-num';
    num.textContent = n;
    const cap = document.createElement('span');
    cap.className = 'tk-caption';
    cap.textContent = caption;
    el.append(num, cap);
    return el;
  }
})();
