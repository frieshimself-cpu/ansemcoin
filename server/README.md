# Bull Run — backend (`api.bullrunn.fun`)

A faithful reconstruction of the API that powers the Bull Run site. The original
backend's source was not public, so this was rebuilt from its **observed
behaviour** and the **exact contract** extracted from the production front-end
bundle: every endpoint, request body, response shape, the Bearer-token auth, the
`{error}` error format, and the validation rules all match what the site expects.
The byte-exact front-end in the repo root talks to this server **unchanged**.

Runs on Node with just `express` + `cors` — auth (scrypt password hashing +
HS256 tokens) uses only Node's built-in `crypto`, so there are no native modules
to build and it installs anywhere.

## API

Base path `/api` (production: `https://api.bullrunn.fun`). Errors come back as
`{ "error": "message" }` with a non-2xx status.

| Method | Path               | Auth   | Body                            | Response                          |
|--------|--------------------|--------|---------------------------------|-----------------------------------|
| POST   | `/api/signup`      | —      | `{username, password, wallet}`  | `{username, wallet, token}`       |
| POST   | `/api/signin`      | —      | `{username, password}`          | `{username, wallet, token}`       |
| PATCH  | `/api/wallet`      | Bearer | `{wallet}`                      | `{username, wallet}`              |
| POST   | `/api/score`       | Bearer | `{score}`                       | `{highScore}`                     |
| GET    | `/api/leaderboard` | —      | —                               | `[{username, highScore}, …]` desc |
| GET    | `/api/health`      | —      | —                               | `{ok: true}`                      |

Validation (identical to the front-end): username 3–16 chars `[a-zA-Z0-9_]`;
password ≥ 6 chars; wallet a Solana base58 address `[1-9A-HJ-NP-Za-km-z]{26,48}`.
A player's `highScore` only ever moves up. The client stores `{username, wallet,
token}` in `localStorage` under `bullrun-profile`.

## Run

```bash
cd server
npm install
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))") npm start
# API on http://localhost:8787
npm test          # 21-check end-to-end smoke test
```

The database is a JSON file at `data/db.json` (git-ignored, created on first run).
It is **seeded from `data/seed-leaderboard.json`** — the real leaderboard captured
from the live API (110 players) — so a fresh deploy shows the same board. Seed
players have no password and exist only for the leaderboard.

## Run the whole site locally (front-end + API, one command)

```bash
cd server && npm install
node dev-serve.js     # http://localhost:5000  — full working site
```

This serves the static front-end and the API from one origin (details in
`dev-serve.js`); the on-disk front-end files are never modified.

## Deploy (production 1:1)

Deploy this server to **`api.bullrunn.fun`** and the static front-end (repo root)
to **`bullrunn.fun`**. Because the front-end hard-codes the `api.bullrunn.fun`
base, nothing in the front-end needs to change — the two halves reconnect exactly
as before. Set a strong `JWT_SECRET`, run `npm start` behind a process manager
(pm2/systemd) with nginx terminating TLS and proxying to `PORT`, exactly like the
original (`Server: nginx`, `X-Powered-By: Express`).

## Configuration

See `.env.example`: `PORT`, `JWT_SECRET` (required in production), `DATA_DIR`.
