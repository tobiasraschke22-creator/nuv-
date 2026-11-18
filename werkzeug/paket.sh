#!/bin/sh
# Baut das Synology-Paket nach ausgabe/ und prüft es (Prüfsumme, Inhalt = Projektdateien, JSON gültig).
#   1. Versionsnummer in VERSION erhöhen
#   2. sh werkzeug/paket.sh
set -e
P=$(cd "$(dirname "$0")/.." && pwd)
O=${1:-$P/ausgabe}
V=$(tr -d ' \n' < "$P/VERSION")
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "FEHLER: VERSION muss z. B. 1.2.0 sein"; exit 1; }
# Version in App und Offline-Speicher setzen (neuer Cache-Name = Handy lädt die neuen Dateien)
sed -i "s/^const APP_VERSION = '[^']*';/const APP_VERSION = '$V';/" "$P/app.js"
sed -i "s/^const CACHE = 'ringtagebuch-[^']*';/const CACHE = 'ringtagebuch-$V';/" "$P/sw.js"
node --check "$P/app.js"; node --check "$P/sw.js"
python3 -c "import json,sys; [json.load(open(f)) for f in sys.argv[1:]]" "$P/manifest.json" "$P/werkzeug/spk/conf/resource" "$P/werkzeug/spk/conf/privilege"
for f in "$P"/werkzeug/spk/scripts/*; do sh -n "$f"; done
mkdir -p "$O"
rm -f "$O"/ringtagebuch-*.spk
python3 "$P/werkzeug/spk/build_spk.py" "$P" "$O"
W=$(mktemp -d)
tar -xf "$O/ringtagebuch-$V.spk" -C "$W"
SOLL=$(sed -n 's/^checksum="\(.*\)"/\1/p' "$W/INFO"); IST=$(md5sum "$W/package.tgz" | cut -d' ' -f1)
[ "$SOLL" = "$IST" ] || { echo "FEHLER: Prüfsumme passt nicht"; exit 1; }
mkdir "$W/p"; tar -xzf "$W/package.tgz" -C "$W/p"
for f in $(ls "$W/p/src"); do cmp -s "$P/$f" "$W/p/src/$f" || { echo "FEHLER: $f im Paket anders"; exit 1; }; done
for f in INFO conf/privilege conf/resource scripts/start-stop-status PACKAGE_ICON.PNG PACKAGE_ICON_256.PNG; do
  [ -s "$W/$f" ] || { echo "FEHLER: $f fehlt im Paket"; exit 1; }
done
rm -rf "$W"
echo "Paket $V geprüft: $O/ringtagebuch-$V.spk"
