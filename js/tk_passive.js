/* TK passive listeners — makes touch/wheel non-blocking by default.
   Use {passive:false} only where you truly call event.preventDefault(). */
(() => {
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', { get(){ supportsPassive = true; } });
    window.addEventListener('tk-passive-test', () => {}, opts);
    window.removeEventListener('tk-passive-test', () => {}, opts);
  } catch {}
  if (!supportsPassive) return;

  const needsPassive = t => t === 'touchstart' || t === 'touchmove' || t === 'wheel';

  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options){
    // Respect explicit opts (pass {passive:false} if you really need to block scroll)
    if (!needsPassive(type)) return orig.call(this, type, listener, options);

    let opts = options;
    if (opts == null) {
      opts = { passive: true };
    } else if (typeof opts === 'boolean') {
      // boolean means "capture" in legacy signature
      opts = { capture: options, passive: true };
    } else if (opts && opts.passive === undefined) {
      opts = { ...opts, passive: true };
    }
    return orig.call(this, type, listener, opts);
  };
})();
