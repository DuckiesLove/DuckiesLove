// This enhancer adds: (a) a glowing outline around the active question card,
// (b) a “Question Guard” legend explaining the scale (with traffic-light colors),
// (c) a compact 0–5 chip row that maps to the page’s existing buttons.
// It waits for the survey UI, so it’s safe to load after survey.js.

(() => {
  const SCRIPT_FLAG = '__tkEnhancerLoaded';
  if (window[SCRIPT_FLAG]) return;
  window[SCRIPT_FLAG] = true;

  const STYLE = `
  /* --- Glow around the question card --- */
  .tk-qcard-glow {
    position: relative !important;
    border-radius: 14px !important;
    box-shadow: 0 0 0 1px rgba(0,255,255,.18),
                0 0 24px rgba(0,255,255,.14),
                inset 0 0 30px rgba(0,0,0,.25) !important;
    border: 1px solid rgba(0,255,255,.22) !important;
  }
  /* --- Legend box --- */
  .tk-legend {
    margin: 12px 0 10px 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(6,12,18,.6);
    border: 1px solid rgba(0,255,255,.16);
    box-shadow: 0 0 10px rgba(0,255,255,.08);
    font-size: .95rem;
    line-height: 1.3;
  }
  .tk-legend h4 {
    margin: 0 0 8px 0;
    font-weight: 600;
    font-size: 1rem;
    text-shadow: 0 0 10px rgba(0,255,255,.25);
  }
  .tk-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 9px;
    margin: 4px 6px 0 0;
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.12);
    white-space: nowrap;
    font-size: .9rem;
  }
  .tk-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .tk-red   { background:#ff3860; box-shadow:0 0 8px rgba(255,56,96,.6); }
  .tk-amber { background:#ffcc00; box-shadow:0 0 8px rgba(255,204,0,.55); }
  .tk-green { background:#2bd67b; box-shadow:0 0 8px rgba(43,214,123,.55); }
  .tk-blue  { background:#67b3ff; box-shadow:0 0 8px rgba(103,179,255,.55); }

  /* --- Mini 0–5 chip row (click-through to existing buttons) --- */
  .tk-chips {
    margin: 8px 0 4px 0;
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .tk-chip {
    cursor: pointer;
    user-select: none;
    padding: 6px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.12);
    transition: transform .08s ease, box-shadow .12s ease, border-color .12s ease;
    font-weight: 600;
    font-size: .95rem;
  }
  .tk-chip:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0,255,255,.12);
    border-color: rgba(0,255,255,.28);
  }
  `;

  function insertStyleOnce() {
    if (document.getElementById('tk-enhancer-style')) return;
    const style = document.createElement('style');
    style.id = 'tk-enhancer-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function findScaleAnchor(root) {
    // Grab the node that contains “Rate interest/comfort” text
    const all = root.querySelectorAll('*');
    for (const n of all) {
      if (n.childElementCount === 0 && /rate\s+interest\/comfort/i.test(n.textContent || '')) {
        return n.parentElement || n;
      }
    }
    return null;
  }

  function findQuestionCard(anchor) {
    // Bubble up to the per-question container
    return anchor?.closest('section, article, div');
  }

  function findExistingButtons(card) {
    // Existing 0–5 buttons (the originals). We’ll trigger click on them.
    const btns = [...card.querySelectorAll('button, a, div, span')].filter(el =>
      /^\s*[012345]\s*$/.test(el.textContent || '')
    );
    // Normalize first occurrence of each 0..5
    const map = {};
    btns.forEach(el => {
      const k = el.textContent.trim();
      if (!(k in map)) map[k] = el;
    });
    return map;
  }

  function buildLegend() {
    const wrap = document.createElement('div');
    wrap.className = 'tk-legend';
    wrap.innerHTML = `
      <h4>Question Guard • How to score</h4>
      <div class="tk-pill"><span class="tk-dot tk-red"></span><strong>0</strong> Hard Limit — full stop 🚫</div>
      <div class="tk-pill"><span class="tk-dot tk-amber"></span><strong>1–2</strong> Soft Limit — yellow light, proceed carefully</div>
      <div class="tk-pill"><span class="tk-dot tk-green"></span><strong>3–5</strong> Interested/Comfortable — green means go</div>
      <div class="tk-pill"><span class="tk-dot tk-blue"></span><strong>0*</strong> “Brain did a cartwheel” — skipped for now 😅</div>
    `;
    return wrap;
  }

  function buildChips(existingMap) {
    const row = document.createElement('div');
    row.className = 'tk-chips';
    ['0','1','2','3','4','5'].forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'tk-chip';
      chip.textContent = v;
      chip.title = ({
        '0':'Hard limit or skip',
        '1':'Soft limit (cautious)',
        '2':'Soft limit (context-dependent)',
        '3':'Interested',
        '4':'Comfortable',
        '5':'Very comfortable'
      })[v];
      chip.addEventListener('click', () => {
        const btn = existingMap[v];
        if (btn) btn.click();
      });
      row.appendChild(chip);
    });
    return row;
  }

  function enhance() {
    insertStyleOnce();
    const app = document.getElementById('surveyApp') || document.body;
    const anchor = findScaleAnchor(app);
    if (!anchor) return; // survey not ready yet

    // Card & glow
    const card = findQuestionCard(anchor);
    if (card && !card.classList.contains('tk-qcard-glow')) {
      card.classList.add('tk-qcard-glow');
    }

    // Inject legend (only once)
    if (!card.querySelector('.tk-legend')) {
      const legend = buildLegend();
      anchor.parentElement.insertBefore(legend, anchor);
    }

    // Add chip row (only once)
    if (!card.querySelector('.tk-chips')) {
      const map = findExistingButtons(card);
      const chips = buildChips(map);
      anchor.parentElement.insertBefore(chips, anchor.nextSibling);
    }
  }

  function boot() {
    enhance();
    // Re-run on content changes while navigating questions
    const target = document.getElementById('surveyApp') || document.body;
    const obs = new MutationObserver(() => setTimeout(enhance, 20));
    obs.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Tiny badge so you know it loaded
  try {
    const badge = document.createElement('div');
    badge.textContent = 'TK in-page enhancer loaded';
    Object.assign(badge.style, {
      position: 'fixed', top: '10px', left: '10px', zIndex: 999999,
      fontSize: '12px', padding: '6px 10px', borderRadius: '8px',
      background: 'rgba(0,0,0,.6)', color: '#9ff', border: '1px solid rgba(0,255,255,.35)',
      boxShadow: '0 0 12px rgba(0,255,255,.25)'
    });
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 1600);
  } catch {}
})();

