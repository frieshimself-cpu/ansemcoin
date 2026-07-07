// Vercel serverless entrypoint for the Bull Run API.
//
// This catch-all handles every /api/* request and runs the same Express app the
// standalone server uses. The store is chosen automatically (create-store.js):
// with Vercel KV / Upstash Redis env vars it's durable; without them it's an
// in-memory store seeded with the real leaderboard (works with zero setup, but
// resets on cold start).

const { createApp } = require('../server/src/app');
const { createStore } = require('../server/src/create-store');
const seed = require('../server/data/seed-leaderboard.json');

module.exports = createApp(createStore(seed));
