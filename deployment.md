# Token Auth Server

## Overview
This project provides a small Express-based authentication server that issues one-time login tokens and maintains short-lived sessions. Tokens are bound to the client's IP address and expire after a configurable time. Sessions refresh on activity and enforce idle and absolute lifetimes.

## Architecture
- **Express app** exposes JSON endpoints and serves optional dashboard pages from `protected/`.
- **In-memory stores** track issued tokens, active sessions and token submission attempts.
- **Cleanup task** periodically purges expired tokens, sessions and rate limit counters.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust values:
   - `PORT` – HTTP/HTTPS port.
   - `SESSION_IDLE_TIMEOUT` – milliseconds before an idle session expires.
   - `SESSION_MAX_LIFETIME` – absolute session lifetime.
   - `TOKEN_EXPIRATION_MS` – token validity window.
   - `COOKIE_DOMAIN` – optional cookie domain.
   - `NODE_ENV` – set to `production` to disable debug routes and HTTPS fallbacks.
   - Optional `TLS_KEY_PATH` and `TLS_CERT_PATH` for local HTTPS.
   - Optional `DEBUG_SECRET` to protect debug routes in production.
3. Start the server:
   ```bash
   npm start
   ```

### HTTPS
If `NODE_ENV` is not `production` the server tries to load certificates from `TLS_KEY_PATH` and `TLS_CERT_PATH`; otherwise it falls back to HTTP. In production, run behind a reverse proxy or supply valid certificates.

## Token Generation Workflow
### CLI
Generate a token locally:
```bash
npm run generate-token
```
### HTTP API
Request a token tied to your IP:
```bash
curl -X POST https://server/admin/generate-token
```
Both methods return a hex token and expiration timestamp.

## Validation and Sessions
1. Submit the token via `POST /submit-token`.
2. Server verifies IP match and token freshness.
3. On success a `session_id` cookie is set and the token is marked used.
4. Each request through `validateSession` refreshes the idle timeout.
5. Sessions allow a single IP change; further changes invalidate the session.
6. Tokens and sessions are purged once expired.

## Debug Routes
- `/debug/tokens` and `/debug/sessions` list current stores.
- Available when `NODE_ENV` ≠ `production`.
- In production they require an `x-debug-secret` header that matches `DEBUG_SECRET`.

## Deployment Tips
- Always serve over HTTPS and set the `Secure` flag on cookies.
- Run with `NODE_ENV=production` to disable dev-only routes and HTTP fallback.
- Rotate tokens frequently and transmit them over secure channels only.
- For container deployments see the provided `Dockerfile`, `.dockerignore` and optional `Procfile`.
