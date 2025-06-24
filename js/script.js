document.addEventListener('DOMContentLoaded', () => {
  const dropdown = document.getElementById('themeDropdown');
  const savedTheme = localStorage.getItem('selectedTheme');

  // Set default to dark-mode if nothing is stored
  const initialTheme = savedTheme || 'dark-mode';
  document.body.className = initialTheme;
  dropdown.value = initialTheme;

  dropdown.addEventListener('change', () => {
    const selected = dropdown.value;
    document.body.className = selected;
    localStorage.setItem('selectedTheme', selected);
  });
});
