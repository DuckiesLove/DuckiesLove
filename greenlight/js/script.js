// DOM Elements
const container = document.getElementById('cards-container');
const addBtn = document.getElementById('add-card');
const localTime = document.getElementById('local-time');
const partnerTz = document.getElementById('partner-tz');
const partnerTime = document.getElementById('partner-time');
const undoContainer = document.getElementById('undo-container');
const undoList = document.getElementById('undo-list');
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const notesSection = document.getElementById('partner-notes');
const notesList = document.getElementById('notes-list');
const noteInitials = document.getElementById('note-initials');
const noteText = document.getElementById('note-text');
const saveNoteBtn = document.getElementById('save-note');
const menuNotes = document.getElementById('menu-notes');
const menuRecent = document.getElementById('menu-recent');
const menuSettings = document.getElementById('menu-settings');
const settingsSection = document.getElementById('settings-section');
const darkToggle = document.getElementById('dark-mode-toggle');
const closeMenuBtn = document.getElementById('close-menu');

// Storage Keys
const STORAGE_KEY = 'greenlight-cards';
const DELETED_KEY = 'greenlight-deleted';
const NOTES_KEY = 'greenlight-notes';
const MODE_KEY = 'greenlight-mode';
const TZ_KEY = 'greenlight-tz';

// State
let cards = [];
let deletedCards = [];
let partnerNotes = [];

// Utility
function formatElapsed(hours) {
  const h = Math.floor(Math.abs(hours));
  const m = Math.floor((Math.abs(hours) - h) * 60);
  return `${h}h ${m}m`;
}

// Storage
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}
function saveDeleted() {
  localStorage.setItem(DELETED_KEY, JSON.stringify(deletedCards));
}
function load() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try { cards = JSON.parse(data); } catch { cards = []; }
  }
  const delData = localStorage.getItem(DELETED_KEY);
  if (delData) {
    try { deletedCards = JSON.parse(delData); } catch { deletedCards = []; }
  }
  const noteData = localStorage.getItem(NOTES_KEY);
  if (noteData) {
    try { partnerNotes = JSON.parse(noteData); } catch { partnerNotes = []; }
  }
  const mode = localStorage.getItem(MODE_KEY);
  if (mode === 'light') {
    document.body.classList.add('light-mode');
  }
  const tz = localStorage.getItem(TZ_KEY);
  if (tz && partnerTz) {
    partnerTz.value = tz;
  }
  cleanupDeleted();
  render();
  renderUndo();
  renderNotes();
  updateSchedule();
}

// Card Creation
function createCard(card) {
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
  const countSpan = document.createElement('span');

  const markBtn = document.createElement('button');
  markBtn.textContent = 'Mark Complete';
  markBtn.onclick = () => {
    card.lastDone = Date.now();
    card.count = (card.count || 0) + 1;
    save();
    updateTime();
  };

  const yt = document.createElement('input');
  yt.type = 'url';
  yt.placeholder = 'YouTube link';
  yt.value = card.youtube || '';
  yt.oninput = () => { card.youtube = yt.value; save(); link.href = yt.value; };

  const link = document.createElement('a');
  link.textContent = 'Open Video';
  link.target = '_blank';
  link.href = card.youtube || '#';

  // Notes
  const cardNotesList = document.createElement('ul');
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

  // Voice Recording
  let recorder;
  const recBtn = document.createElement('button');
  recBtn.textContent = 'Record';

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.disabled = !card.audio;

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

  // Time Display
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

  updateTime();
  setInterval(updateTime, 60000);

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '✕';
  deleteBtn.onclick = () => deleteCard(card.id);

  // Assemble Card
  div.appendChild(title);
  div.appendChild(due);
  div.appendChild(timeInfo);
  div.appendChild(markBtn);
  div.appendChild(countSpan);
  div.appendChild(yt);
  div.appendChild(link);
  div.appendChild(recBtn);
  div.appendChild(playBtn);
  div.appendChild(cardNotesList);
  card.notes.forEach(n => {
    const li = document.createElement('li');
    const d = new Date(n.time);
    li.textContent = `${d.toLocaleString()} ${n.initials}: ${n.text}`;
    cardNotesList.appendChild(li);
  });
  div.appendChild(noteInput);
  div.appendChild(initialsInput);
  div.appendChild(addNote);
  div.appendChild(deleteBtn);

  return div;
}

