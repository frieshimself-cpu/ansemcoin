FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Keep the seed leaderboard outside DATA_DIR so it survives an empty mounted
# volume (see src/index.js). DATA_DIR holds the live db.json.
RUN mkdir -p /app/seed && cp data/seed-leaderboard.json /app/seed/seed-leaderboard.json
ENV SEED_FILE=/app/seed/seed-leaderboard.json
ENV DATA_DIR=/app/data
ENV PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
