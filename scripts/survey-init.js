console.log("TK init v2025-10-17-1");

async function tkLoadCategories() {
  const list = document.getElementById("tk-cat-list");
  if (!list) return console.warn("No #tk-cat-list element found");
  list.textContent = "Loading…";
  try {
    const res = await fetch("/data/kinks.json", { cache: "no-store" });
    const data = await res.json();
    let cats = [];
    if (Array.isArray(data)) cats = data.map(x => x.name || x.title || x);
    else if (Array.isArray(data?.categories)) cats = data.categories.map(x => x.name || x);
    else if (typeof data === "object") cats = Object.keys(data);
    list.innerHTML = cats.map(c => `<label class="tk-cat"><input type="checkbox"> ${c}</label>`).join("");
    console.log(`✅ Categories loaded (${cats.length})`);
  } catch (err) {
    console.error("❌ Failed to load categories", err);
    list.textContent = "Error loading categories";
  }
}

function tkMakeScale(container, group="rating-A") {
  if (!container) return;
  container.innerHTML = "";
  for (let i=0;i<=5;i++) {
    const btn = document.createElement("button");
    btn.className = "tk-opt";
    btn.dataset.group = group;
    btn.dataset.value = i;
    btn.textContent = i;
    container.appendChild(btn);
  }
}

function tkRenderQuestionCard() {
  const panel = document.getElementById("question-panel");
  panel.hidden = false;
  panel.innerHTML = `
    <h2 class="tk-title">Rate interest/comfort (0–5)</h2>
    <div id="tk-scale" data-group="rating-A"></div>`;
  tkMakeScale(document.getElementById("tk-scale"), "rating-A");
  document.getElementById("tk-right").hidden = false;
}

window.startSurvey = function() {
  document.getElementById("tk-landing").hidden = true;
  tkRenderQuestionCard();
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready — init TalkKink");
  tkLoadCategories();
  document.getElementById("btnStart")?.addEventListener("click", startSurvey);
  if (new URLSearchParams(location.search).has("autostart")) startSurvey();
});
