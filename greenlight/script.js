const PASSWORD = 'Duckies';

function setupPassword() {
  const overlay = document.getElementById('passwordOverlay');
  if (sessionStorage.getItem('greenlight-auth') === 'true') {
    if (overlay) overlay.style.display = 'none';
    return;
  }
  overlay.style.display = 'flex';
  document.getElementById('passwordSubmit').onclick = () => {
    const val = document.getElementById('passwordInput').value;
    if (val === PASSWORD) {
      sessionStorage.setItem('greenlight-auth', 'true');
      overlay.style.display = 'none';
    } else {
      alert('Incorrect password');
    }
  };
}

window.addEventListener('DOMContentLoaded', setupPassword);
