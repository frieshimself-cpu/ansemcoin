# Deploy to Vercel (single-player, zero setup)

The whole site — front-end + the API — runs on Vercel with **no database and no
configuration**. The game plays, you can create an account and post scores, and
the leaderboard shows the real 110 players it shipped with. This is "single
player": scores live in the serverless function's memory and reset when it goes
cold. That's fine for playing the game — no multiplayer backend to run.

## Deploy it (about 2 minutes)

1. Go to **https://vercel.com/new**.
2. **Import** the GitHub repo `frieshimself-cpu/ansemcoin`
   (authorize Vercel with GitHub if it asks — first time only).
3. Leave every setting at its default — Framework: **Other**, no build command,
   no root-directory change. Click **Deploy**.
4. Done. Vercel gives you a live URL like `ansemcoin.vercel.app`.

That's the entire process. `vercel.json` and the `api/` function are already in
the repo, so Vercel serves the static site and runs the API automatically.

### Optional: set a JWT secret

Accounts work out of the box with a built-in dev secret. To harden them, add one
env var in **Project → Settings → Environment Variables**, then redeploy:

```
JWT_SECRET = <a long random string>
```

Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Put it on your own domain

**Project → Settings → Domains → Add** `bullrunn.fun` and follow Vercel's DNS
instructions at your registrar. The site works the same on the custom domain.

---

## Optional upgrade: durable, shared leaderboard

Only if you later want scores to persist and be shared across everyone (i.e. a
real multiplayer leaderboard): add a Redis store and the API switches to it
automatically — no code change.

1. **Project → Storage → Create** → Upstash Redis (or Vercel KV) → connect it.
   Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or the `UPSTASH_*`
   equivalents).
2. Redeploy. That's it — the backend detects the env vars and uses Redis.

You don't need this for single-player.
