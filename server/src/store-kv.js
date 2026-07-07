'use strict';

// Durable store backed by Redis (Upstash / Vercel KV) for serverless
// deployments where the filesystem is read-only and instances are ephemeral.
// Same interface as the file store, but methods are async.
//
// Data model:
//   bullrun:user:<lowername>  -> JSON of { username, passwordHash, wallet, highScore, createdAt }
//   bullrun:lb                -> sorted set, member=username, score=highScore
//   bullrun:seeded            -> flag set once the initial leaderboard is loaded
//
// Works with any client exposing the Upstash REST methods used below
// (get/set/zadd/zrange/exists), so it can be unit-tested with a fake client.

const K_USER = (name) => `bullrun:user:${String(name).toLowerCase()}`;
const K_LB = 'bullrun:lb';
const K_SEEDED = 'bullrun:seeded';

class KvStore {
  constructor({ redis, seed = [] }) {
    this.redis = redis;
    this.seed = seed;
    this._seedPromise = null;
  }

  // Load the initial leaderboard exactly once (guarded by a Redis flag so
  // concurrent cold-started instances don't double-seed).
  async ensureSeeded() {
    if (!this._seedPromise) this._seedPromise = this._seed();
    return this._seedPromise;
  }

  async _seed() {
    const already = await this.redis.exists(K_SEEDED);
    if (already) return;
    for (const e of this.seed) {
      if (typeof e.username !== 'string') continue;
      const user = {
        username: e.username,
        passwordHash: null,
        wallet: '',
        highScore: Number(e.highScore) || 0,
        createdAt: 0,
      };
      await this.redis.set(K_USER(e.username), JSON.stringify(user));
      await this.redis.zadd(K_LB, { score: user.highScore, member: e.username });
    }
    await this.redis.set(K_SEEDED, '1');
  }

  async getUser(username) {
    await this.ensureSeeded();
    const raw = await this.redis.get(K_USER(username));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw; // some clients auto-parse
  }

  async createUser({ username, passwordHash, wallet, createdAt }) {
    await this.ensureSeeded();
    const user = { username, passwordHash, wallet, highScore: 0, createdAt };
    await this.redis.set(K_USER(username), JSON.stringify(user));
    await this.redis.zadd(K_LB, { score: 0, member: username });
    return user;
  }

  async updateWallet(username, wallet) {
    const user = await this.getUser(username);
    if (!user) return null;
    user.wallet = wallet;
    await this.redis.set(K_USER(username), JSON.stringify(user));
    return user;
  }

  async submitScore(username, score) {
    const user = await this.getUser(username);
    if (!user) return null;
    if (score > user.highScore) {
      user.highScore = score;
      await this.redis.set(K_USER(username), JSON.stringify(user));
      await this.redis.zadd(K_LB, { score, member: user.username });
    }
    return user;
  }

  async leaderboard() {
    await this.ensureSeeded();
    // Highest first, with scores. Upstash returns a flat [member, score, ...].
    const flat = await this.redis.zrange(K_LB, 0, -1, { rev: true, withScores: true });
    const out = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ username: flat[i], highScore: Number(flat[i + 1]) });
    }
    return out;
  }
}

module.exports = { KvStore };
