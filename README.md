# Talk Kink GitHub Pages

This repository hosts the static files for the Talk Kink website.

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

- `index.html`
- `css/style.css`
- `js/script.js`
- `template-survey.json`

## Setup

Run `setup.sh` to install optional tools for local development. The script
installs the Node `serve` package when `npm` is available so you can preview
the site locally.

## Password Gate

When the site loads, a password prompt now appears before any content is shown.
The expected password hash is defined in `js/login.js`. Update that file to
change the required password.

### Changing the Password

The `PASSWORD_HASH` constant stores the SHA-256 hash of the accepted password.
To generate a new hash with Node.js run:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('NEWPASS').digest('hex'))"
```

Replace `NEWPASS` with your desired password and copy the resulting hash into
`js/login.js`. You may need to clear your browser's local storage after
updating the hash so the login prompt appears again.

### Sidebar Visibility

The sidebar is hidden until a survey is loaded. Click **Start New Survey** or
upload an existing survey file and the sidebar with categories will appear.

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
