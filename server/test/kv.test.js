'use strict';

// Verifies the serverless code path: the async KV store driving the real Express
// routes. Uses an in-process fake of the Upstash Redis client (only the methods
// the store uses), so no real Redis is needed.

const { KvStore } = require('../src/store-kv');
const { createApp } = require('../src/app');
const seed = require('../data/seed-leaderboard.json');

// --- fake Upstash Redis client --------------------------------------------
class FakeRedis {
  constructor() { this.kv = new Map(); this.z = new Map(); } // z: key -> Map(member->score)
  async get(k) { return this.kv.has(k) ? this.kv.get(k) : null; }
  async set(k, v) { this.kv.set(k, v); return 'OK'; }
  async exists(k) { return this.kv.has(k) ? 1 : 0; }
  async zadd(k, { score, member }) {
    if (!this.z.has(k)) this.z.set(k, new Map());
    this.z.get(k).set(member, score);
    return 1;
  }
  async zrange(k, _start, _stop, opts = {}) {
    const m = this.z.get(k) || new Map();
    let arr = [...m.entries()].sort((a, b) => (opts.rev ? b[1] - a[1] : a[1] - b[1]));
    const out = [];
    for (const [member, score] of arr) {
      out.push(member);
      if (opts.withScores) out.push(score);
    }
    return out;
  }
}

let passed = 0, failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
};

const WALLET = 'So11111111111111111111111111111111111111112';

(async () => {
  const store = new KvStore({ redis: new FakeRedis(), seed });
  const app = createApp(store);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body, token) => fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });

  try {
    let r = await fetch(base + '/api/leaderboard');
    const board = await r.json();
    check('KV: leaderboard seeded (110)', Array.isArray(board) && board.length === 110);
    check('KV: leaderboard sorted desc', board.every((e, i) => i === 0 || board[i - 1].highScore >= e.highScore));
    check('KV: top seeded player is wursti88', board[0].username === 'wursti88' && board[0].highScore === 257814);

    r = await post('/api/signup', { username: 'kvuser', password: 'secret6', wallet: WALLET });
    const su = await r.json();
    check('KV: signup -> 201 with token', r.status === 201 && typeof su.token === 'string');

    r = await post('/api/signup', { username: 'kvuser', password: 'secret6', wallet: WALLET });
    check('KV: duplicate signup -> 409', r.status === 409);

    r = await post('/api/signin', { username: 'kvuser', password: 'nope' });
    check('KV: bad signin -> 401', r.status === 401);
    r = await post('/api/signin', { username: 'kvuser', password: 'secret6' });
    const si = await r.json();
    check('KV: signin -> token', r.status === 200 && typeof si.token === 'string');

    r = await post('/api/score', { score: 200000 }, si.token);
    check('KV: score -> {highScore:200000}', r.status === 200 && (await r.json()).highScore === 200000);
    r = await post('/api/score', { score: 1 }, si.token);
    check('KV: lower score ignored', (await r.json()).highScore === 200000);

    r = await fetch(base + '/api/leaderboard');
    const board2 = await r.json();
    const me = board2.find((e) => e.username === 'kvuser');
    check('KV: player on leaderboard at rank 2', me && me.highScore === 200000 && board2.indexOf(me) === 1);
    check('KV: leaderboard grew to 111', board2.length === 111);
  } finally {
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
