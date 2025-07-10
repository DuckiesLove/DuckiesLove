const content = document.getElementById('content');
const addBtn = document.getElementById('addBtn');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const form = document.getElementById('ritualForm');
const titleInput = document.getElementById('ritualTitle');
const notesInput = document.getElementById('ritualNotes');
const videoInput = document.getElementById('ritualVideo');
const videoLabelInput = document.getElementById('ritualVideoLabel');
const categoryInput = document.getElementById('ritualCategory');
const fileInput = document.getElementById('ritualFiles');
const presetButtons = document.querySelectorAll('.preset-buttons button');

let rituals = JSON.parse(localStorage.getItem('rituals') || '[]');

function save() {
  localStorage.setItem('rituals', JSON.stringify(rituals));
}

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function render() {
  content.innerHTML = '';
  if (rituals.length === 0) {
    content.innerHTML = '<p class="empty-state">No rituals yet. Tap the + button to begin your devotion.</p>';
    return;
  }
  const categories = {};
  rituals.forEach((ritual, index) => {
    const cat = ritual.category || 'Uncategorized';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ ritual, index });
  });

  for (const cat of Object.keys(categories)) {
    const header = document.createElement('h2');
    header.textContent = cat;
    header.className = 'category-header';
    content.appendChild(header);

    for (const { ritual, index } of categories[cat]) {
      const card = document.createElement('div');
      card.className = 'card';
      const h = document.createElement('h3');
      h.textContent = ritual.title;
      card.appendChild(h);
      if (ritual.notes) {
        const p = document.createElement('p');
        p.textContent = ritual.notes;
        card.appendChild(p);
      }
      if (ritual.video) {
        const a = document.createElement('a');
        a.href = ritual.video;
        a.target = '_blank';
        a.textContent = ritual.videoLabel || 'YouTube Video';
        a.className = 'video-link';
        card.appendChild(a);
      }
      if (ritual.files && ritual.files.length) {
        const attach = document.createElement('div');
        attach.className = 'attachments';
        for (const f of ritual.files) {
          if (f.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = f.data;
            attach.appendChild(img);
          } else if (f.type.startsWith('audio/')) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = f.data;
            attach.appendChild(audio);
          }
        }
        card.appendChild(attach);
      }
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'delete-btn';
      del.onclick = () => {
        rituals.splice(index, 1);
        save();
        render();
      };
      card.appendChild(del);
      content.appendChild(card);
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const files = fileInput.files;
  const attachments = [];
  for (const file of files) {
    const data = await fileToDataUrl(file);
    attachments.push({ type: file.type, data });
  }
  rituals.push({
    title: titleInput.value.trim() || 'Untitled',
    notes: notesInput.value.trim(),
    video: videoInput.value.trim(),
    videoLabel: videoLabelInput.value.trim() || 'YouTube Video',
    category: categoryInput.value.trim(),
    files: attachments
  });
  save();
  render();
  form.reset();
  modal.classList.add('hidden');
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    titleInput.value = btn.dataset.title || btn.textContent;
  });
});

addBtn.onclick = () => {
  modal.classList.remove('hidden');
};
closeModal.onclick = () => {
  modal.classList.add('hidden');
};

render();
