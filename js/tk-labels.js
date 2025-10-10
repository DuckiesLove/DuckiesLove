;(function () {
  /* global TK */
  const codeRe = /^cb_[a-z0-9]+$/i;

  async function applyLabelsInTable() {
    const { labelsMap } = await TK.loadKinkData();
    const map = labelsMap || {};
    document.querySelectorAll('table td, table th').forEach(td => {
      const raw = (td.textContent || '').trim();
      if (codeRe.test(raw) && map[raw]) {
        td.textContent = map[raw];
      }
    });
  }

  document.addEventListener('DOMContentLoaded', applyLabelsInTable);
})();
