const completedContainer = document.getElementById('completed-cards-container');
const formArea = document.getElementById('card-form-area');
const addBtn = document.getElementById('add-category-btn');
const presetMenu = document.getElementById('preset-menu');
const presetButtons = document.querySelectorAll('#preset-menu .preset-option');
const customOption = document.getElementById('custom-option');

const STORAGE_KEY = 'greenlight-categories';
let categories = [];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

function createForm(cat) {
  const div = document.createElement('div');
  div.className = 'category-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Category name';
  input.value = cat.name;
  input.oninput = () => {
    cat.name = input.value;
    save();
  };

  const label = document.createElement('label');
  label.textContent = 'Completed ';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = cat.completed;
  checkbox.onchange = () => {
    cat.completed = checkbox.checked;
    save();
    render();
  };
  label.appendChild(checkbox);

  div.appendChild(input);
  div.appendChild(label);

  return div;
}

function createCard(cat) {
  const div = document.createElement('div');
  div.className = 'category-card';
  div.textContent = cat.name;
  return div;
}

function render() {
  completedContainer.innerHTML = '';
  formArea.innerHTML = '';
  categories.forEach(cat => {
    if (cat.completed) {
      completedContainer.appendChild(createCard(cat));
    } else {
      formArea.appendChild(createForm(cat));
    }
  });
  formArea.style.display = categories.some(c => !c.completed) ? 'block' : 'none';
}

function load() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      categories = JSON.parse(data);
    } catch {
      categories = [];
    }
  }
  render();
}

function addCategory(name = '') {
  const cat = { id: Date.now(), name, completed: false };
  categories.push(cat);
  save();
  render();
  formArea.style.display = 'block';
}

addBtn.addEventListener('click', () => {
  presetMenu.classList.toggle('hidden');
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    addCategory(btn.textContent);
    presetMenu.classList.add('hidden');
  });
});

customOption.addEventListener('click', () => {
  addCategory();
  presetMenu.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!presetMenu.contains(e.target) && e.target !== addBtn) {
    presetMenu.classList.add('hidden');
  }
});

window.addEventListener('load', load);
