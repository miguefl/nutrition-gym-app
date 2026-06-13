FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

RUN addgroup -S app && adduser -S -G app app

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

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
