#!/bin/sh
# Arranque del contenedor:
#  1. Si arrancamos como root, corregimos el dueño del volumen /app/datos (que
#     trae los permisos del host) y bajamos privilegios al usuario `app`.
#  2. Ya como `app`, sembramos los ficheros que falten desde la semilla embebida
#     y lanzamos el proceso. Nunca se sobreescriben datos existentes del usuario.
set -e

SEED_DIR=/app/datos-seed
DATA_DIR=/app/datos
APP_USER=app

# --- Paso 1: como root, ajustar permisos del volumen y soltar privilegios ---
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  # El bind mount del host suele venir como root y el proceso corre como `app`,
  # que no podría escribir auth.json/plan/registro. Le damos la propiedad.
  chown -R "$APP_USER":"$APP_USER" "$DATA_DIR"
  # Re-ejecuta este mismo script ya como `app`.
  exec su-exec "$APP_USER" "$0" "$@"
fi

# --- Paso 2: ya como `app` ---
if [ -d "$SEED_DIR" ]; then
  for f in "$SEED_DIR"/*; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    if [ ! -e "$DATA_DIR/$base" ]; then
      cp "$f" "$DATA_DIR/$base"
      echo "[init] Semilla aplicada: $base"
    fi
  done
fi

exec "$@"
