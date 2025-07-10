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

function toInputValue(ts) {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  const local = new Date(ts - off * 60000);
  return local.toISOString().slice(0, 16);
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

  const categoryInput = document.createElement('input');
  categoryInput.className = 'ritual-category';
  categoryInput.placeholder = 'Category';
  categoryInput.setAttribute('list', 'categoryOptions');
  categoryInput.value = card.category || '';
  categoryInput.oninput = () => {
    card.category = categoryInput.value;
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

  const completeTime = document.createElement('input');
  completeTime.type = 'datetime-local';
  completeTime.className = 'complete-time';
  completeTime.value = toInputValue(card.lastCompleted);
  completeTime.onchange = () => {
    const t = new Date(completeTime.value);
    card.lastCompleted = t.getTime();
    saveCards();
  };

  const complete = document.createElement('input');
  complete.type = 'checkbox';
  complete.className = 'complete-box';
  complete.onchange = () => {
    if (complete.checked) {
      card.lastCompleted = Date.now();
      completeTime.value = toInputValue(card.lastCompleted);
      saveCards();
      complete.checked = false;
    }
  };

  const ytInput = document.createElement('input');
  ytInput.type = 'url';
  ytInput.placeholder = 'YouTube Link';
  ytInput.value = card.youtubeLink || '';

  const ytPreviewLink = document.createElement('a');
  ytPreviewLink.target = '_blank';
  const ytThumb = document.createElement('img');
  ytThumb.className = 'youtube-thumb';
  ytPreviewLink.appendChild(ytThumb);

  function updateThumb() {
    if (!ytInput.value) {
      ytThumb.style.display = 'none';
      return;
    }
    const idMatch = ytInput.value.match(/[?&]v=([^&]+)/) || ytInput.value.match(/youtu\.be\/([^?]+)/);
    if (idMatch) {
      const id = idMatch[1];
      ytThumb.src = `https://img.youtube.com/vi/${id}/0.jpg`;
      ytThumb.style.display = 'block';
      ytPreviewLink.href = `https://www.youtube.com/watch?v=${id}`;
    } else {
      ytThumb.style.display = 'none';
    }
  }

  ytInput.onchange = () => {
    card.youtubeLink = ytInput.value;
    updateThumb();
    saveCards();
  };

  updateThumb();

  const recordBtn = document.createElement('button');
  recordBtn.textContent = 'Record';
  const audioList = document.createElement('div');
  audioList.className = 'audio-list';
  let recorder;
  let chunks = [];

  function addAudio(url) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    audioList.appendChild(audio);
  }

  if (Array.isArray(card.audios)) {
    card.audios.forEach(a => addAudio(a));
  } else {
    card.audios = [];
  }

  recordBtn.onclick = async () => {
    if (!recorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        addAudio(url);
        const reader = new FileReader();
        reader.onload = () => {
          card.audios.push(reader.result);
          saveCards();
        };
        reader.readAsDataURL(blob);
        chunks = [];
        recorder = null;
        recordBtn.textContent = 'Record';
      };
      recorder.start();
      recordBtn.textContent = 'Stop';
    } else {
      recorder.stop();
    }
  };

  el.appendChild(title);
  el.appendChild(categoryInput);
  el.appendChild(typeSel);
  el.appendChild(timerInput);
  el.appendChild(timerDisplay);
  el.appendChild(completeTime);
  el.appendChild(complete);
  el.appendChild(ytInput);
  el.appendChild(ytPreviewLink);
  el.appendChild(recordBtn);
  el.appendChild(audioList);
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
    lastCompleted: Date.now(),
    youtubeLink: '',
    audios: [],
    category: ''
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
