# Deploying Bull Run

Two ways to put the full site (front-end + reconstructed API) online. Both are
turnkey. Pick one.

---

## Option A — Docker, one command (recommended)

Everything runs on **one domain / one certificate**. On any machine with Docker:

```bash
git clone <this repo> && cd <repo>
./deploy.sh
```

`deploy.sh` generates a `JWT_SECRET`, builds the images, starts the stack, and
waits for the health check. The site is then served on port 80. Accounts, the
leaderboard, and score submission all work (the front-end's `api.bullrunn.fun`
calls are transparently served by the backend on the same origin).

To make it public on your domain:

1. Point the domain's DNS **A record** at the server's IP.
2. Put TLS in front. Easiest is a reverse proxy that auto-provisions certs
   (e.g. Caddy), or run certbot on the host and proxy to `WEB_PORT`.

Manage it:

```bash
docker compose logs -f          # logs
docker compose down             # stop
docker compose up -d --build    # update after a code change
```

Data (accounts, scores) persists in the `bullrun-data` Docker volume.

---

## Option B — bare metal (the original two-domain layout)

Reproduces exactly how the live site was set up: **front-end on `bullrunn.fun`,
API on `api.bullrunn.fun`**, nginx + Node, no Docker.

```bash
# 1. Backend
sudo mkdir -p /opt/bullrun && sudo cp -r . /opt/bullrun
cd /opt/bullrun/server && npm ci --omit=dev
sudo mkdir -p /var/lib/bullrun
sudo cp data/seed-leaderboard.json /var/lib/bullrun/
sudo cp deploy/bullrun-api.service /etc/systemd/system/
sudoedit /etc/systemd/system/bullrun-api.service     # set a real JWT_SECRET
sudo systemctl daemon-reload && sudo systemctl enable --now bullrun-api

# 2. Front-end (static files)
sudo mkdir -p /var/www/bullrun
sudo cp -r index.html assets archive bg frames tex sounds \
          bull.png lighttext.png text.png origin.png herobg.png dex.webp lightbg.jpeg \
          /var/www/bullrun/

# 3. nginx + TLS
sudo cp deploy/nginx-two-domain.conf /etc/nginx/sites-available/bullrun
sudo ln -s /etc/nginx/sites-available/bullrun /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bullrunn.fun -d www.bullrunn.fun -d api.bullrunn.fun
```

DNS: A records for `bullrunn.fun`, `www.bullrunn.fun`, and `api.bullrunn.fun` all
pointing at the server. Because the front-end hard-codes the `api.bullrunn.fun`
base, nothing in the front-end changes.

---

## What only you can provide

Making it live on **your** domain needs two things no script can supply: a
**server/host** to run on, and **DNS access** for the domain (your registrar
login). Once you have a server and the domain pointed at it, either option above
is a copy-paste away — or hand me SSH/host access and I'll run it for you.
