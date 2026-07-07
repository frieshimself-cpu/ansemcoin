'use strict';

// End-to-end smoke test for the reconstructed backend. Boots the real Express
// app against a throwaway data dir (seeded from the captured leaderboard) and
// drives the full flow the front-end uses: signup -> signin -> wallet -> score
// -> leaderboard, plus the validation/auth error paths.

const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bullrun-test-'));
fs.copyFileSync(
  path.join(__dirname, '..', 'data', 'seed-leaderboard.json'),
  path.join(tmp, 'seed-leaderboard.json')
);
process.env.DATA_DIR = tmp;
process.env.JWT_SECRET = 'test-secret';

const { app } = require('../src/index');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL ' + name);
  }
}

const WALLET = 'So11111111111111111111111111111111111111112';
const WALLET2 = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

(async () => {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = (p, opts) => fetch(base + p, opts);
  const json = (body, token) => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });

  try {
    // health
    let r = await api('/api/health');
    check('GET /api/health -> {ok:true}', r.status === 200 && (await r.json()).ok === true);

    // seeded leaderboard
    r = await api('/api/leaderboard');
    const board0 = await r.json();
    check('leaderboard seeded (110 entries)', Array.isArray(board0) && board0.length === 110);
    check(
      'leaderboard sorted desc by highScore',
      board0.every((e, i) => i === 0 || board0[i - 1].highScore >= e.highScore)
    );
    check(
      'leaderboard entries shaped {username, highScore}',
      board0.every((e) => typeof e.username === 'string' && typeof e.highScore === 'number')
    );

    // signup validation
    r = await api('/api/signup', json({ username: 'ab', password: 'secret6', wallet: WALLET }));
    check('signup rejects short username (400)', r.status === 400);
    r = await api('/api/signup', json({ username: 'gooduser', password: '123', wallet: WALLET }));
    check('signup rejects short password (400)', r.status === 400);
    r = await api('/api/signup', json({ username: 'gooduser', password: 'secret6', wallet: 'nope' }));
    check('signup rejects bad wallet (400)', r.status === 400);

    // signup success
    r = await api('/api/signup', json({ username: 'claude_test', password: 'secret6', wallet: WALLET }));
    const signup = await r.json();
    check('signup ok -> {username, wallet, token}', r.status === 201 && signup.username === 'claude_test' && signup.wallet === WALLET && typeof signup.token === 'string');

    // duplicate signup
    r = await api('/api/signup', json({ username: 'claude_test', password: 'secret6', wallet: WALLET }));
    check('duplicate signup -> 409 {error}', r.status === 409 && typeof (await r.json()).error === 'string');

    // signin wrong / right
    r = await api('/api/signin', json({ username: 'claude_test', password: 'wrongpw' }));
    check('signin wrong password -> 401', r.status === 401);
    r = await api('/api/signin', json({ username: 'CLAUDE_TEST', password: 'secret6' }));
    const signin = await r.json();
    check('signin ok (case-insensitive) -> token', r.status === 200 && typeof signin.token === 'string');
    const token = signin.token;

    // wallet update
    r = await api('/api/wallet', { ...json({ wallet: WALLET2 }, token), method: 'PATCH' });
    const walletRes = await r.json();
    check('PATCH /api/wallet -> updated', r.status === 200 && walletRes.wallet === WALLET2);
    r = await api('/api/wallet', { ...json({ wallet: WALLET2 }), method: 'PATCH' });
    check('PATCH /api/wallet without token -> 401', r.status === 401);

    // score submit (only moves up)
    r = await api('/api/score', json({ score: 50000 }, token));
    check('POST /api/score -> {highScore:50000}', r.status === 200 && (await r.json()).highScore === 50000);
    r = await api('/api/score', json({ score: 10 }, token));
    check('lower score does not lower highScore', r.status === 200 && (await r.json()).highScore === 50000);
    r = await api('/api/score', json({ score: 99999 }, token));
    check('higher score raises highScore', r.status === 200 && (await r.json()).highScore === 99999);
    r = await api('/api/score', json({ score: 5 }));
    check('POST /api/score without token -> 401', r.status === 401);
    r = await api('/api/score', json({ score: 'lol' }, token));
    check('POST /api/score invalid body -> 400', r.status === 400);

    // leaderboard reflects new player
    r = await api('/api/leaderboard');
    const board1 = await r.json();
    const me = board1.find((e) => e.username === 'claude_test');
    check('leaderboard includes new player with score', me && me.highScore === 99999);
    check('leaderboard grew by one (111)', board1.length === 111);

    // unknown route -> express default 404
    r = await api('/api/does-not-exist');
    check('unknown route -> 404', r.status === 404);
  } finally {
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
