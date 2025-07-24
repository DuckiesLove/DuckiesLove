async function loadStories() {
  const container = document.getElementById('community-stories');
  if (!container) return;
  try {
    const resp = await fetch('stories/index.json');
    const files = await resp.json();
    for (const file of files) {
      const md = await fetch(`stories/${file}`).then(r => r.text());
      const html = window.marked ? window.marked(md) : md;
      const article = document.createElement('article');
      article.innerHTML = html;
      container.appendChild(article);
    }
  } catch (err) {
    console.error('Unable to load stories', err);
  }
}

document.addEventListener('DOMContentLoaded', loadStories);
