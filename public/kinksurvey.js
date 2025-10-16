/* Rewire existing action buttons without changing markup/positioning */
(() => {
  const INDIV_URL  = 'https://talkkink.org/individualkinkanalysis.html';
  const COMPAT_URL = 'https://talkkink.org/compatibility.html';

  // Helper: find an existing button by its visible text
  function findBtnByText(regex) {
    return Array.from(document.querySelectorAll('a,button'))
      .find(n => regex.test((n.textContent || '').trim()));
  }

  function hardNavigate(node, url) {
    if (node.tagName.toLowerCase() === 'a') {
      node.setAttribute('href', url);
      node.addEventListener('click', e => { /* allow default */ }, { once: true });
    } else {
      // Button: ensure clean click (remove old listeners if any) then navigate
      const clean = node.cloneNode(true);
      node.replaceWith(clean);
      clean.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = url;
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 1) Individual Kink Analysis — keep label, set URL
    const indivBtn = findBtnByText(/individual\s*kink\s*analysis/i);
    if (indivBtn) {
      indivBtn.setAttribute('aria-label', 'Individual Kink Analysis');
      hardNavigate(indivBtn, INDIV_URL);
    }

    // 2) Rename “Survey Partner Comparison” to “Compatibility Page”, set URL
    const compatBtn = findBtnByText(/survey\s*partner\s*comparison/i);
    if (compatBtn) {
      compatBtn.textContent = 'Compatibility Page';
      compatBtn.setAttribute('aria-label', 'Compatibility Page');
      hardNavigate(compatBtn, COMPAT_URL);
    }

    // Optional: console breadcrumb
    console.log('[TK] Rewired action buttons:', {
      indiv: !!indivBtn, compat: !!compatBtn
    });
  });
})();
