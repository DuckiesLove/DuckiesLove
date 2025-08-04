// Request a one-time token from the running auth server so that the
// generated token is stored in the server's in-memory token store. The
// previous implementation simply printed a random token which the server
// would reject as "Invalid token" because it was never registered.

const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

try {
  const res = await fetch(`${baseUrl}/admin/generate-token`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Server responded with ${res.status}`);
  }
  const data = await res.json();
  console.log(data.token);
} catch (err) {
  console.error(`Failed to generate token: ${err.message}`);
  process.exit(1);
}
