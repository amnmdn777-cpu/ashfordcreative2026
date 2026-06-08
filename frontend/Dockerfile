# syntax=docker/dockerfile:1
#
# Ashford frontend — Vite SPA (public site + /admin + /sales), served by nginx.

# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines import.meta.env.* at BUILD time, so the API origin must be
# known here. Railway passes service variables to the build as ARGs.
#   - VITE_API_BASE: absolute URL of the backend, e.g. https://api.example.com
#                    Leave empty to call same-origin "/api" (reverse-proxy setup).
ARG VITE_API_BASE=""
ARG VITE_MOCK_AUTH="false"
ARG VITE_SENTRY_DSN=""
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_MOCK_AUTH=$VITE_MOCK_AUTH \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine

# Template is rendered with envsubst on container start so `listen ${PORT}`
# picks up the port Railway assigns.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080
