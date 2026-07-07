'use strict';

// In-memory store with optional JSON-file persistence.
//
//   - dbFile set   -> loads/persists to that file (local dev, Docker, VPS).
//   - dbFile null  -> pure in-memory, seeded on boot (Vercel serverless, where
//                     the filesystem is read-only). Data resets on cold start;
//                     use the KV store (store-kv.js) for durable serverless.
//
// The initial leaderboard is passed in as `seed` (an array of {username,
// highScore}) so it's bundled with the code and available everywhere.

const fs = require('fs');
const path = require('path');

class Store {
  constructor({ dbFile = null, seed = [] } = {}) {
    this.dbFile = dbFile;
    this.seed = seed;
    // users keyed by lowercased username (case-insensitive uniqueness),
    // value: { username, passwordHash|null, wallet, highScore, createdAt }
    this.users = new Map();
    this._load();
  }

  _load() {
    if (this.dbFile && fs.existsSync(this.dbFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.dbFile, 'utf8'));
        for (const u of raw.users || []) this.users.set(u.username.toLowerCase(), u);
        return;
      } catch (e) {
        console.error('[store] could not read db file, starting from seed:', e.message);
      }
    }
    this._seed();
    this._persist();
  }

  // Seed the initial leaderboard from the captured production data so a fresh
  // deploy shows the same board. Seed entries have no password (passwordHash:
  // null) — they exist for the leaderboard and cannot be signed into.
  _seed() {
    for (const e of this.seed) {
      if (typeof e.username !== 'string') continue;
      const key = e.username.toLowerCase();
      if (this.users.has(key)) continue;
      this.users.set(key, {
        username: e.username,
        passwordHash: null,
        wallet: '',
        highScore: Number(e.highScore) || 0,
        createdAt: 0,
      });
    }
  }

  _persist() {
    if (!this.dbFile) return; // memory-only mode
    const tmp = `${this.dbFile}.tmp`;
    const data = JSON.stringify({ users: [...this.users.values()] });
    fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.dbFile);
  }

  getUser(username) {
    return this.users.get(String(username).toLowerCase()) || null;
  }

  createUser({ username, passwordHash, wallet, createdAt }) {
    const user = { username, passwordHash, wallet, highScore: 0, createdAt };
    this.users.set(username.toLowerCase(), user);
    this._persist();
    return user;
  }

  updateWallet(username, wallet) {
    const user = this.getUser(username);
    if (!user) return null;
    user.wallet = wallet;
    this._persist();
    return user;
  }

  // Scores only ever move up — the leaderboard tracks each player's best.
  submitScore(username, score) {
    const user = this.getUser(username);
    if (!user) return null;
    if (score > user.highScore) {
      user.highScore = score;
      this._persist();
    }
    return user;
  }

  leaderboard() {
    return [...this.users.values()]
      .sort((a, b) => b.highScore - a.highScore)
      .map((u) => ({ username: u.username, highScore: u.highScore }));
  }
}

module.exports = { Store };
