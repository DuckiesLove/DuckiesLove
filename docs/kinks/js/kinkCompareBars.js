function getColor(score) {
  if (score >= 80) return '#00cc44';  // green
  if (score >= 30) return '#ffaa00';  // yellow
  return '#cc0033';                   // red
}

function renderKinkBar(role, score) {
  const percent = score * 20; // assumes score is 0–5 scale
  return `
    <div class="kink-bar-row">
      <div class="kink-label">${role}</div>
      <div class="kink-bar-container">
        <div class="kink-bar-fill" style="width: ${percent}%; background-color: ${getColor(percent)};"></div>
      </div>
      <div class="kink-score">${score > 0 ? score : '-'}</div>
    </div>
  `;
}

function renderKinkSection(title, g, r, n) {
  return `
    <div class="kink-compare-section">
      <div class="kink-title">${title}</div>
      ${renderKinkBar('Giving', g)}
      ${renderKinkBar('Receiving', r)}
      ${renderKinkBar('Non-Specific', n)}
    </div>
  `;
}

// Example usage
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('pdf-container');
  if (el) {
    el.innerHTML += renderKinkSection('Nipple clips', 5, 5, 0);
  }
});
