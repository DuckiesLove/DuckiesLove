// === DOM Elements ===
const container = document.getElementById('cards-container');
const completedContainer = document.getElementById('completed-cards-container');
const formArea = document.getElementById('card-form-area');
const addBtn = document.getElementById('add-category-btn') || document.getElementById('add-card');
const presetMenu = document.getElementById('preset-menu');
const presetButtons = document.querySelectorAll('#preset-menu .preset-option');
const customOption = document.getElementById('custom-option');
const undoContainer = document.getElementById('undo-container');
const undoList = document.getElementById('undo-list');
const localTime = document.getElementById('local-time');
const partnerOffset = document.getElementById('partner-offset');
const partnerTime = document.getElementById('partner-time');

// === Local Storage Keys ===
const STORAGE_KEY = 'greenlight-categories';
const DELETED_KEY = 'greenlight-deleted';

// === State ===
let categories = [];
let deletedCategories = [];

// === Save/Load ===
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

function saveDeleted() {
  localStorage.setItem(DELETED_KEY, JSON.stringify(deletedCategories));
}

function load() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try { categories = JSON.parse(data); } catch { categories = []; }
  }
  render();
}

// === Scheduler Helper ===
function formatElapsed(hours) {
  const h = Math.floor(Math.abs(hours));
  const m = Math.floor((Math.abs(hours) - h) * 60);
  return `${h}h ${m}m`;
}

  const div = document.createElement('div');
  div.className = 'card';

  const title = document.createElement('input');
  title.value = card.title;
  title.placeholder = 'Title';
  title.oninput = () => { card.title = title.value; save(); };

  const due = document.createElement('input');
  due.type = 'number';
  due.min = '1';
  due.value = card.dueHours;
  due.onchange = () => { card.dueHours = Number(due.value); save(); updateTime(); };

  const timeInfo = document.createElement('div');

  const markBtn = document.createElement('button');
  markBtn.textContent = 'Mark Complete';
  markBtn.onclick = () => {
    card.lastDone = Date.now();
    card.count = (card.count || 0) + 1;
    save();
    updateTime();
  };

  const countSpan = document.createElement('span');

  const yt = document.createElement('input');
  yt.type = 'url';
  yt.placeholder = 'YouTube link';
  yt.value = card.youtube || '';
  yt.oninput = () => { card.youtube = yt.value; save(); link.href = yt.value; };

  const link = document.createElement('a');
  link.textContent = 'Open Video';
  link.target = '_blank';
  link.href = card.youtube || '#';

  // notes
  const notesList = document.createElement('ul');
  const noteInput = document.createElement('input');
  noteInput.placeholder = 'Add note';
  const initialsInput = document.createElement('input');
  initialsInput.placeholder = 'Initials';
  const addNote = document.createElement('button');
  addNote.textContent = 'Add Note';
  addNote.onclick = () => {
    if (noteInput.value.trim()) {
      const note = {
        text: noteInput.value,
        initials: initialsInput.value,
        time: Date.now()
      };
      card.notes.push(note);
      noteInput.value = '';
      initialsInput.value = '';
      save();
      render();
    }
  };

// === Voice Recording Buttons ===
let recorder, audioURL;

const recBtn = document.createElement('button');
recBtn.textContent = 'Record';

const playBtn = document.createElement('button');
playBtn.textContent = 'Play';
playBtn.disabled = true;

recBtn.onclick = async () => {
  if (!recorder) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        card.audio = reader.result;
        save();
        playBtn.disabled = false;
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    recBtn.textContent = 'Stop';
  } else {
    recorder.stop();
    recorder = null;
    recBtn.textContent = 'Record';
  }
};

playBtn.onclick = () => {
  if (card.audio) {
    const audio = new Audio(card.audio);
    audio.play();
  }
};

if (card.audio) playBtn.disabled = false;

// === Time Status Update Function ===
function updateTime() {
  if (card.lastDone) {
    const hours = (Date.now() - card.lastDone) / 3600000;
    const remaining = card.dueHours - hours;
    if (remaining > 0) {
      timeInfo.textContent = 'Due in ' + formatElapsed(remaining);
    } else {
      timeInfo.textContent = 'Last done ' + formatElapsed(hours) + ' ago';
    }
  } else {
    timeInfo.textContent = 'Not completed yet';
  }
  countSpan.textContent = `Completed ${card.count || 0}`;
}

// === Delete Button (from main branch logic) ===
const deleteBtn = document.createElement('button');
deleteBtn.type = 'button';
deleteBtn.textContent = '✕';
deleteBtn.onclick = () => deleteCategory(cat.id);

