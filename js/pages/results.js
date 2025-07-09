export function getResultsHTML() {
  return `
  <div class="scroll-container">
    <h1>Your Role Matches</h1>
    <p>Upload your exported survey to see how your kinks align with common roles.</p>
    <label class="survey-button file-upload">
      <span>Select Survey File</span>
      <input type="file" id="roleFile" hidden />
    </label>
    <div id="rolesOutput"></div>
  </div>
  <script type="module" src="js/calculateRoleScores.js"></script>`;
}
