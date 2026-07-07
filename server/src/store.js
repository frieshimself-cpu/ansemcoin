'use strict';

// A tiny JSON-file-backed store. Keeps the whole dataset in memory and persists
// synchronously (atomic tmp-file + rename) on every mutation. This is plenty for
// a leaderboard-style workload and keeps the backend dependency-free — swap in a
// real database here if the site grows.

const fs = require('fs');
const path = require('path');

class Store {
  constructor({ dbFile, seedFile }) {
    this.dbFile = dbFile;
    this.seedFile = seedFile;
    // users keyed by lowercased username (case-insensitive uniqueness),
    // value: { username, passwordHash|null, wallet, highScore, createdAt }
    this.users = new Map();
    this._load();
  }

  _load() {
    if (fs.existsSync(this.dbFile)) {
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
    if (!this.seedFile || !fs.existsSync(this.seedFile)) return;
    try {
      const entries = JSON.parse(fs.readFileSync(this.seedFile, 'utf8'));
      for (const e of entries) {
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
    } catch (e) {
      console.error('[store] seed failed:', e.message);
    }
  }

  _persist() {
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
    const key = username.toLowerCase();
    const user = { username, passwordHash, wallet, highScore: 0, createdAt };
    this.users.set(key, user);
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
