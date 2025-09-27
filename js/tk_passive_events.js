/*! TK passive events: default passive:true for scroll-blocking inputs.
    Opt-out: add {passive:false} or visit ?tkpassive=0 */
(() => {
  try {
    if (new URL(location.href).searchParams.get('tkpassive') === '0') return;
  } catch {}
  // Detect passive support
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', { get() { supportsPassive = true; } });
    window.addEventListener('tk-passive-test', null, opts);
    window.removeEventListener('tk-passive-test', null, opts);
  } catch {}
  if (!supportsPassive) return;

  const PASSIVE_EVENTS = new Set(['touchstart','touchmove','wheel','mousewheel']);
  const ET = (window.EventTarget || window.Node || function(){}).prototype;
  const origAdd = ET.addEventListener;

  ET.addEventListener = function(type, listener, options){
    try {
      if (PASSIVE_EVENTS.has(type)) {
        if (options == null) {
          options = { passive: true };
        } else if (typeof options === 'boolean') {
          options = { capture: options, passive: true };
        } else if (typeof options === 'object' && !('passive' in options)) {
          options = Object.assign({}, options, { passive: true });
        }
      }
    } catch {}
    return origAdd.call(this, type, listener, options);
  };
})();
