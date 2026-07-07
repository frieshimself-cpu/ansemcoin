'use strict';

const path = require('path');
const { Store } = require('./store');

// Picks the right store for the environment:
//   1. Redis env present (Vercel KV / Upstash)  -> durable KvStore.
//   2. On Vercel without Redis                   -> in-memory (seeded; resets on
//                                                   cold start — fine for a demo).
//   3. Otherwise (local, Docker, VPS)            -> JSON-file store at DATA_DIR.
function createStore(seed = []) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    // Lazy-require so the dependency is only needed when Redis is configured.
    const { Redis } = require('@upstash/redis');
    const { KvStore } = require('./store-kv');
    console.log('[store] using Redis (durable serverless store)');
    return new KvStore({ redis: new Redis({ url, token }), seed });
  }

  if (process.env.VERCEL) {
    console.log('[store] using in-memory store (no Redis configured — data resets on cold start)');
    return new Store({ dbFile: null, seed });
  }

  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  return new Store({ dbFile: path.join(DATA_DIR, 'db.json'), seed });
}

module.exports = { createStore };
