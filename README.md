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

A `CNAME` file already exists in this repository with the line `www.talkkink.org` so GitHub knows which domain to expect.

## Enforce HTTPS

After the DNS records resolve, go to the repository’s **Settings** → **Pages** section and enable **Enforce HTTPS**. This ensures all visitors are automatically redirected to the secure version of the site.

## Site Files

The website is built from the following files in this repository:

- `index.html` (main survey page linking to `/greenlight/` and other tools)
- `css/style.css`
- `js/script.js`
- `template-survey.json`

The **Start New Survey** button fetches `template-survey.json` when the page is
served over HTTP so you always start with a fresh set of kinks. If you open
`index.html` directly from your file system, the script falls back to an
embedded copy of the template.

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
stub no longer triggers a download but shows an alert explaining that PDF
generation is unavailable when viewing the files directly. Run a local web server
and select **Download Data** again so the real library loads and the PDF
downloads correctly.

## Automated Tests

Run the test suite with Node's built-in runner:

```bash
npm test
```

This command executes all files under `test/` using `node --test`.

## Troubleshooting

If you encounter a browser warning that the site is not secure or it reports an invalid response, verify that your DNS records point to GitHub. After the records have propagated, enable **Enforce HTTPS** in the Pages settings so GitHub can serve a valid certificate.

### Resolving `ERR_SSL_PROTOCOL_ERROR`
If your browser shows “www.talkkink.org sent an invalid response” or `ERR_SSL_PROTOCOL_ERROR`, follow these steps:
1. Confirm the `www` DNS record points to the GitHub IP addresses or uses a CNAME to your GitHub Pages domain.
2. In the repository’s **Settings** → **Pages** section, set `www.talkkink.org` as the custom domain (if not already) and enable **Enforce HTTPS**.
3. Wait a few minutes for GitHub to issue the SSL certificate. Once done, refresh https://www.talkkink.org and the warning should disappear.
