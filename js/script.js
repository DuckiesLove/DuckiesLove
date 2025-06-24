document.addEventListener("DOMContentLoaded", () => {
  const themeSelector = document.getElementById("themeSelector");
  const outerWildsBanner = document.getElementById("outerWildsBanner");
  const monsterPromBanner = document.getElementById("monsterPromBanner");

  function updateBannerVisibility(theme) {
    outerWildsBanner.style.display = theme === "theme-outer-wilds" ? "block" : "none";
    monsterPromBanner.style.display = theme === "theme-monster-prom" ? "block" : "none";
  }

  const savedTheme = localStorage.getItem("selectedTheme");
  if (savedTheme) {
    document.body.className = savedTheme;
    themeSelector.value = savedTheme;
    updateBannerVisibility(savedTheme);
  }

  themeSelector.addEventListener("change", () => {
    const selectedTheme = themeSelector.value;
    document.body.className = selectedTheme;
    localStorage.setItem("selectedTheme", selectedTheme);
    updateBannerVisibility(selectedTheme);
  });

  // Tab switching logic
  let currentAction = "Giving";

  function switchTab(action) {
    currentAction = action;

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    const activeTab = document.getElementById(`${action.toLowerCase()}Tab`);
    if (activeTab) activeTab.classList.add("active");

    if (typeof showCategories === "function") {
      showCategories();
      if (typeof currentCategory !== "undefined" && currentCategory) {
        showKinks(currentCategory);
      }
    }
  }

  document.getElementById("givingTab")?.addEventListener("click", () => switchTab("Giving"));
  document.getElementById("receivingTab")?.addEventListener("click", () => switchTab("Receiving"));
  document.getElementById("neutralTab")?.addEventListener("click", () => switchTab("Neutral"));

  switchTab("Giving");
});
