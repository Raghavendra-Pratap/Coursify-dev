#!/bin/sh
# Coursify container only — does not affect other containers or Caddy.
set -e

SRC=/app/config/production.env
DEST=/app/config/runtime.env

if [ -r "$SRC" ]; then
  cp "$SRC" "$DEST"
  chown nextjs:nodejs "$DEST"
  chmod 644 "$DEST"
fi

cd /app
exec su-exec nextjs:nodejs "$@"
