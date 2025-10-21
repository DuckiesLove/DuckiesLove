(() => {
  const w = typeof window !== 'undefined' ? window : null;
  if (!w) return;

  const FLAG = '__tkEnhancer_v2';
  if (w[FLAG]) return;
  w[FLAG] = true;

  if (document.currentScript) {
    document.currentScript.dataset.tkLoadedOnce = '1';
  }

  const DOCK_FLAG = '__tkDockEnhancer__';
  if (!w[DOCK_FLAG]) {
    w[DOCK_FLAG] = true;

    const ensureDockLayoutNodes = () => {
      const portal = document.getElementById('tkPortal');
      if (!portal) return false;

      portal.dataset.tkDock = '1';

      const left = portal.querySelector('.tk-left');
      if (left) {
        left.dataset.role = left.dataset.role || 'category-panel';
      }

      const right = portal.querySelector('.tk-right');
      if (right) {
        right.dataset.role = right.dataset.role || 'survey-shell';
      }

      const app = document.getElementById('surveyApp');
      if (app) {
        app.dataset.tkDock = '1';
      }

      return true;
    };

    const normalizeButton = (button) => {
      if (!button) return;
      button.classList.add('btn');
      if (!button.hasAttribute('type')) {
        button.setAttribute('type', 'button');
      }
    };

    const mountDockPanel = () => {
      const panel = document.getElementById('categoryPanel');
      if (!panel) return false;

      panel.dataset.tkDockPanel = '1';
      panel.removeAttribute('hidden');
      panel.classList.add('panel');

      const checklist = panel.querySelector('#categoryChecklist');
      if (checklist) {
        checklist.setAttribute('role', checklist.getAttribute('role') || 'list');
      }

      return true;
    };

    const mountDockActions = () => {
      const stack = document.getElementById('ctaStack');
      if (stack) {
        stack.classList.add('tk-stack');
        stack.querySelectorAll('a,button').forEach(normalizeButton);
      }

      const navRow = document.getElementById('navRow');
      if (navRow) {
        navRow.dataset.tkDockActions = '1';
        navRow.querySelectorAll('button').forEach(normalizeButton);
      }

      return Boolean(stack || navRow);
    };

    const setupDockedSurveyLayout = () => {
      ensureDockLayoutNodes();
      mountDockPanel();
      mountDockActions();

      const root = document.getElementById('surveyApp');
      if (root && root.dataset.tkReady !== 'true') {
        root.dataset.tkReady = root.dataset.tkReady || 'false';
      }

      document.documentElement.setAttribute('data-tk-docked', 'true');
    };

    w.ensureDockLayoutNodes = ensureDockLayoutNodes;
    w.mountDockPanel = mountDockPanel;
    w.mountDockActions = mountDockActions;
    w.setupDockedSurveyLayout = setupDockedSurveyLayout;
  }

  const CSS = `
  .tk-qcard-glow{
    position:relative;border-radius:14px!important;
    box-shadow:0 0 0 1px rgba(0,255,255,.18),0 0 24px rgba(0,255,255,.14),inset 0 0 30px rgba(0,0,0,.25)!important;
    border:1px solid rgba(0,255,255,.22)!important;
  }
  .tk-legend{margin:12px 0 6px 0;padding:14px 16px;border-radius:12px;
    background:rgba(6,12,18,.6);border:1px solid rgba(0,255,255,.16);
    box-shadow:0 0 10px rgba(0,255,255,.08);font-size:.95rem;line-height:1.25}
  .tk-legend h4{margin:0 0 10px 0;font-weight:700;font-size:1rem;
    text-shadow:0 0 10px rgba(0,255,255,.25)}
  .tk-row{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:6px 0;
    border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09)}
  .tk-badge{display:inline-flex;align-items:center;justify-content:center;
    width:26px;height:26px;border-radius:50%;font-weight:800;color:#02131a}
  .tk-blue   {background:#67b3ff; box-shadow:0 0 8px rgba(103,179,255,.55)}
  .tk-red    {background:#ff3860; box-shadow:0 0 8px rgba(255,56,96,.6)}
  .tk-amber  {background:#ffcc00; box-shadow:0 0 8px rgba(255,204,0,.55)}
  .tk-lime   {background:#b3ff66; box-shadow:0 0 8px rgba(179,255,102,.45)}
  .tk-green  {background:#2bd67b; box-shadow:0 0 8px rgba(43,214,123,.55)}
  .tk-emerald{background:#1dd1a1; box-shadow:0 0 8px rgba(29,209,161,.55)}
  `;

  function injectCss(){
    if(document.getElementById('tk-style-v2')) return;
    const s=document.createElement('style'); s.id='tk-style-v2'; s.textContent=CSS;
    document.head.appendChild(s);
  }

  // Find the “Rate interest/comfort (0–5)” anchor inside the current question card
  const TEXT_RX = /rate\s+interest\s*\/?\s*comfort/i;

  function isVisible(node){
    if(!node) return false;
    if(!(node instanceof Element)) return false;
    if(node.hidden) return false;
    const style = window.getComputedStyle(node);
    if(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if(node.offsetParent === null && style.position !== 'fixed') return false;
    return true;
  }

  function findScaleAnchor(root){
    const candidates=[];
    const all=root.querySelectorAll('*');
    for(const n of all){
      if(n.childElementCount===0 && TEXT_RX.test(n.textContent||'')) {
        candidates.push(n.parentElement||n);
      }
    }
    if(!candidates.length) return null;

    const visible = candidates.filter(el => isVisible(findCard(el)) && isVisible(el));
    if(visible.length) return visible[visible.length-1];

    return candidates[candidates.length-1];
  }
  function findCard(anchor){ return anchor?.closest('section, article, div'); }

  function buildLegend(){
    const box=document.createElement('div');
    box.className='tk-legend';
    box.innerHTML=`
      <h4>How to score</h4>

      <div class="tk-row">
        <span class="tk-badge tk-blue">0</span>
        <div><strong>Brain did a cartwheel</strong> — skipped for now 😅</div>
      </div>

      <div class="tk-row">
        <span class="tk-badge tk-red">1</span>
        <div><strong>Hard Limit</strong> — full stop / no-go (non-negotiable)</div>
      </div>

      <div class="tk-row">
        <span class="tk-badge tk-amber">2</span>
        <div><strong>Soft Limit — willing to try</strong> with strong boundaries, safety checks, and aftercare planned</div>
      </div>

      <div class="tk-row">
        <span class="tk-badge tk-lime">3</span>
        <div><strong>Curious / context-dependent</strong> — okay with discussion, mood, and trust; needs clear negotiation</div>
      </div>

      <div class="tk-row">
        <span class="tk-badge tk-green">4</span>
        <div><strong>Comfortable / enjoy</strong> — generally a yes; normal precautions and check-ins</div>
      </div>

      <div class="tk-row">
        <span class="tk-badge tk-emerald">5</span>
        <div><strong>Favorite / enthusiastic yes</strong> — happily into it; green light</div>
      </div>
    `;
    return box;
  }

  function enhance(){
    injectCss();
    const app=document.getElementById('surveyApp')||document.body;
    const anchor=findScaleAnchor(app);
    if(!anchor) return;

    const card=findCard(anchor);
    const cards=document.querySelectorAll('.tk-qcard-glow');
    cards.forEach(c=>{ if(c!==card) c.classList.remove('tk-qcard-glow'); });
    if(card && !card.classList.contains('tk-qcard-glow')) card.classList.add('tk-qcard-glow');

    // Remove duplicates: keep only the first legend in this card
    const existing=card?[...card.querySelectorAll('.tk-legend')]:[];
    if(existing.length>1) existing.slice(1).forEach(n=>n.remove());
    if(card){
      document.querySelectorAll('.tk-legend').forEach(node=>{
        if(node.closest('section, article, div')!==card) node.remove();
      });
    }
    if(existing.length===0){
      const legend=buildLegend();
      if(anchor.parentElement){
        anchor.parentElement.insertBefore(legend, anchor);
      } else if(card){
        card.insertBefore(legend, card.firstChild);
      } else {
        const fallback=document.body||document.documentElement;
        if(fallback){
          fallback.insertBefore(legend, fallback.firstChild||null);
        } else {
          document.appendChild(legend);
        }
      }
    }

    const legacyGuard = card?.querySelector('#tk-guard');
    if (legacyGuard) {
      legacyGuard.textContent = '';
      legacyGuard.setAttribute('hidden', '');
      legacyGuard.setAttribute('aria-hidden', 'true');
      legacyGuard.classList.add('tk-hidden');
      legacyGuard.style.display = 'none';
    }
  }

  function boot(){
    enhance();
    const target=document.getElementById('surveyApp')||document.body;
    const mo=new MutationObserver(()=>setTimeout(enhance,20));
    mo.observe(target,{childList:true,subtree:true});
  }

  (document.readyState==='loading')
    ? document.addEventListener('DOMContentLoaded', boot, {once:true})
    : boot();
})();
