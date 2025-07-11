// DOM Elements
const container = document.getElementById('cards-container');
const addBtn = document.getElementById('add-card');
const localTime = document.getElementById('local-time');
const partnerTz = document.getElementById('partner-tz');
const partnerTime = document.getElementById('partner-time');
const yourTimeDisplay = document.getElementById('your-time');
const undoModal = document.getElementById('undo-modal');
const undoList = document.getElementById('undo-list');
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const notesModal = document.getElementById('notes-modal');
const notesList = document.getElementById('notes-list');
const noteInitials = document.getElementById('note-initials');
const noteText = document.getElementById('note-text');
const saveNoteBtn = document.getElementById('save-note');
const menuNotes = document.getElementById('menu-notes');
const menuRecent = document.getElementById('menu-recent');
const menuSettings = document.getElementById('menu-settings');
const settingsModal = document.getElementById('settings-modal');
const darkToggle = document.getElementById('dark-mode-toggle');
const closeMenuBtn = document.getElementById('close-menu');
const menuAbout = document.getElementById('menu-about');
const aboutModal = document.getElementById('about-modal');
const menuVoice = document.getElementById('menu-voice');
const voiceModal = document.getElementById('voice-modal');
const recordBtn = document.getElementById('voice-record');
const saveVoiceBtn = document.getElementById('voice-save');
const labelInput = document.getElementById('voice-label');
const fileInput = document.getElementById('voice-file');
const voiceList = document.getElementById('voice-list');
const closeUndoBtn = document.getElementById('close-undo');
const closeNotesBtn = document.getElementById('close-notes');
const closeSettingsBtn = document.getElementById('close-settings');
const closeAboutBtn = document.getElementById('close-about');
const closeVoiceBtn = document.getElementById('close-voice');
const modal = document.getElementById('new-card-modal');
const modalTitle = document.getElementById('new-card-title');
const modalType = document.getElementById('new-card-type');
const modalEstimate = document.getElementById('new-card-estimate');
const modalYoutube = document.getElementById('new-card-youtube');
const saveCardBtn = document.getElementById('save-card');
const cancelCardBtn = document.getElementById('cancel-card');

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
let voiceNotes = [];
let recorder;
let recordedData;

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
  if (container) render();
  if (undoList) renderUndo();
  if (notesList) renderNotes();
  if (localTime && partnerTz) updateSchedule();
}

// Card Creation
function createCard(card) {
  const div = document.createElement('div');
  div.className = 'card';
  div.draggable = true;
  div.dataset.id = card.id;

  const title = document.createElement('input');
  title.value = card.title;
  title.placeholder = 'Title';
  title.oninput = () => { card.title = title.value; save(); };

  const due = document.createElement('input');
  due.type = 'number';
  due.min = '1';
  due.value = card.dueHours;
  due.onchange = () => { card.dueHours = Number(due.value); save(); updateTime(); };

  const estimateSpan = document.createElement('span');
  if (card.estimate) {
    estimateSpan.textContent = `Est: ${card.estimate}m`;
  }

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


  // Time Display
  function updateTime() {
    if (card.lastDone) {
      const hours = (Date.now() - card.lastDone) / 3600000;
      if (card.type === 'since') {
        timeInfo.textContent = 'Last done ' + formatElapsed(hours) + ' ago';
      } else {
        const remaining = card.dueHours - hours;
        if (remaining > 0) {
          timeInfo.textContent = 'Due in ' + formatElapsed(remaining);
        } else {
          timeInfo.textContent = 'Last done ' + formatElapsed(hours) + ' ago';
        }
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
  div.appendChild(estimateSpan);
  div.appendChild(timeInfo);
  div.appendChild(markBtn);
  div.appendChild(countSpan);
  div.appendChild(yt);
  div.appendChild(link);
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
function addCard(data = {}) {
  cards.push({
    id: Date.now(),
    title: data.title || '',
    dueHours: data.dueHours || 24,
    type: data.type || 'due',
    estimate: data.estimate || 0,
    lastDone: null,
    youtube: data.youtube || '',
    notes: [],
    count: 0
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
  if (!undoList) return;
  cleanupDeleted();
  undoList.innerHTML = '';
  if (deletedCards.length === 0) return;
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
  if (!container) return;
  container.innerHTML = '';
  cards.forEach(card => {
    const el = createCard(card);
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.id);
    });
    el.addEventListener('dragover', e => e.preventDefault());
    el.addEventListener('drop', e => {
      e.preventDefault();
      const draggedId = Number(e.dataTransfer.getData('text/plain'));
      const targetId = card.id;
      const from = cards.findIndex(c => c.id === draggedId);
      const to = cards.findIndex(c => c.id === targetId);
      if (from === -1 || to === -1 || from === to) return;
      const [moved] = cards.splice(from, 1);
      cards.splice(to, 0, moved);
      save();
      render();
    });
    container.appendChild(el);
  });
}

// Partner Notes
function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(partnerNotes));
}

function renderNotes() {
  if (!notesList) return;
  notesList.innerHTML = '';
  partnerNotes.forEach((n, idx) => {
    const li = document.createElement('li');
    const d = new Date(n.time);
    const span = document.createElement('span');
    span.textContent = `${d.toLocaleString()} ${n.initials}: ${n.text}`;

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      const newText = prompt('Edit note', n.text);
      if (newText !== null) {
        n.text = newText;
        saveNotes();
        renderNotes();
      }
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => {
      partnerNotes.splice(idx, 1);
      saveNotes();
      renderNotes();
    };

    li.appendChild(span);
    li.appendChild(editBtn);
    li.appendChild(delBtn);
    notesList.appendChild(li);
  });
}

function toggleMenu() {
  if (menu) {
    menu.classList.toggle('open');
  }
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
    yourTimeDisplay.textContent = '';
    partnerTime.textContent = '';
    return;
  }
  const tz = partnerTz.value || 'UTC';
  const pString = date.toLocaleString([], { timeZone: tz });
  yourTimeDisplay.textContent = `Your Time: ${date.toLocaleString()}`;
  partnerTime.textContent = `Their Time (${tz}): ${pString}`;
  localStorage.setItem(TZ_KEY, tz);
}

