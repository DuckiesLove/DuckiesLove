const PASSWORD = "Duckies";

function showPasswordOverlay() {
  const overlay = document.getElementById("password-overlay");
  if (overlay) overlay.style.display = "flex";
}

function checkPassword() {
  const value = document.getElementById("password-input").value;
  if (value === PASSWORD) {
    localStorage.setItem("greenlightUnlocked", "true");
    document.getElementById("password-overlay").style.display = "none";
    initApp();
  } else {
    document.getElementById("password-error").style.display = "block";
  }
}

function initApp() {
  const container = document.getElementById("tracker-container");
  subjects.forEach((subject, i) =>
    container.appendChild(createCard(i, subject))
  );

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    document.getElementById("theme-toggle").checked = true;
  }
}

const subjects = [
  "Braiding",
  "Reading",
  "Videos to Watch",
  "Service & Protocol",
  "Tasks Today",
  "Shibari Practice"
];

function createCard(i, subject) {
  const savedTitle = localStorage.getItem(`title-${i}`) || subject;
  const savedTime = localStorage.getItem(`last-done-${i}`) || "–";
  const savedNotes = localStorage.getItem(`notes-${i}`) || "";
  const card = document.createElement("div");
  card.className = "tracker-card";
  card.setAttribute("draggable", "true");
  card.dataset.index = i;

  card.innerHTML = `
    <input class="tracker-title" value="${savedTitle}" />
    <p>Last done: <span id="last-done-${i}">${savedTime}</span></p>
    <p>Next due: <span id="next-due-${i}">–</span></p>
    <textarea placeholder="Notes...">${savedNotes}</textarea>
    <button onclick="markDone(${i})">Mark as Done</button>
  `;

  card.querySelector(".tracker-title").addEventListener("input", (e) =>
    localStorage.setItem(`title-${i}`, e.target.value)
  );
  card.querySelector("textarea").addEventListener("input", (e) =>
    localStorage.setItem(`notes-${i}`, e.target.value)
  );
  card.addEventListener("dragstart", dragStart);
  card.addEventListener("dragover", dragOver);
  card.addEventListener("drop", dropCard);
  return card;
}

function markDone(i) {
  const now = new Date().toLocaleString();
  document.getElementById(`last-done-${i}`).textContent = now;
  localStorage.setItem(`last-done-${i}`, now);
}

function sortCards() {
  const method = document.getElementById("sort-method").value;
  const container = document.getElementById("tracker-container");
  const cards = Array.from(container.children);

  if (method === "alphabetical") {
    cards.sort((a, b) => a.querySelector(".tracker-title").value.localeCompare(b.querySelector(".tracker-title").value));
  } else if (method === "lastdone") {
    cards.sort((a, b) =>
      (new Date(b.querySelector("span[id^='last-done']").textContent).getTime() || 0) -
      (new Date(a.querySelector("span[id^='last-done']").textContent).getTime() || 0)
    );
  } else {
    cards.sort((a, b) => a.dataset.index - b.dataset.index);
  }

  cards.forEach(card => container.appendChild(card));
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function dragStart(e) {
  e.dataTransfer.setData("text/plain", e.currentTarget.dataset.index);
}

function dragOver(e) {
  e.preventDefault();
}

function dropCard(e) {
  e.preventDefault();
  const fromIndex = e.dataTransfer.getData("text/plain");
  const toCard = e.currentTarget;
  const container = document.getElementById("tracker-container");
  const fromCard = container.querySelector(`[data-index='${fromIndex}']`);
  container.insertBefore(fromCard, toCard);
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("greenlightUnlocked") === "true") {
    initApp();
  } else {
    showPasswordOverlay();
  }
});