'use strict';

// Bull Run backend — a faithful reconstruction of the API served at
// https://api.bullrunn.fun. Endpoints, request bodies, response shapes, auth
// and error format were recovered from the production front-end bundle and the
// live API's observed behaviour, so the byte-exact front-end talks to this
// server unchanged.
//
// Endpoints (all under /api):
//   POST   /api/signup       { username, password, wallet } -> { username, wallet, token }
//   POST   /api/signin       { username, password }         -> { username, wallet, token }
//   PATCH  /api/wallet       { wallet }        (Bearer)      -> { username, wallet }
//   POST   /api/score        { score }         (Bearer)      -> { highScore }
//   GET    /api/leaderboard                                   -> [ { username, highScore }, ... ]
//   GET    /api/health                                        -> { ok: true }
//
// Errors are returned as { error: "<message>" } with a non-2xx status, matching
// what the front-end fetch wrapper expects.

const path = require('path');
const express = require('express');
const cors = require('cors');

const { Store } = require('./store');
const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} = require('./auth');
const {
  validateUsername,
  validatePassword,
  validateWallet,
} = require('./validate');

const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
// Seed file is separate from DATA_DIR so the initial leaderboard survives even
// when DATA_DIR is an empty mounted volume (e.g. in Docker).
const SEED_FILE = process.env.SEED_FILE || path.join(DATA_DIR, 'seed-leaderboard.json');
const store = new Store({
  dbFile: path.join(DATA_DIR, 'db.json'),
  seedFile: SEED_FILE,
});

const app = express();
// Leave Express's default `X-Powered-By: Express` header in place — the live
// server sends it too.
app.use(cors()); // live API responds Access-Control-Allow-Origin: *
app.use(express.json({ limit: '16kb' }));

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

// Pull the user from a Bearer token; returns the stored user record or null.
function authUser(req) {
  const header = req.get('authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = verifyToken(m[1]);
  if (!payload || typeof payload.sub !== 'string') return null;
  return store.getUser(payload.sub);
}

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

router.get('/leaderboard', (_req, res) => res.json(store.leaderboard()));

router.post('/signup', (req, res) => {
  const { username, password, wallet } = req.body || {};
  const err =
    validateUsername(username) ||
    validatePassword(password) ||
    validateWallet(wallet);
  if (err) return fail(res, 400, err);
  if (store.getUser(username)) return fail(res, 409, 'Username is taken');

  const user = store.createUser({
    username,
    passwordHash: hashPassword(password),
    wallet,
    createdAt: Date.now(),
  });
  const token = signToken({ sub: user.username });
  return res.status(201).json({ username: user.username, wallet: user.wallet, token });
});

router.post('/signin', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return fail(res, 400, 'Username and password are required');
  }
  const user = store.getUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return fail(res, 401, 'Invalid username or password');
  }
  const token = signToken({ sub: user.username });
  return res.json({ username: user.username, wallet: user.wallet, token });
});

router.patch('/wallet', (req, res) => {
  const user = authUser(req);
  if (!user) return fail(res, 401, 'Not signed in');
  const { wallet } = req.body || {};
  const err = validateWallet(wallet);
  if (err) return fail(res, 400, err);
  const updated = store.updateWallet(user.username, wallet);
  return res.json({ username: updated.username, wallet: updated.wallet });
});

router.post('/score', (req, res) => {
  const user = authUser(req);
  if (!user) return fail(res, 401, 'Not signed in');
  const { score } = req.body || {};
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return fail(res, 400, 'Invalid score');
  }
  const updated = store.submitScore(user.username, Math.floor(score));
  return res.json({ highScore: updated.highScore });
});

app.use('/api', router);

// Anything else falls through to Express's default 404 ("Cannot GET ..."),
// matching the live server.

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[bullrun] API listening on http://localhost:${PORT}`);
    console.log(`[bullrun] data dir: ${DATA_DIR}`);
  });
}

module.exports = { app, store };
