const container = document.getElementById('cards-container');
const addBtn = document.getElementById('add-card');
const localTime = document.getElementById('local-time');
const partnerOffset = document.getElementById('partner-offset');
const partnerTime = document.getElementById('partner-time');

const STORAGE_KEY = 'greenlight-cards';
let cards = [];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

function load() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try { cards = JSON.parse(data); } catch { cards = []; }
  }
  render();
}

function formatElapsed(hours) {
  const h = Math.floor(Math.abs(hours));
  const m = Math.floor((Math.abs(hours) - h) * 60);
  return `${h}h ${m}m`;
}

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

  // voice recording
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

  return div;
}

function render() {
  container.innerHTML = '';
  cards.forEach(card => container.appendChild(createCard(card)));
}

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
