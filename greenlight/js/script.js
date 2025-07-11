// DOM Elements
const container = document.getElementById('cards-container');
const addBtn = document.getElementById('add-card');
const localTime = document.getElementById('local-time');
const localTimeLabel = document.getElementById('local-time-label');
const localTimeText = document.getElementById('local-time-text');
const partnerTz = document.getElementById('partner-tz');
const partnerCountry = document.getElementById('partner-country');
const yourTz = document.getElementById('your-tz');
const yourCountry = document.getElementById('your-country');
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
const noCards = document.getElementById('no-cards');
const closeUndoBtn = document.getElementById('close-undo');
const closeNotesBtn = document.getElementById('close-notes');
const closeSettingsBtn = document.getElementById('close-settings');
const closeAboutBtn = document.getElementById('close-about');
const closeVoiceBtn = document.getElementById('close-voice');
const modal = document.getElementById('new-card-modal');
const modalTitle = document.getElementById('new-card-title');
const modalLabel = document.getElementById('new-card-label');
const modalType = document.getElementById('new-card-type');
const modalEstimate = document.getElementById('new-card-estimate');
const modalYoutube = document.getElementById('new-card-youtube');
const saveCardBtn = document.getElementById('save-card');
const cancelCardBtn = document.getElementById('cancel-card');
const entryModal = document.getElementById('entry-select-modal');
const customEntryBtn = document.getElementById('custom-entry-btn');

// Storage Keys
const STORAGE_KEY = 'greenlight-cards';
const DELETED_KEY = 'greenlight-deleted';
const NOTES_KEY = 'greenlight-notes';
const MODE_KEY = 'greenlight-mode';
const TZ_KEY = 'greenlight-tz';
const COUNTRY_KEY = 'greenlight-country';
const MY_TZ_KEY = 'greenlight-your-tz';
const MY_COUNTRY_KEY = 'greenlight-your-country';

// State
let cards = [];
let deletedCards = [];
let partnerNotes = [];
let voiceNotes = [];
let recorder;
let recordedData;

// --------------------------- UI Handlers ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Persist and toggle light/dark mode
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode === 'light') {
    document.body.classList.add('light-mode');
  }
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem(MODE_KEY, isLight ? 'light' : 'dark');
    });
  }

  // Slide-out menu open/close
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      menu.classList.add('open');
    });
  }

  if (closeMenuBtn) {
    closeMenuBtn.addEventListener('click', () => {
      menu.classList.remove('open');
    });
  }

  function openMenuModal(modalEl) {
    menu.classList.remove('open');
    openModal(modalEl);
  }

  if (menuNotes) menuNotes.addEventListener('click', () => openMenuModal(notesModal));
  if (menuRecent) menuRecent.addEventListener('click', () => openMenuModal(undoModal));
  if (menuSettings) menuSettings.addEventListener('click', () => openMenuModal(settingsModal));
  if (menuAbout) menuAbout.addEventListener('click', () => openMenuModal(aboutModal));
  if (menuVoice) menuVoice.addEventListener('click', () => openMenuModal(voiceModal));
});

// Country list for dropdowns
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas",
  "Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize",
  "Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana",
  "Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde",
  "Cambodia","Cameroon","Canada","Central African Republic","Chad",
  "Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Côte d'Ivoire",
  "Croatia","Cuba","Cyprus","Czechia","Democratic Republic of the Congo",
  "Denmark","Djibouti","Dominica","Dominican Republic","Ecuador",
  "Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia",
  "Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala",
  "Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait",
  "Kosovo",
  "Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya",
  "Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania",
  "Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia",
  "Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru",
  "Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","North Macedonia","Norway","Oman","Pakistan","Palau",
  "Palestine",
  "Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland",
  "Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles",
  "Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands",
  "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka",
  "Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan",
  "Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago",
  "Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Uruguay",
  "Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen",
  "Zambia","Zimbabwe"
];

