# Talk Kink GitHub Pages

This repository hosts the static files for the Talk Kink website.
Visiting https://www.talkkink.org/ shows the Kink Interest Survey and
provides a link to the `/greenlight/` tool.

## DNS Configuration

To serve the site at **www.talkkink.org** using GitHub Pages, configure your DNS provider with one of the following approaches:

1. **A/AAAA records**
   - Point the `www` subdomain to GitHub's IPv4 addresses:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Optionally add the IPv6 addresses:
     - `2606:50c0:8000::153`
     - `2606:50c0:8001::153`
     - `2606:50c0:8002::153`
     - `2606:50c0:8003::153`

2. **CNAME record**
   - Create a CNAME record for `www` pointing to `<your-github-username>.github.io` (or the domain shown in your Pages settings).
   
To support the apex domain **talkkink.org**, either:

- Add `A` records for `talkkink.org` using the same IP addresses listed above, or
- Use an `ALIAS`/`ANAME` record that points `talkkink.org` to `<your-github-username>.github.io` if your DNS provider offers it.

After the apex records resolve, GitHub can serve the site on both `talkkink.org` and `www.talkkink.org`. If you want the apex to redirect to `www`, keep `www.talkkink.org` as the custom domain in the repository's Pages settings and either rely on GitHub's automatic redirect or configure a URL redirect with your DNS provider.

A `CNAME` file already exists in this repository with the line `www.talkkink.org` so GitHub knows which domain to expect.

## Enforce HTTPS

After the DNS records resolve, go to the repository’s **Settings** → **Pages** section and enable **Enforce HTTPS**. This ensures all visitors are automatically redirected to the secure version of the site.

## Site Files

- `index.html` (main survey page linking to `/greenlight/` and other tools)
- `compatibility.html` (compare two survey results; includes the villain mascot with a toggleable quote)
- `css/style.css`
- `js/script.js`
- `template-survey.json`

The compatibility page hides the villain quote when printing. Use the **Toggle Villain Quote** button beneath the comparison area to reveal or collapse the text.

The **Start New Survey** button fetches `../template-survey.json` so nested
pages like `/kinks/` load the template correctly. If you open the pages
directly from your file system, the script falls back to an embedded copy of
the template.

Running a local web server is still recommended while developing so the latest
JSON is loaded and all paths behave consistently. See below for quick server
options.

## Setup

Run `setup.sh` to install optional tools for local development. The script
installs the Node `serve` package when `npm` is available so you can preview
the site locally.

## Local Development

Serve the static files locally to preview changes before pushing them to GitHub.

### Using Python

If you have Python 3 installed, run:

```bash
python3 -m http.server
```

Then open <http://localhost:8000> in your browser.

### Using Node

First install the `serve` package globally if you haven’t already:

```bash
npm install -g serve
```

Start the server from the repository root:

```bash
serve .
```

This will default to <http://localhost:3000>.

### PDF Generation

The **Download Data** button on `compatibility.html` relies on the `jsPDF` library
loaded from a CDN. When the page is opened directly from your file system
(`file://`), most browsers block this request and a small stub runs instead. The
stub now opens the browser's print dialog so you can choose **Save as PDF** if the
library fails to load. Run a local web server and select **Download Data** again
to download the PDF automatically.

#### PDF Themes

PDF exports default to a dark color scheme (black background with white text).
Override the `--pdf-bg` and `--pdf-text` CSS variables to switch themes. For a
light PDF, set them on the page or in a stylesheet:

```html
<body style="--pdf-bg: #fff; --pdf-text: #000">
```

```css
:root {
  --pdf-bg: #fff;
  --pdf-text: #000;
}
```

You can also toggle themes programmatically. Passing `'light'` to
`applyPrintStyles()` sets these variables for you, and pages with the
`light-mode` class call this helper automatically.

#### Example PDF Export

Use `CompatibilityPDFExporter` to render any container to a PDF:

```javascript
import { CompatibilityPDFExporter } from './js/pdfExportAdjustments.js';

const exporter = new CompatibilityPDFExporter('#your-container');
await exporter.generate(); // replace with your trigger
```

## Automated Tests

Run the test suite with Node's built-in runner:

```bash
npm test
```

This command executes all files under `test/` using `node --test`.

## Environment Configuration

Runtime settings are loaded from a `.env` file. Copy `.env.example` to `.env`
and adjust as needed:

- `PORT` – Port number to listen on.
- `SESSION_IDLE_TIMEOUT` – Time in ms before an idle session expires.
- `SESSION_MAX_LIFETIME` – Maximum lifetime of a session in ms.
- `TOKEN_EXPIRATION_MS` – Time in ms before a token expires.
- `COOKIE_DOMAIN` – Optional domain attribute for cookies.
- `NODE_ENV` – Set to `production` to disable debug routes and HTTPS fallbacks.

Optional values include `TLS_KEY_PATH` and `TLS_CERT_PATH` for local HTTPS and
`DEBUG_SECRET` to protect debug routes in production.

## One-Time Token Login

Some development features use a one-time token that is bound to your current
IP address. After you authenticate, the server remembers your session until you
close the browser or the session expires.

### Generate a Token

Start the server (for example, `npm start`) in another terminal and request a token:

```bash
npm run generate-token
```

The script calls the running server's `/admin/generate-token` endpoint so the
token is registered for your IP address. Copy the printed token and share it
only through secure channels.

### Log In

Open the server URL in your browser and enter the token on the login page.
Once accepted, the token is tied to your IP and you will remain logged in for
the duration of that session.

### Caveats

- Tokens are single-use. Generate a new token whenever you need to log in
  again.
- If your IP address changes, the server will reject the token and you must
  authenticate with a new one.
- Treat tokens like passwords; never share them publicly or commit them to
  source control.

## Troubleshooting

If you encounter a browser warning that the site is not secure or it reports an invalid response, verify that your DNS records point to GitHub. After the records have propagated, enable **Enforce HTTPS** in the Pages settings so GitHub can serve a valid certificate.

### Resolving `ERR_SSL_PROTOCOL_ERROR`
If your browser shows “www.talkkink.org sent an invalid response” or `ERR_SSL_PROTOCOL_ERROR`, follow these steps:
1. Confirm the `www` DNS record points to the GitHub IP addresses or uses a CNAME to your GitHub Pages domain.
2. In the repository’s **Settings** → **Pages** section, set `www.talkkink.org` as the custom domain (if not already) and enable **Enforce HTTPS**.
3. Wait a few minutes for GitHub to issue the SSL certificate. Once done, refresh https://www.talkkink.org and the warning should disappear.
