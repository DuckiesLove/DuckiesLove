const themeSelector = document.getElementById('themeSelector');
const savedTheme = localStorage.getItem('selectedTheme');

if (savedTheme) {
  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
}

themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
});

// Tab logic
let currentAction = 'Giving';

function switchTab(action) {
  currentAction = action;

  // Update active tab style
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${action.toLowerCase()}Tab`).classList.add('active');

  // Optional: Load content for tab if needed
  // Example: showCategories(); showKinks(currentCategory);
}

document.getElementById('givingTab').addEventListener('click', () => switchTab('Giving'));
document.getElementById('receivingTab').addEventListener('click', () => switchTab('Receiving'));
document.getElementById('neutralTab').addEventListener('click', () => switchTab('Neutral'));

switchTab('Giving'); // default
