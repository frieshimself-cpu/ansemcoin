'use strict';

// One-command local full stack. Serves the byte-exact static front-end AND the
// reconstructed API from a single origin so you can run the whole site locally
// with no DNS/hosts tricks:
//
//   node server/dev-serve.js      # then open http://localhost:5000
//
// The production front-end hard-codes the API base `https://api.bullrunn.fun`.
// For local dev we rewrite that base to empty *in memory as the bundle is
// served*, turning its calls into same-origin `/api/...` — the files on disk are
// never modified, so the mirror stays a true 1:1 copy. In production you don't
// use this: deploy the front-end to your domain and the backend to
// api.bullrunn.fun, unchanged.

const fs = require('fs');
const path = require('path');
const express = require('express');

// Requiring index builds the store and registers the /api router + CORS on
// `app` (it only calls listen() when run directly, so nothing starts here).
const { app } = require('./src/index');

const ROOT = path.join(__dirname, '..'); // repo root = static front-end
const BUNDLE = 'assets/index-e2y_TuZg.js';
const DEV_PORT = Number(process.env.DEV_PORT) || 5000;

// Serve the app bundle with the API base rewritten to same-origin.
app.get('/' + BUNDLE, (_req, res) => {
  let js = fs.readFileSync(path.join(ROOT, BUNDLE), 'utf8');
  js = js.split('https://api.bullrunn.fun').join(''); // `${au}/api${e}` -> `/api${e}`
  res.type('application/javascript').send(js);
});

// Everything else: static files, then SPA fallback to index.html.
app.use(express.static(ROOT));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(DEV_PORT, () => {
  console.log(`[bullrun] full stack (front-end + API) on http://localhost:${DEV_PORT}`);
});
