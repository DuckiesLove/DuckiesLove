export function getSurveyHTML() {
  return `
  <div id="progressBanner" class="progress-container" style="display:none">
    <div id="progressLabel" class="progress-label"></div>
    <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
  </div>

  <div id="ratingLegend">
    <ul>
      <li>0 = Hard limit / dislike</li>
      <li>1 = Disinterested</li>
      <li>2 = Neutral</li>
      <li>3 = Like it</li>
      <li>4 = Really like it</li>
      <li>5 = Core turn-on</li>
    </ul>
  </div>

  <div class="tab-toggle-group">
    <div class="tab-container">
      <div id="givingTab" class="tab active">Giving</div>
      <div id="receivingTab" class="tab">Receiving</div>
      <div id="generalTab" class="tab">Neutral</div>
    </div>
  </div>

  <div class="main-container">
    <div class="content-panel">
      <div id="surveyContainer">
        <h2 id="categoryTitle"></h2>
        <div id="kinkList"></div>
        <div class="nav-buttons">
          <button id="nextCategoryBtn">Next Category</button>
          <button id="skipCategoryBtn">Skip</button>
        </div>
      </div>
      <div id="finalScreen" class="final-screen" style="display:none">
        <button id="saveSurveyBtn">Save Survey</button>
        <button id="returnHomeBtn" onclick="window.location.hash='#/'">Return Home</button>
      </div>
    </div>
  </div>
  `;
}
