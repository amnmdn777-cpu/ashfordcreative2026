# syntax=docker/dockerfile:1
#
# Ashford backend — Express API server.
#
# Chromium is installed at the OS level because `build.mjs` externalizes
# `puppeteer` (the template-screenshot service launches headless Chrome at
# runtime). The bundle in dist/ therefore `require()`s puppeteer from
# node_modules, and puppeteer needs a real Chromium + its shared libraries.
FROM node:22-bookworm-slim

# Don't let `npm ci` download puppeteer's own Chromium — we use the system one.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The `file:./packages/*` workspace deps must exist before `npm ci` resolves
# them, so copy manifests + packages first to keep the install layer cached.
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci

# App source, then bundle to dist/index.mjs via esbuild (build.mjs).
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Railway injects PORT at runtime; this is only the local `docker run` default.
ENV PORT=8080
EXPOSE 8080

# dumb-init gives us a real PID 1 so Chromium's zombie children get reaped.
CMD ["dumb-init", "node", "--enable-source-maps", "./dist/index.mjs"]
