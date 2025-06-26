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
