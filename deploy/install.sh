#!/bin/sh
# Ringtagebuch auf eine Synology (oder jeden Webserver-Ordner) installieren.
#
#   Lokal auf der NAS (per SSH):   sh deploy/install.sh
#   Vom Computer auf die NAS:      sh deploy/install.sh benutzer@nas-ip:/volume1/web/ringtagebuch
#   Eigener Zielordner:            sh deploy/install.sh /pfad/zum/ordner
set -eu

SRC="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-/volume1/web/ringtagebuch}"
FILES="index.html style.css app.js sw.js manifest.webmanifest icon.svg icon-180.png icon-192.png icon-512.png"

for f in $FILES; do
  [ -f "$SRC/$f" ] || { echo "Fehler: $f fehlt in $SRC" >&2; exit 1; }
done

case "$TARGET" in
  *:*)
    HOST="${TARGET%%:*}"; DIR="${TARGET#*:}"
    echo "Kopiere nach $HOST:$DIR ..."
    # shellcheck disable=SC2086
    tar -C "$SRC" -cf - $FILES | ssh "$HOST" "mkdir -p '$DIR' && tar -C '$DIR' -xf -"
    ;;
  *)
    echo "Kopiere nach $TARGET ..."
    mkdir -p "$TARGET"
    for f in $FILES; do cp "$SRC/$f" "$TARGET/$f"; done
    ;;
esac

echo "Fertig. Nächster Schritt: Ordner in Web Station als Webportal freigeben"
echo "oder deploy/docker-compose.yml im Container Manager starten."