// Open the activity selection modal
if (addBtn) {
  addBtn.addEventListener('click', () => {
    openModal(entryModal);
  });
}

// Add card when a preset option is chosen
document.querySelectorAll('#entry-options .add-option').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.type === 'calendar') {
      window.location.href = 'calendar.html';
      return;
    }
    addCard({ title: btn.textContent, label: btn.dataset.type || '' });
    hideModal(entryModal);
  });
});

// Open custom card modal from selection modal
if (customEntryBtn) {
  customEntryBtn.addEventListener('click', () => {
    hideModal(entryModal);
    openModal(modal);
  });
}

// ✅ Save Button Adds Card with User-Defined Info
if (saveCardBtn) {
  saveCardBtn.addEventListener('click', () => {
    addCard({
      title: modalTitle.value,
      label: modalLabel.value,
      dueHours: Number(modalEstimate.value) || 24,
      type: modalType.value,
      estimate: Number(modalEstimate.value) || 0,
      youtube: modalYoutube.value
    });
    closeModal(saveCardBtn);
  });
}

// ✅ Cancel Button Closes Modal
if (cancelCardBtn) {
  cancelCardBtn.addEventListener('click', () => {
    closeModal(cancelCardBtn);
  });
}

// ✅ Remove GIF Support (No GIF input)
// Just ensure no input, field, or upload logic for GIFs exists anywhere

// ✅ Remove #credits-btn CSS if it exists
/*
#credits-btn {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: none;
  border: none;
  color: var(--text-color);
  font-size: 0.9rem;
  cursor: pointer;
}
*/

// ✅ Use Cute Font (Add in CSS)
document.body.style.fontFamily = "'Quicksand', 'Comfortaa', 'Nunito', sans-serif";

// ✅ Optional - Style Cards Based on Title
function getCardColor(title) {
  const key = title.toLowerCase();
  if (key.includes('sleep')) return 'card-sleep';
  if (key.includes('bottle')) return 'card-bottle';
  if (key.includes('solids')) return 'card-solids';
  if (key.includes('diaper')) return 'card-diaper';
  if (key.includes('growth')) return 'card-growth';
  return 'card-default';
}

function createCard(card) {
  const div = document.createElement('div');
  div.className = `card ${getCardColor(card.title)}`;
  // ... rest of createCard logic stays the same
}


// ---- Minimal Helpers and Card Logic ----
function openModal(modal) {
  if (modal) modal.classList.remove('hidden');
}

function hideModal(modal) {
  if (modal) modal.classList.add('hidden');
}

function closeModal(btn) {
  if (btn && btn.closest) hideModal(btn.closest('.modal'));
}

function formatAgo(created) {
  const diff = Date.now() - created;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs) return `${hrs}h ${mins % 60}m ago`;
  return `${mins}m ago`;
}

function createCardElement(card) {
  const div = document.createElement('div');
  div.className = 'card';
  div.dataset.created = card.created;
  const title = document.createElement('span');
  title.textContent = card.title;
  const time = document.createElement('span');
  time.className = 'timestamp';
  time.textContent = formatAgo(card.created);
  div.appendChild(title);
  div.appendChild(time);
  return div;
}

function renderCards() {
  if (!container) return;
  container.innerHTML = '';
  cards.forEach(card => container.appendChild(createCardElement(card)));
  if (noCards) noCards.classList.toggle('hidden', cards.length !== 0);
}

function addCard(data = {}) {
  const card = {
    title: data.title || 'Activity',
    label: data.label || '',
    created: Date.now(),
  };
  cards.push(card);
  renderCards();
}

// update timestamps periodically
setInterval(() => {
  document.querySelectorAll('.card').forEach(div => {
    const t = Number(div.dataset.created);
    const span = div.querySelector('.timestamp');
    if (t && span) span.textContent = formatAgo(t);
  });
}, 60000);


