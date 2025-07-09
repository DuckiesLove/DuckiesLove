export function getCompareHTML() {
  return `
  <div class="scroll-container">
    <h1>See Our Compatibility</h1>
    <div class="back-button-container">
      <button onclick="window.location.hash='#/'">&larr; Back</button>
    </div>
    <div class="compatibility-button-container">
      <div class="button-group">
        <label class="compatibility-button file-upload">
          <span>Upload Your Survey</span>
          <input type="file" id="fileA" hidden />
        </label>
        <label class="compatibility-button file-upload">
          <span>Upload Partner's Survey</span>
          <input type="file" id="fileB" hidden />
        </label>
      </div>
      <div class="button-container">
        <button id="calculateCompatibility" class="compatibility-button">Calculate Partner Compatibility</button>
        <button id="downloadResults" class="compatibility-button">Download Results</button>
      </div>
    </div>
    <div id="comparisonResult"></div>
  </div>
  <script src="js/template-survey.js"></script>
  <script type="module" src="js/compatibilityPage.js"></script>`;
}
