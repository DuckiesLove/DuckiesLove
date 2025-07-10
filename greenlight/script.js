document.getElementById('addBtn').onclick = () => {
  document.getElementById('modal').classList.remove('hidden');
};
document.getElementById('closeModal').onclick = () => {
  document.getElementById('modal').classList.add('hidden');
};

const content = document.getElementById('content');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const customBtn = document.getElementById('customBtn');

function addRitual(name = "New Ritual") {
  const card = document.createElement('div');
  card.className = 'ritual-card';

  const title = document.createElement('input');
  title.className = 'ritual-title';
  title.value = name;

  const timerType = document.createElement('select');
  timerType.className = 'ritual-type';
  const option1 = document.createElement('option');
  option1.value = 'left';
  option1.textContent = 'Time Left';
  const option2 = document.createElement('option');
  option2.value = 'since';
  option2.textContent = 'Time Since';
  timerType.appendChild(option1);
  timerType.appendChild(option2);

  const timerInput = document.createElement('input');
  timerInput.className = 'ritual-timer';
  timerInput.placeholder = 'e.g., 30m, 2h';

  card.appendChild(title);
  card.appendChild(timerType);
  card.appendChild(timerInput);
  content.appendChild(card);
  document.querySelector('.empty-state').style.display = 'none';
}

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    addRitual(button.textContent);
    document.getElementById('modal').classList.add('hidden');
  });
});

customBtn.onclick = () => {
  addRitual();
  document.getElementById('modal').classList.add('hidden');
};
