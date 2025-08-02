# Test Coverage

Run the full suite with coverage:
```bash
npm run test:coverage
```
The command writes an HTML report to `coverage/` and prints a summary to the console.

## Feature Coverage
- **Token flow** – `test/tokenExpiry.test.js`
- **Session refresh & timeouts** – `test/session.test.js`
- **IP drift** – `test/session.test.js`
- **Rate limiting** – `test/submitTokenRateLimit.test.js`
- **Logout handling** – `test/session.test.js`
- **Debug access control** – `test/debugRoutes.test.js`

Latest run produced overall coverage of:
- Lines: 60.07%
- Statements: 62.57%
- Functions: 67.11%
