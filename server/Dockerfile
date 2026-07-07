FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# DATA_DIR holds the live db.json — mount a volume at /data to persist. It's kept
# separate from the bundled code (the seed leaderboard is required as JSON from
# /app/data), so a mounted volume can't hide the seed.
RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
