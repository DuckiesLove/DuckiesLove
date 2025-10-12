/* Category panel probe: console helper to locate survey category panels */
(function(){
  const panel = (function(){
    let hit = null;
    (function walk(root){
      const stack = [root];
      while (stack.length) {
        const n = stack.pop();
        if (hit) break;
        if (n.shadowRoot) stack.push(n.shadowRoot);
        if (n.childNodes) {
          for (let i = n.childNodes.length - 1; i >= 0; i--) {
            stack.push(n.childNodes[i]);
          }
        }
        if (n instanceof Element) {
          const looks =
            /category.*panel/i.test(n.className || "") ||
            /categorySurveyPanel/i.test(n.id || "") ||
            /select\s*categories|deselect\s*all/i.test((n.textContent || "").toLowerCase());
          if (
            looks &&
            (n.querySelector('input[type="checkbox"]') ||
              /appearance\s*play|behavioral\s*play|bondage/i.test(n.textContent || ""))
          ) {
            hit = n.closest("aside,section,div") || n;
          }
        }
      }
    })(document);
    return hit;
  })();
  console.log("Panel probe:", panel, panel && { id: panel.id, class: panel.className });
})();
