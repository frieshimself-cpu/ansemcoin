# Bull Run — full site recovery (bullrunn.fun)

A complete, 1:1 recovery of the Bull Run site — **front-end and back-end** —
captured on **2026-07-07**.

- **Front-end** (repo root): every file the live site at **https://bullrunn.fun/**
  serves to the browser, mirrored byte-for-byte.
- **Back-end** (`server/`): a faithful reconstruction of the API at
  **https://api.bullrunn.fun** (accounts, leaderboard, score submission), rebuilt
  from the exact contract the front-end uses. The original backend source was not
  public, so it was reconstructed and verified against the real front-end.

Verified end-to-end in a headless browser: the site boots, the React app mounts,
all 40 assets load, and the **real front-end drives the reconstructed backend** —
sign-up, session persistence, score submission, and the live-seeded leaderboard
all work (a newly created player ranks correctly among the real data).

Run the whole thing locally with one command:

```bash
cd server && npm install && node dev-serve.js   # http://localhost:5000
```

Deploy the whole thing (front-end + API) with one command:

```bash
./deploy.sh    # Docker; generates a secret, builds, serves on port 80
```

See **[`deploy/DEPLOY.md`](deploy/DEPLOY.md)** for the full guide (Docker one-liner,
or the original bare-metal `bullrunn.fun` + `api.bullrunn.fun` two-domain layout).

## The two halves

| Part      | Location  | What it is                                                        |
|-----------|-----------|-------------------------------------------------------------------|
| Front-end | repo root | Byte-exact production build of `bullrunn.fun` (static SPA)         |
| Back-end  | `server/` | Reconstructed `api.bullrunn.fun` API (Node/Express), see `server/README.md` |

In production the two deploy to their two domains and reconnect unchanged
(the front-end hard-codes the `api.bullrunn.fun` base). See **Deploy it** below.

---

## Front-end

## What this is

`bullrunn.fun` is a Vite-built single-page app (React). The production build ships a
single JS bundle + CSS bundle plus a set of static images and sounds. This repo is
that production build, mirrored exactly:

```
index.html                     # entry point (byte-identical to live)
assets/
  index-e2y_TuZg.js            # app bundle (production build, minified)
  index-DWdqRevs.css           # styles bundle
bull.png  lighttext.png text.png  origin.png  herobg.png  dex.webp  lightbg.jpeg
archive/   alon.jpg ansem.png chillguy.png chud.png fartcoin.png jotchua.png
           memes.png pepe.png pnut.jpg pumpfun.png rainbow.png unc.png wif.png
bg/        sky_sunset.png
frames/    gold.png horizontal.png small.png square.png
tex/       canal_wall.png cliff_rock.png path_stone.png tunnel_rock.png water.png wood.png
sounds/    sound1.mp3 … sound8.mp3
```

Host-config helpers (not served to the browser):

```
_redirects        # Netlify SPA fallback
vercel.json       # Vercel SPA rewrite
package.json      # local static-server script
.gitignore
```

## Run it locally

```bash
npx serve -s . -l 5173
# then open http://localhost:5173
```

`-s` (single-page mode) makes the server fall back to `index.html`, which the app's
client-side routing needs. Any static server works as long as it does that fallback;
for a quick look at just the homepage, even `python3 -m http.server` is enough.

## Deploy it

This is a plain static site. Upload the repo root to any static host. The only
requirement is an **SPA fallback**: unmatched routes must serve `/index.html` (real
files under `/assets`, `/tex`, etc. are served normally). The included configs handle
this automatically:

- **Netlify** — drag-and-drop the folder, or connect the repo. `_redirects` is picked up.
- **Vercel** — import the repo. `vercel.json` provides the rewrite.
- **Cloudflare Pages / GitHub Pages / S3+CloudFront** — set the SPA/404 fallback to
  `index.html`.

To put it back on your own domain, point the domain at the deployment above, and
deploy the backend (below) to `api.bullrunn.fun`.

---

## Back-end

The `server/` directory is a full reconstruction of the API at
**`https://api.bullrunn.fun`** — accounts (sign up / sign in), the leaderboard,
wallet updates, and score submission. See **`server/README.md`** for the complete
endpoint reference. It's a small Node/Express app with no native dependencies.

```bash
cd server
npm install
npm test              # 21-check end-to-end smoke test
node dev-serve.js     # runs the WHOLE site (front-end + API) at http://localhost:5000
```

It ships **seeded with the real leaderboard** (110 players captured from the live
API, in `server/data/seed-leaderboard.json`), so a fresh deploy shows the same
board. The front-end talks to it unchanged.

### Deploy the full stack (production 1:1)

Deploy the two halves to their two domains and they reconnect exactly as before —
no front-end changes, because the front-end hard-codes the `api.bullrunn.fun` base:

1. **Front-end** → `bullrunn.fun` (any static host, per **Deploy it** above).
2. **Back-end** → `api.bullrunn.fun` (`npm start` behind pm2/systemd, nginx
   terminating TLS and proxying to `PORT`; set a strong `JWT_SECRET`).

## External dependencies (the same ones the original uses)

- **Google Fonts** — `Luckiest Guy` + `Fredoka`, loaded from `fonts.googleapis.com`
  (baked into the CSS bundle). Works on any normal deployment with internet access.

Outbound links baked into the site: `pump.fun/coin/…`, `dexscreener.com/solana/…`,
`x.com/…`, and a source reference at `github.com/blackbullrun/The-Bull-Run`.

## Notes

- `index.html` here is confirmed byte-identical to what `https://bullrunn.fun/` serves.
- The front-end JS/CSS in `assets/` are the shipped **production build**
  (minified/bundled) — that is what makes it a true 1:1 of the live site. The
  original un-minified React/TypeScript source isn't derivable from a bundle; an
  **earlier** version of that source is public at
  `github.com/blackbullrun/The-Bull-Run` (it predates the backend/leaderboard, so
  it doesn't match the current deployment — use it only as an editing starting point).
- The back-end was reconstructed from the front-end's API contract and the live
  API's behaviour (the original server source was not public), then verified
  end-to-end against the real front-end.
