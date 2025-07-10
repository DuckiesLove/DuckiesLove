const addBtn = document.getElementById('addBtn');
const closeModal = document.getElementById('closeModal');
const content = document.getElementById('content');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const customBtn = document.getElementById('customBtn');
const modal = document.getElementById('modal');

const STORAGE_KEY = 'greenlight-cards';
let cards = [];

addBtn.onclick = () => modal.classList.remove('hidden');
closeModal.onclick = () => modal.classList.add('hidden');

function parseDuration(str) {
  if (!str) return 0;
  let total = 0;
  const regex = /(\d+)\s*([smhd])/gi;
  let m;
  while ((m = regex.exec(str))) {
    const val = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 's') total += val * 1000;
    if (unit === 'm') total += val * 60 * 1000;
    if (unit === 'h') total += val * 60 * 60 * 1000;
    if (unit === 'd') total += val * 24 * 60 * 60 * 1000;
  }
  return total;
}

function formatTime(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (d || h) parts.push(`${h}h`);
  if (d || h || m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function saveCards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function createCard(card) {
  const el = document.createElement('div');
  el.className = 'ritual-card';
  el.dataset.id = card.id;

  const title = document.createElement('input');
  title.className = 'ritual-title';
  title.value = card.title;
  title.oninput = () => {
    card.title = title.value;
    saveCards();
  };

  const typeSel = document.createElement('select');
  typeSel.className = 'ritual-type';
  typeSel.innerHTML = `<option value="left">Time Left</option><option value="since">Time Since</option>`;
  typeSel.value = card.timerType;
  typeSel.onchange = () => {
    card.timerType = typeSel.value;
    saveCards();
  };

  const timerInput = document.createElement('input');
  timerInput.className = 'ritual-timer';
  timerInput.placeholder = 'e.g., 30m, 2h';
  timerInput.value = card.inputText || '';
  timerInput.onchange = () => {
    card.inputText = timerInput.value;
    card.duration = parseDuration(timerInput.value);
    saveCards();
  };

  const timerDisplay = document.createElement('div');
  timerDisplay.className = 'timer-display';

  const complete = document.createElement('input');
  complete.type = 'checkbox';
  complete.className = 'complete-box';
  complete.onchange = () => {
    if (complete.checked) {
      card.lastCompleted = Date.now();
      saveCards();
      complete.checked = false;
    }
  };

  el.appendChild(title);
  el.appendChild(typeSel);
  el.appendChild(timerInput);
  el.appendChild(timerDisplay);
  el.appendChild(complete);
  content.appendChild(el);

  function update() {
    const now = Date.now();
    let diff = 0;
    if (card.timerType === 'left') {
      diff = card.duration - (now - card.lastCompleted);
    } else {
      diff = now - card.lastCompleted;
    }
    timerDisplay.textContent = formatTime(diff);
  }
  update();
  setInterval(update, 1000);
}

function addRitual(name = 'New Ritual') {
  const card = {
    id: Date.now(),
    title: name,
    timerType: 'left',
    inputText: '',
    duration: 0,
    lastCompleted: Date.now()
  };
  cards.push(card);
  saveCards();
  createCard(card);
  document.querySelector('.empty-state').style.display = 'none';
}

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    addRitual(btn.textContent);
    modal.classList.add('hidden');
  });
});

customBtn.onclick = () => {
  addRitual();
  modal.classList.add('hidden');
};

function loadCards() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      cards = JSON.parse(data);
    } catch (e) {
      cards = [];
    }
  }
  if (!cards.length) {
    document.querySelector('.empty-state').style.display = 'block';
  } else {
    document.querySelector('.empty-state').style.display = 'none';
  }
  cards.forEach(createCard);
}

window.addEventListener('load', loadCards);
