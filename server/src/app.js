'use strict';

// Builds the Express app given a store. Routes `await` every store call, so the
// same code works with the synchronous file/memory store and the async Redis
// store. Used by the standalone server (src/index.js), the local full-stack dev
// server (dev-serve.js), and the Vercel serverless function (api/index.js).
//
// Endpoints (all under /api):
//   POST   /api/signup       { username, password, wallet } -> { username, wallet, token }
//   POST   /api/signin       { username, password }         -> { username, wallet, token }
//   PATCH  /api/wallet       { wallet }        (Bearer)      -> { username, wallet }
//   POST   /api/score        { score }         (Bearer)      -> { highScore }
//   GET    /api/leaderboard                                   -> [ { username, highScore }, ... ]
//   GET    /api/health                                        -> { ok: true }
//
// Errors: { error: "<message>" } with a non-2xx status.

const express = require('express');
const cors = require('cors');

const { hashPassword, verifyPassword, signToken, verifyToken } = require('./auth');
const { validateUsername, validatePassword, validateWallet } = require('./validate');

// Wrap async handlers so a rejected promise becomes an Express error instead of
// an unhandled rejection.
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Body parsing that works both standalone (raw stream -> express.json) and on
// serverless hosts like Vercel that may pre-populate req.body (object or string).
const jsonParser = express.json({ limit: '16kb' });
function parseBody(req, res, next) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { req.body = req.body ? JSON.parse(req.body) : {}; } catch { req.body = {}; }
    }
    return next();
  }
  jsonParser(req, res, next);
}

function createApp(store) {
  const app = express();
  app.use(cors()); // live API responds Access-Control-Allow-Origin: *
  app.use(parseBody);

  const fail = (res, status, message) => res.status(status).json({ error: message });

  async function authUser(req) {
    const header = req.get('authorization') || '';
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const payload = verifyToken(m[1]);
    if (!payload || typeof payload.sub !== 'string') return null;
    return store.getUser(payload.sub);
  }

  const router = express.Router();

  router.get('/health', (_req, res) => res.json({ ok: true }));

  router.get('/leaderboard', h(async (_req, res) => {
    res.json(await store.leaderboard());
  }));

  router.post('/signup', h(async (req, res) => {
    const { username, password, wallet } = req.body || {};
    const err = validateUsername(username) || validatePassword(password) || validateWallet(wallet);
    if (err) return fail(res, 400, err);
    if (await store.getUser(username)) return fail(res, 409, 'Username is taken');

    const user = await store.createUser({
      username,
      passwordHash: hashPassword(password),
      wallet,
      createdAt: Date.now(),
    });
    const token = signToken({ sub: user.username });
    res.status(201).json({ username: user.username, wallet: user.wallet, token });
  }));

  router.post('/signin', h(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return fail(res, 400, 'Username and password are required');
    }
    const user = await store.getUser(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail(res, 401, 'Invalid username or password');
    }
    const token = signToken({ sub: user.username });
    res.json({ username: user.username, wallet: user.wallet, token });
  }));

  router.patch('/wallet', h(async (req, res) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, 'Not signed in');
    const { wallet } = req.body || {};
    const err = validateWallet(wallet);
    if (err) return fail(res, 400, err);
    const updated = await store.updateWallet(user.username, wallet);
    res.json({ username: updated.username, wallet: updated.wallet });
  }));

  router.post('/score', h(async (req, res) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, 'Not signed in');
    const { score } = req.body || {};
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      return fail(res, 400, 'Invalid score');
    }
    const updated = await store.submitScore(user.username, Math.floor(score));
    res.json({ highScore: updated.highScore });
  }));

  app.use('/api', router);

  // JSON error handler so async failures return {error} instead of HTML.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[api] error:', err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

module.exports = { createApp };
