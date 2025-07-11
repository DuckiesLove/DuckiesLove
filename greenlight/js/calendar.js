const STORAGE_KEY = 'greenlight-shared-calendar';
let events = [];
let calendar;
let editingEvent = null;

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function formatTZ(tz) {
  const date = new Date();
  const parts = date.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'short' }).split(' ');
  const abbr = parts.pop();
  const offset = -new Date(date.toLocaleString('en-US', { timeZone: tz })).getTimezoneOffset() / 60;
  const sign = offset >= 0 ? '+' : '';
  return `${abbr} (UTC${sign}${offset})`;
}

function updateTZDisplay(yourTz, partnerTz) {
  document.getElementById('your-display').textContent = `Your Time: ${formatTZ(yourTz)}`;
  document.getElementById('partner-display').textContent = `Their Time: ${formatTZ(partnerTz)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const yourTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const partnerTz = localStorage.getItem('greenlight-tz') || yourTz;
  updateTZDisplay(yourTz, partnerTz);

  events = loadEvents();

  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    timeZone: yourTz,
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events,
    editable: true,
    eventClick: info => openEditModal(info.event)
  });
  calendar.render();

  document.getElementById('tz-toggle').addEventListener('change', e => {
    const tz = e.target.value === 'partner' ? partnerTz : yourTz;
    calendar.setOption('timeZone', tz);
  });

  document.getElementById('add-event').addEventListener('click', () => {
    editingEvent = null;
    document.getElementById('event-title').value = '';
    document.getElementById('event-start').value = '';
    document.getElementById('event-end').value = '';
    document.getElementById('event-label').value = '';
    document.getElementById('event-visibility').value = 'busy';
    document.getElementById('event-initials').value = '';
    document.getElementById('delete-event').classList.add('hidden');
    openModal(document.getElementById('event-modal'));
  });

  document.getElementById('export-events').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'greenlight-calendar.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFile = document.getElementById('import-file');
  document.getElementById('import-events').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          events = data;
          saveEvents();
          calendar.removeAllEvents();
          calendar.addEventSource(events);
        }
      } catch (err) {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('save-event').addEventListener('click', () => {
    const title = document.getElementById('event-title').value.trim();
    const start = document.getElementById('event-start').value;
    const end = document.getElementById('event-end').value;
    const label = document.getElementById('event-label').value.trim();
    const visibility = document.getElementById('event-visibility').value;
    const initials = document.getElementById('event-initials').value.trim();
    if (!title || !start || !end || !initials) {
      alert('Please complete required fields');
      return;
    }
    const eventData = {
      id: editingEvent ? editingEvent.id : Date.now(),
      title,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      label,
      addedBy: initials,
      visibility
    };
    if (editingEvent) {
      const idx = events.findIndex(e => e.id === editingEvent.id);
      if (idx > -1) events[idx] = eventData;
      editingEvent.setProp('title', title);
      editingEvent.setStart(eventData.start);
      editingEvent.setEnd(eventData.end);
      editingEvent.setExtendedProp('label', label);
      editingEvent.setExtendedProp('addedBy', initials);
      editingEvent.setExtendedProp('visibility', visibility);
    } else {
      events.push(eventData);
      calendar.addEvent(eventData);
    }
    saveEvents();
    closeModal(document.getElementById('save-event'));
  });

  document.getElementById('delete-event').addEventListener('click', () => {
    if (!editingEvent) return;
    if (confirm('Delete this event?')) {
      events = events.filter(e => e.id !== editingEvent.id);
      editingEvent.remove();
      saveEvents();
      closeModal(document.getElementById('delete-event'));
    }
  });
});

function openEditModal(event) {
  editingEvent = event;
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-start').value = event.startStr.replace('Z', '');
  document.getElementById('event-end').value = event.endStr ? event.endStr.replace('Z', '') : '';
  document.getElementById('event-label').value = event.extendedProps.label || '';
  document.getElementById('event-visibility').value = event.extendedProps.visibility || 'busy';
  document.getElementById('event-initials').value = event.extendedProps.addedBy || '';
  document.getElementById('delete-event').classList.remove('hidden');
  openModal(document.getElementById('event-modal'));
}