// Listeners
if (addBtn) {
  addBtn.addEventListener('click', () => {
    modalTitle.value = '';
    modalEstimate.value = '';
    modalYoutube.value = '';
    modalType.value = 'due';
    openModal(modal);
  });
}

if (saveCardBtn) {
  saveCardBtn.addEventListener('click', () => {
    addCard({
      title: modalTitle.value,
      dueHours: Number(modalEstimate.value) || 24,
      type: modalType.value,
      estimate: Number(modalEstimate.value) || 0,
      youtube: modalYoutube.value
    });
    closeModal(saveCardBtn);
  });
}

if (cancelCardBtn) {
  cancelCardBtn.addEventListener('click', () => {
    closeModal(cancelCardBtn);
  });
}
if (localTime) localTime.addEventListener('input', updateSchedule);
if (partnerTz) partnerTz.addEventListener('input', updateSchedule);
window.addEventListener('load', () => {
  localStorage.removeItem('greenlight-categories');
  load();
  loadVoices();
});
if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
if (darkToggle) darkToggle.addEventListener('click', toggleDarkMode);
function openModal(el) {
  if (el) el.classList.remove('hidden');
}
function hideModal(el) {
  if (el) el.classList.add('hidden');
  if (menu) menu.classList.remove('open');
}

function closeModal(button) {
  const modalWrapper = button.closest('.modal');
  if (modalWrapper) {
    modalWrapper.classList.add('hidden');
    const inputs = modalWrapper.querySelectorAll('input, textarea');
    inputs.forEach(input => (input.value = ''));
  }
  if (menu) menu.classList.remove('open');
  window.scrollTo(0, 0);
}
if (menuNotes) menuNotes.addEventListener('click', () => {
  openModal(notesModal);
  toggleMenu();
});
if (menuRecent) menuRecent.addEventListener('click', () => {
  openModal(undoModal);
  toggleMenu();
});
if (menuSettings) menuSettings.addEventListener('click', () => {
  openModal(settingsModal);
  toggleMenu();
});
if (menuAbout) menuAbout.addEventListener('click', () => {
  openModal(aboutModal);
  toggleMenu();
});
if (menuVoice) menuVoice.addEventListener('click', () => {
  openModal(voiceModal);
  toggleMenu();
});
if (closeUndoBtn) closeUndoBtn.addEventListener('click', () => hideModal(undoModal));
if (closeNotesBtn) closeNotesBtn.addEventListener('click', () => hideModal(notesModal));
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => hideModal(settingsModal));
if (closeAboutBtn) closeAboutBtn.addEventListener('click', () => hideModal(aboutModal));
if (closeVoiceBtn) closeVoiceBtn.addEventListener('click', () => hideModal(voiceModal));
if (saveNoteBtn) {
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
}

// Voice notes handling
const VOICE_KEY = 'greenlight-voice-notes';

function saveVoices() {
  localStorage.setItem(VOICE_KEY, JSON.stringify(voiceNotes));
}

function loadVoices() {
  const data = localStorage.getItem(VOICE_KEY);
  if (data) {
    try { voiceNotes = JSON.parse(data); } catch { voiceNotes = []; }
  }
  renderVoices();
}

function renderVoices() {
  if (!voiceList) return;
  voiceList.innerHTML = '';
  voiceNotes.forEach((note, idx) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = note.label || `Voice ${idx + 1}`;
    const play = document.createElement('button');
    play.textContent = 'Play';
    play.onclick = () => new Audio(note.dataURL).play();
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      voiceNotes.splice(idx, 1);
      saveVoices();
      renderVoices();
    };
    li.appendChild(span);
    li.appendChild(play);
    li.appendChild(del);
    voiceList.appendChild(li);
  });
}

if (recordBtn) {
  recordBtn.addEventListener('click', async () => {
    if (!recorder) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => { recordedData = reader.result; };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recordBtn.textContent = 'Stop';
    } else {
      recorder.stop();
      recorder = null;
      recordBtn.textContent = 'Record';
    }
  });
}

if (saveVoiceBtn) {
  saveVoiceBtn.addEventListener('click', () => {
    if (recordedData) {
      voiceNotes.push({
        id: Date.now(),
        label: labelInput.value,
        dataURL: recordedData,
        timestamp: Date.now()
      });
      labelInput.value = '';
      recordedData = null;
      saveVoices();
      renderVoices();
    }
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      voiceNotes.push({
        id: Date.now(),
        label: file.name,
        dataURL: reader.result,
        timestamp: Date.now()
      });
      saveVoices();
      renderVoices();
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });
}


