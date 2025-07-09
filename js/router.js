import { getHomeHTML } from './pages/home.js';
import { getSurveyHTML } from './pages/survey.js';
import { getResultsHTML } from './pages/results.js';
import { getCompareHTML } from './pages/compare.js';
import { getRolesHTML } from './pages/roles.js';

function loadPage() {
  const route = window.location.hash || '#/';
  const container = document.getElementById('main-content');
  let html = '';

  switch (route) {
    case '#/survey':
      html = getSurveyHTML();
      break;
    case '#/results':
      html = getResultsHTML();
      break;
    case '#/compare':
      html = getCompareHTML();
      break;
    case '#/roles':
      html = getRolesHTML();
      break;
    default:
      html = getHomeHTML();
      break;
  }

  container.innerHTML = html;

  container.querySelectorAll('script').forEach(original => {
    const script = document.createElement('script');
    if (original.src) script.src = original.src;
    if (original.type) script.type = original.type;
    document.body.appendChild(script);
    original.remove();
  });
}

window.addEventListener('hashchange', loadPage);
window.addEventListener('load', loadPage);
