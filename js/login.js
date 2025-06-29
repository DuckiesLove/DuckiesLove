const PASSWORD_HASH = '51d15f71ae396169aa6d45c74b72f56d921698900135f877d01cce218c8ea10f';

function hashString(str) {
  const enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(str)).then(buf => {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

async function checkPassword() {
  const val = document.getElementById('passwordInput').value;
  const hashed = await hashString(val);
  if (hashed === PASSWORD_HASH) {
    localStorage.setItem('accessGranted', 'true');
    document.getElementById('loginOverlay').style.display = 'none';
  } else {
    alert('Incorrect password');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('accessGranted') === 'true') return;
  const ov = document.createElement('div');
  ov.id = 'loginOverlay';
  const inp = document.createElement('input');
  inp.type = 'password';
  inp.id = 'passwordInput';
  inp.placeholder = 'Enter password';
  const btn = document.createElement('button');
  btn.textContent = 'Enter';
  btn.onclick = checkPassword;
  ov.appendChild(inp);
  ov.appendChild(btn);
  document.body.appendChild(ov);
});
