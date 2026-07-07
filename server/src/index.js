'use strict';

// Standalone Bull Run backend — a faithful reconstruction of the API at
// https://api.bullrunn.fun. Endpoint routing/behaviour lives in app.js; the
// store is chosen for the environment by create-store.js. See server/README.md.

const { createApp } = require('./app');
const { createStore } = require('./create-store');
const seed = require('../data/seed-leaderboard.json');

const PORT = Number(process.env.PORT) || 8787;
const store = createStore(seed);
const app = createApp(store);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[bullrun] API listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, store };