div.appendChild(input);
div.appendChild(label);
div.appendChild(deleteBtn);


  updateTime();
  setInterval(updateTime, 60000);

  div.appendChild(title);
  div.appendChild(due);
  div.appendChild(timeInfo);
  div.appendChild(markBtn);
  div.appendChild(countSpan);
  div.appendChild(yt);
  div.appendChild(link);
  div.appendChild(recBtn);
  div.appendChild(playBtn);
  div.appendChild(notesList);
  card.notes.forEach(n => {
    const li = document.createElement('li');
    const d = new Date(n.time);
    li.textContent = `${d.toLocaleString()} ${n.initials}: ${n.text}`;
    notesList.appendChild(li);
  });
  div.appendChild(noteInput);
  div.appendChild(initialsInput);
  div.appendChild(addNote);

function createCard(cat) {
  const div = document.createElement('div');
  div.className = 'category-card';

  const span = document.createElement('span');
  span.textContent = cat.name || 'Untitled';

  // === Delete Button ===
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '✕';
  deleteBtn.onclick = () => deleteCategory(cat.id);

  // === Completion Info ===
  const timeInfo = document.createElement('p');
  const countSpan = document.createElement('p');

  function updateTime() {
    if (cat.lastDone) {
      const hours = (Date.now() - cat.lastDone) / 3600000;
      const remaining = cat.dueHours - hours;
      if (remaining > 0) {
        timeInfo.textContent = 'Due in ' + formatElapsed(remaining);
      } else {
        timeInfo.textContent = 'Last done ' + formatElapsed(hours) + ' ago';
      }
    } else {
      timeInfo.textContent = 'Not completed yet';
    }
    countSpan.textContent = `Completed ${cat.count || 0}`;
  }
  updateTime();

  // === Voice Recording Buttons ===
  let recorder;
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.disabled = !cat.audio;

  recBtn.onclick = async () => {
    if (!recorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          cat.audio = reader.result;
          save(); // ensure cat is saved with audio
          playBtn.disabled = false;
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recBtn.textContent = 'Stop';
    } else {
      recorder.stop();
      recorder = null;
      recBtn.textContent = 'Record';
    }
  };

  playBtn.onclick = () => {
    if (cat.audio) {
      const audio = new Audio(cat.audio);
      audio.play();
    }
  };

  // === Assemble the Card ===
  div.appendChild(span);
  div.appendChild(deleteBtn);
  div.appendChild(timeInfo);
  div.appendChild(countSpan);
  div.appendChild(recBtn);
  div.appendChild(playBtn);

  container.appendChild(div);
}

  return div;
}

function cleanupDeleted() {
  const now = Date.now();
  deletedCategories = deletedCategories.filter(c => now - c.deletedAt < 24 * 60 * 60 * 1000);
  saveDeleted();
}

function renderUndo() {
  cleanupDeleted();
  undoList.innerHTML = '';
  if (deletedCategories.length === 0) {
    undoContainer.classList.add('hidden');
    return;
  }
  undoContainer.classList.remove('hidden');
  deletedCategories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'undo-item';
    const span = document.createElement('span');
    span.textContent = cat.name;
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = () => restoreCategory(cat.id);
    div.appendChild(span);
    div.appendChild(btn);
    undoList.appendChild(div);
  });
}

function restoreCategory(id) {
  const idx = deletedCategories.findIndex(c => c.id === id);
  if (idx === -1) return;
  const cat = deletedCategories.splice(idx, 1)[0];
  delete cat.deletedAt;
  categories.push(cat);
  save();
  saveDeleted();
  render();
  renderUndo();
}

function deleteCategory(id) {
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) return;
  const cat = categories.splice(idx, 1)[0];
  cat.deletedAt = Date.now();
  deletedCategories.push(cat);
  save();
  saveDeleted();
  render();
  renderUndo();
}

function render() {
  container.innerHTML = '';
  cards.forEach(card => container.appendChild(createCard(card)));
}

function addCategory(name = '') {
  const card = {
    id: Date.now(),
    title: name,
    dueHours: 24,
    lastDone: null,
    youtube: '',
    notes: [],
    count: 0,
    audio: null,
    completed: false
  };
  categories.push(card);
  save();
  render();
}

  save();
  render();
}

addBtn.addEventListener('click', () => addCard());

localTime.addEventListener('input', updateSchedule);
partnerOffset.addEventListener('input', updateSchedule);

function updateSchedule() {
  const date = new Date(localTime.value);
  if (isNaN(date)) { partnerTime.textContent = ''; return; }
  const localOff = -date.getTimezoneOffset() / 60;
  const partnerOff = Number(partnerOffset.value || 0);
  const utc = date.getTime() - localOff * 3600000;
  const pDate = new Date(utc + partnerOff * 3600000);
  partnerTime.textContent = 'Partner time: ' + pDate.toLocaleString();
}

window.addEventListener('load', load);
