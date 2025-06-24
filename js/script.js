const themeSelector = document.getElementById('themeSelector');
const savedTheme = localStorage.getItem('selectedTheme');

// Apply saved theme
if (savedTheme) {
  document.body.className = savedTheme;
  themeSelector.value = savedTheme;
}

// Change theme on selection
themeSelector.addEventListener('change', () => {
  const selectedTheme = themeSelector.value;
  document.body.className = selectedTheme;
  localStorage.setItem('selectedTheme', selectedTheme);
});

// Tab switching logic
let currentAction = 'Giving';

function switchTab(action) {
  currentAction = action;

  // Toggle active tab
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${action.toLowerCase()}Tab`).classList.add('active');
}

document.getElementById('givingTab').addEventListener('click', () => switchTab('Giving'));
document.getElementById('receivingTab').addEventListener('click', () => switchTab('Receiving'));
document.getElementById('neutralTab').addEventListener('click', () => switchTab('Neutral'));

switchTab('Giving'); // Initialize