// Add a Card
function addCard(title = '') {
  cards.push({
    id: Date.now(),
    title,
    dueHours: 24,
    lastDone: null,
    youtube: '',
    notes: [],
    count: 0,
    audio: null
  });
  save();
  render();
}

// Undo / Deleted Cards
function deleteCard(id) {
  const idx = cards.findIndex(c => c.id === id);
  if (idx === -1) return;
  const card = cards.splice(idx, 1)[0];
  card.deletedAt = Date.now();
  deletedCards.push(card);
  save();
  saveDeleted();
  render();
  renderUndo();
}

function restoreCard(id) {
  const idx = deletedCards.findIndex(c => c.id === id);
  if (idx === -1) return;
  const card = deletedCards.splice(idx, 1)[0];
  delete card.deletedAt;
  cards.push(card);
  save();
  saveDeleted();
  render();
  renderUndo();
}

function cleanupDeleted() {
  const now = Date.now();
  deletedCards = deletedCards.filter(c => now - c.deletedAt < 24 * 60 * 60 * 1000);
  saveDeleted();
}

function renderUndo() {
  cleanupDeleted();
  undoList.innerHTML = '';
  if (deletedCards.length === 0) {
    undoContainer.classList.add('hidden');
    return;
  }
  undoContainer.classList.remove('hidden');
  deletedCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'undo-item';
    const span = document.createElement('span');
    span.textContent = card.title;
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = () => restoreCard(card.id);
    div.appendChild(span);
    div.appendChild(btn);
    undoList.appendChild(div);
  });
}

// Render All Cards
function render() {
  container.innerHTML = '';
  cards.forEach(card => container.appendChild(createCard(card)));
}

// Partner Notes
function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(partnerNotes));
}

function renderNotes() {
  notesList.innerHTML = '';
  partnerNotes.forEach(n => {
    const li = document.createElement('li');
    const d = new Date(n.time);
    li.textContent = `${d.toLocaleString()} ${n.initials}: ${n.text}`;
    notesList.appendChild(li);
  });
}

function toggleMenu() {
  menu.classList.toggle('open');
}

function toggleDarkMode() {
  document.body.classList.toggle('light-mode');
  const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  localStorage.setItem(MODE_KEY, mode);
}

// Scheduler
function updateSchedule() {
  const date = new Date(localTime.value);
  if (isNaN(date)) {
    partnerTime.textContent = '';
    return;
  }
  const tz = partnerTz.value || 'UTC';
  const pString = date.toLocaleString([], { timeZone: tz });
  partnerTime.textContent = `Partner time (${tz}): ` + pString;
  localStorage.setItem(TZ_KEY, tz);
}

// Listeners
addBtn.addEventListener('click', () => addCard());
localTime.addEventListener('input', updateSchedule);
partnerTz.addEventListener('input', updateSchedule);
window.addEventListener('load', () => {
  localStorage.removeItem('greenlight-categories');
  load();
});
menuBtn.addEventListener('click', toggleMenu);
closeMenuBtn.addEventListener('click', toggleMenu);
darkToggle.addEventListener('click', toggleDarkMode);
menuNotes.addEventListener('click', () => {
  notesSection.classList.toggle('hidden');
  toggleMenu();
});
menuRecent.addEventListener('click', () => {
  undoContainer.classList.toggle('hidden');
  toggleMenu();
});
menuSettings.addEventListener('click', () => {
  settingsSection.classList.toggle('hidden');
  toggleMenu();
});
saveNoteBtn.addEventListener('click', () => {
  if (noteText.value.trim()) {
    partnerNotes.push({
      text: noteText.value,
      initials: noteInitials.value,
      time: Date.now()
    });
    noteText.value = '';
    noteInitials.value = '';
    saveNotes();
    renderNotes();
  }
});

