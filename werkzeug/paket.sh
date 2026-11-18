#!/bin/sh
# Baut das Synology-Paket nach ausgabe/ und prüft es (Prüfsumme, Inhalt = Projektdateien, JSON gültig).
#   1. Versionsnummer in VERSION erhöhen, in NEUES.txt eintragen, was neu ist (sieht deine Frau nach dem Update)
#   2. sh werkzeug/paket.sh
set -e
P=$(cd "$(dirname "$0")/.." && pwd)
O=${1:-$P/ausgabe}
V=$(tr -d ' \n' < "$P/VERSION")
echo "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "FEHLER: VERSION muss z. B. 1.2.0 sein"; exit 1; }
# Version in App und Offline-Speicher setzen (neuer Cache-Name = Handy lädt die neuen Dateien)
sed -i "s/^const APP_VERSION = '[^']*';/const APP_VERSION = '$V';/" "$P/app.js"
sed -i "s/^const CACHE = 'ringtagebuch-[^']*';/const CACHE = 'ringtagebuch-$V';/" "$P/sw.js"
# Versionsnummer in die Dateiadressen: so lädt das iPhone nach einem Update garantiert die neuen Dateien
sed -i -E "s/(style\.css|icons\.js|intro\.js|app\.js)(\?v=[^\"]*)?\"/\1?v=$V\"/g" "$P/index.html"
grep -q "app.js?v=$V\"" "$P/index.html" || { echo "FEHLER: Version in index.html nicht gesetzt"; exit 1; }
# version.json: daran erkennt die App auf dem iPhone, dass es ein Update gibt; NEUES.txt = „Was ist neu“
python3 - "$P" "$V" <<'PY'
import json, sys
root, v = sys.argv[1], sys.argv[2]
notes = [l.strip() for l in open(root + '/NEUES.txt', encoding='utf-8') if l.strip()]
json.dump({'version': v, 'notes': notes}, open(root + '/version.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
PY
node --check "$P/app.js"; node --check "$P/icons.js"; node --check "$P/intro.js"; node --check "$P/sw.js"
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
for f in $(cd "$W/p/src" && find . -type f); do cmp -s "$P/$f" "$W/p/src/$f" || { echo "FEHLER: $f im Paket anders"; exit 1; }; done
[ -f "$W/p/src/splash/start-1170x2532-light.png" ] || { echo "FEHLER: Startbilder fehlen im Paket"; exit 1; }
for f in INFO conf/privilege conf/resource scripts/start-stop-status PACKAGE_ICON.PNG PACKAGE_ICON_256.PNG; do
  [ -s "$W/$f" ] || { echo "FEHLER: $f fehlt im Paket"; exit 1; }
done
rm -rf "$W"
echo "Paket $V geprüft: $O/ringtagebuch-$V.spk"
