## \ud83d\udce6 Setup Instructions for *Beneath the Greenlight* Ritual Tracker

**Hosted under your GitHub Pages domain: [https://duckieslove.github.io](https://duckieslove.github.io)**

This neurodivergent-friendly devotion tracker installs in its own folder so it won't interfere with your main site.

---

### \ud83c\udf10 Live App URL
After setup, access the tracker at:
[https://duckieslove.github.io/greenlight/](https://duckieslove.github.io/greenlight/)

Add it to your mobile home screen for an app-like experience.

The page is protected with the password **Duckies**. You'll be prompted to enter
it the first time you visit.

---

### \ud83d\udcc1 Folder & File Structure
Place the tracker files in a subfolder named `greenlight` at the root of your repo:

```
DuckiesLove/
  greenlight/
    index.html
    style.css
    script.js
```

---

### \ud83d\ude80 Development Setup
1. Clone your repository and enter it:
   ```bash
   git clone https://github.com/duckieslove/DuckiesLove.git
   cd DuckiesLove
   ```
2. (Optional) Install the `serve` package if you want a quick local preview:
   ```bash
   npm install -g serve
   ```
3. Start a local server from the repository root:
   ```bash
   serve .
   ```
   Then open `http://localhost:3000/greenlight/` in your browser.

---

### \ud83d\udd04 Updating the Tracker
Edit the files inside the `greenlight` folder and push your changes. GitHub Pages will automatically publish them to `https://duckieslove.github.io/greenlight/`.

### \ud83c\udf1f Embedding the Tracker
Link to the tracker from other pages with:

```html
<a href="https://duckieslove.github.io/greenlight/">Open Beneath the Greenlight</a>
```

