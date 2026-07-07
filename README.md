# Bull Run — site recovery (bullrunn.fun)

A complete, 1:1 static copy of the live website served at **https://bullrunn.fun/**,
captured on **2026-07-07**. Every file the live site serves to the browser is
mirrored here byte-for-byte, so this repo can be re-deployed to reproduce the site
exactly.

The homepage was verified end-to-end in a headless Chromium browser: it boots, the
React app mounts, and all 40 assets below load successfully. The rendered result is
identical to the live site (the "BULL RUN" landing page with the mascot, nav,
social buttons and Buy Now button).

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

To put it back on your own domain, point the domain at the deployment above.

## External dependencies (the same ones the original uses)

These are referenced by the build and load at runtime — they are **not** files in this
repo, exactly as on the live site:

- **Google Fonts** — `Luckiest Guy` + `Fredoka`, loaded from `fonts.googleapis.com`
  (baked into the CSS bundle). Works on any normal deployment with internet access.
- **Backend API** — the app calls **`https://api.bullrunn.fun/api/...`** for the
  interactive features: `/leaderboard`, `/score`, `/memes`, `/wallet`. This is a
  separate server-side service. The static front-end here is complete, but those
  live features need that backend (or a replacement pointing at the same API base)
  to be running.

Outbound links baked into the site: `pump.fun/coin/…`, `dexscreener.com/solana/…`,
`x.com/…`, and a source reference at `github.com/blackbullrun/The-Bull-Run`.

## Notes

- `index.html` here is confirmed byte-identical to what `https://bullrunn.fun/` serves.
- The JS/CSS in `assets/` are the shipped **production build** (minified/bundled). If
  you want the original un-minified React/TypeScript source (components, Vite config,
  etc.), that is not derivable from the deployed bundle — check the referenced
  `github.com/blackbullrun/The-Bull-Run` repository for it if it is the upstream source.
