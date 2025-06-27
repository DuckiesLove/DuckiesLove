#!/usr/bin/env bash
# Simple setup script for DuckiesLove static site
set -e

echo "Preparing local development environment..."

if command -v npm >/dev/null 2>&1; then
  if ! command -v serve >/dev/null 2>&1; then
    echo "Installing 'serve' via npm so you can preview the site."
    npm install -g serve
  else
    echo "'serve' is already installed."
  fi
else
  echo "npm is not installed. If you want to use Node for local preview, install Node.js first."
fi

echo "Setup complete. You can start a local server with:\n  serve .\nOr if you have Python 3 available:\n  python3 -m http.server"
