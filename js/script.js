// Load saved theme from localStorage if available
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('selectedTheme');
  const dropdown = document.getElementById('themeDropdown');

  if (savedTheme) {
    document.body.className = savedTheme;
    if (dropdown) dropdown.value = savedTheme;
  }

  // Change theme on dropdown selection
  dropdown.addEventListener('change', function () {
    const selectedTheme = this.value;
    document.body.className = selectedTheme;
    localStorage.setItem('selectedTheme', selectedTheme);
  });
});
