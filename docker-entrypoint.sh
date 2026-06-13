#!/bin/sh
# Si el volumen /app/datos está vacío o le faltan ficheros, los copiamos
# desde la semilla embebida en la imagen. Nunca sobreescribe ficheros existentes.
set -e

SEED_DIR=/app/datos-seed
DATA_DIR=/app/datos

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
