console.log("TK init v2025-10-17-3");

const TK_KINKS_URL = "/data/kinks.json";

const CATEGORY_LIST_SELECTORS = ["#tk-cat-list", "#categoryChecklist"];

const hasModernQuestionUI = typeof window.initQuestionUI === "function";

const ESCAPE_LOOKUP = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_LOOKUP[char] || char);

function findCategoryList() {
  for (const selector of CATEGORY_LIST_SELECTORS) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function normalizeCategories(data) {
  if (!data) return [];

  const toName = (entry) => entry?.name || entry?.title || entry?.category || entry;

  let categories = [];
  if (Array.isArray(data)) categories = data.map(toName);
  else if (Array.isArray(data?.categories)) categories = data.categories.map(toName);
  else if (typeof data === "object") categories = Object.keys(data);

  return categories
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

if (!window.__tkFetchPatched) {
  window.__tkFetchPatched = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const [url] = args;
    if (typeof url === "string" && url.includes(TK_KINKS_URL)) {
      if (window.__tkKinksResponseBody) {
        console.log("⏩ Skipped duplicate kinks.json fetch");
        const init = window.__tkKinksResponseInit || { status: 200 };
        const headers = init.headers || { "Content-Type": "application/json" };
        return new Response(window.__tkKinksResponseBody, { ...init, headers });
      }

      const response = await realFetch(...args);
      if (response.ok) {
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          window.__tkKinksResponseBody = text;
          window.__tkKinksResponseInit = {
            status: response.status,
            statusText: response.statusText,
            headers: {
              "Content-Type": response.headers.get("content-type") || "application/json",
            },
          };
          const parsed = JSON.parse(text);
          const categories = normalizeCategories(parsed);
          window.__tkCatsData = categories;
          window.__tkCatsPromise = Promise.resolve(categories);
        } catch (error) {
          console.warn("Failed to cache kinks.json response", error);
        }
      }
      return response;
    }
    return realFetch(...args);
  };
}

async function fetchCategoriesOnce() {
  if (window.__tkCatsPromise) return window.__tkCatsPromise;

  window.__tkCatsPromise = (async () => {
    try {
      const res = await fetch(TK_KINKS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const categories = normalizeCategories(data);
      window.__tkCatsData = categories;
      return categories;
    } catch (error) {
      // Allow retries if the request fails.
      window.__tkCatsPromise = null;
      throw error;
    }
  })();

  return window.__tkCatsPromise;
}

function renderCategoryMarkup(list, categories) {
  if (!list) return;
  const isList = /^(UL|OL)$/i.test(list.tagName);
  const items = categories
    .map((name, index) => {
      const rawName = String(name ?? "").trim();
      const escapedValue = escapeHtml(rawName);
      const id = `tk-cat-${index}`;
      const checkbox = `<input type="checkbox" value="${escapedValue}" id="${id}">`;
      const labelInner = `${checkbox}<span class="tk-catname">${escapedValue}</span>`;
      if (isList) {
        return `<li class="tk-catrow"><label class="tk-cat" for="${id}">${labelInner}</label></li>`;
      }
      return `<label class="tk-cat" for="${id}">${labelInner}</label>`;
    })
    .join("");

  list.innerHTML = items || "<div class=\"tk-cat-empty\">No categories available</div>";

  if (!items) return;

  const countNode = document.getElementById("tkCatSel");
  const startBtn = document.getElementById("btnStart");

  const updateState = () => {
    const selected = list.querySelectorAll('input[type="checkbox"]:checked').length;
    if (countNode) countNode.textContent = String(selected);
    if (startBtn) {
      const disabled = selected < 1;
      startBtn.disabled = disabled;
      startBtn.setAttribute("aria-disabled", String(disabled));
    }
  };

  list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", updateState);
  });

  updateState();
}

async function tkLoadCategories() {
  const list = findCategoryList();
  if (!list) {
    console.warn("No category list element found (looked for #tk-cat-list, #categoryChecklist)");
    return;
  }

  if (list.dataset.tkHydrated === "1") return;

  if (hasModernQuestionUI && list.id === "categoryChecklist") {
    // The modern survey bundle manages rendering; avoid double-fetching unless empty.
    if (list.children.length > 0) {
      list.dataset.tkHydrated = "1";
      return;
    }
  }

  list.textContent = "Loading…";
  try {
    const categories = window.__tkCatsData || (await fetchCategoriesOnce());
    renderCategoryMarkup(list, categories);
    list.dataset.tkHydrated = "1";
    console.log(`✅ Categories loaded (${categories.length})`);
  } catch (err) {
    console.error("❌ Failed to load categories", err);
    list.textContent = "Error loading categories";
  }
}

function tkMakeScale(container, group = "rating-A") {
  if (!container || container.dataset.tkScaleReady === "1") return;

  container.innerHTML = "";
  for (let i = 0; i <= 5; i += 1) {
    const btn = document.createElement("button");
    btn.className = "tk-opt option";
    btn.dataset.group = group;
    btn.dataset.value = String(i);
    btn.type = "button";
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = String(i);
    container.appendChild(btn);
  }

  if (!hasModernQuestionUI) {
    container.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("button.tk-opt");
      if (!btn || !container.contains(btn)) return;
      event.preventDefault();
      const value = btn.dataset.value ?? btn.textContent ?? "";
      const selectedValue = String(value).trim();

      container.querySelectorAll("button.tk-opt").forEach((node) => {
        const isActive = node === btn;
        node.classList.toggle("selected", isActive);
        node.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      container.dataset.selected = selectedValue;

      const detail = {
        group,
        value: Number.isNaN(Number(selectedValue)) ? null : Number(selectedValue),
        rawValue: selectedValue,
      };

      container.dispatchEvent(new CustomEvent("tk:rating-change", { detail, bubbles: true }));
    });
  }

  container.dataset.tkScaleReady = "1";
}

function tkRenderQuestionCard() {
  const panel = document.getElementById("question-panel");
  if (!panel) return;

  panel.hidden = false;
  panel.innerHTML = `
    <h2 class="tk-title">Rate interest/comfort (0–5)</h2>
    <div id="tk-scale" data-group="rating-A"></div>`;
  tkMakeScale(document.getElementById("tk-scale"), "rating-A");

  document.getElementById("tk-right")?.removeAttribute("hidden");
}

function revealSurveyApp() {
  const surveyApp = document.getElementById("surveyApp");
  if (surveyApp) {
    surveyApp.classList.remove("is-hidden");
    surveyApp.hidden = false;
  }
  const ctaStack = document.getElementById("ctaStack");
  if (ctaStack) {
    ctaStack.style.display = "none";
  }
}

window.startSurvey = function startSurvey() {
  const landing = document.getElementById("tk-landing");
  if (landing) landing.hidden = true;

  if (document.getElementById("surveyApp")) {
    revealSurveyApp();
  } else {
    tkRenderQuestionCard();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready — init TalkKink");
  tkLoadCategories();

  const startButton = document.getElementById("btnStart");
  if (startButton && !startButton.dataset.tkStartBound) {
    startButton.addEventListener("click", startSurvey);
    startButton.dataset.tkStartBound = "1";
  }

  if (new URLSearchParams(location.search).has("autostart")) startSurvey();
});
