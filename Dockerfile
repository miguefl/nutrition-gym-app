FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# su-exec: lets the entrypoint start as root (to fix the data volume ownership)
# and then drop privileges to the unprivileged app user before running Node.
RUN apk add --no-cache su-exec \
    && addgroup -S app && adduser -S -G app app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app package*.json server.js ./
COPY --chown=app:app src ./src
COPY --chown=app:app public ./public
# Semilla de datos: se copia a /app/datos-seed. El entrypoint la replica a
# /app/datos si faltan ficheros, de forma que un volumen vacío quede inicializado
# sin sobreescribir datos existentes del usuario.
COPY --chown=app:app datos ./datos-seed
COPY --chown=app:app docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/datos && chown -R app:app /app/datos \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# NOTE: we intentionally do NOT set `USER app` here. The container starts as
# root so the entrypoint can chown the mounted /app/datos volume, and then it
# drops to the unprivileged `app` user (via su-exec) before exec'ing Node.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
