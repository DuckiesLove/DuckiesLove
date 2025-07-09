import { getHomeHTML } from './pages/home.js';
import { getSurveyHTML } from './pages/survey.js';
import { getResultsHTML } from './pages/results.js';
import { getCompareHTML } from './pages/compare.js';
import { getRolesHTML } from './pages/roles.js';

function loadPage() {
  const route = window.location.hash || '#/';
  const container = document.getElementById('main-content');

  switch (route) {
    case '#/survey':
      container.innerHTML = getSurveyHTML();
      break;
    case '#/results':
      container.innerHTML = getResultsHTML();
      break;
    case '#/compare':
      container.innerHTML = getCompareHTML();
      break;
    case '#/roles':
      container.innerHTML = getRolesHTML();
      break;
    default:
      container.innerHTML = getHomeHTML();
      break;
  }
}

window.addEventListener('hashchange', loadPage);
window.addEventListener('load', loadPage);
