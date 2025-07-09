export function getHomeHTML() {
  return `
  <h1>Talk Kink</h1>
  <p class="instruction-banner">
    💡 “After completing the survey, click ‘Export My List’ to download your answers. You can then view or compare your data by uploading it. Your data is never saved — everything happens on your device.”
  </p>
  <div id="themeControl">
    <label for="themeSelector">🎨 Select Theme:</label>
    <select id="themeSelector">
      <option value="dark-mode">Dark</option>
      <option value="light-mode">Light Forest</option>
      <option value="theme-blue">Blue</option>
      <option value="theme-echoes-beyond">Echoes Beyond</option>
      <option value="theme-love-notes-lipstick">Love Notes & Lipstick</option>
      <option value="theme-rainbow">Rainbow</option>
    </select>
  </div>
  <div class="menu-container">
    <div class="button-group">
      <button id="newSurveyBtn" class="survey-button" onclick="window.location.hash='#/survey'">Start New Survey</button>
      <button id="downloadBtn" class="survey-button">Export My List</button>
      <div class="section-spacing"></div>
      <button id="compatibilityBtn" class="survey-button" onclick="window.location.hash='#/compare'">See Our Compatibility</button>
      <button id="roleDefinitionsBtn" class="survey-button" onclick="window.location.hash='#/roles'">Role Definitions</button>
      <button id="roleResultsBtn" class="survey-button" onclick="window.location.hash='#/results'">View Role Results</button>
      <button id="kinkListBtn" class="survey-button" onclick="location.href='kink-list.html'">View Kink List</button>
    </div>
  </div>`;
}
