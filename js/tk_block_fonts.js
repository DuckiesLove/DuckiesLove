/*! TK: hard block Google Fonts (static + dynamic) */
(() => {
  const BAD = href => typeof href === 'string' && /fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href);
  const nuke = el => { try { el.disabled = true; el.remove(); } catch {} };

  // Initial sweep
  function sweep() {
    document.querySelectorAll('link[rel][href]').forEach(l => { if (BAD(l.getAttribute('href'))) nuke(l); });
    document.documentElement.classList.add('tk-font-fallback');
  }

  // Patch link attribute assignment
  const origSet = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (this.tagName === 'LINK' && name && name.toLowerCase() === 'href' && BAD(String(value))) { nuke(this); return; }
    return origSet.apply(this, arguments);
  };

  // Patch DOM insertion APIs
  for (const Proto of [Element.prototype, Node.prototype, Document.prototype, DocumentFragment.prototype]) {
    for (const method of ['appendChild', 'insertBefore']) {
      const orig = Proto[method];
      if (typeof orig !== 'function') continue;
      Object.defineProperty(Proto, method, {
        configurable: true,
        writable: true,
        value: function(node, ref) {
          try { if (node && node.tagName === 'LINK' && BAD(node.getAttribute('href'))) { nuke(node); return node; } } catch {}
          return orig.call(this, node, ref);
        }
      });
    }
  }

  // Observe SPA frameworks that mutate <head>
  try {
    const mo = new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes || []) {
        if (n && n.tagName === 'LINK' && BAD(n.getAttribute('href'))) nuke(n);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10000); // stop after boot
  } catch {}

  // Run immediately & again on DOMContentLoaded
  sweep();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sweep, { once: true });
})();
