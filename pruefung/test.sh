#!/bin/sh
# Alle Tests gegen das fertige Paket in ausgabe/ (vorher: sh werkzeug/paket.sh).
#   sh pruefung/test.sh
# Benötigt: Node.js mit Playwright (Chromium), Python 3. Ergebnisse und Bilder in pruefung/qa/.
set -e
P=$(cd "$(dirname "$0")/.." && pwd)
V=$(tr -d ' \n' < "$P/VERSION")
Q="$P/pruefung/qa"
rm -rf "$Q"; mkdir -p "$Q/x" "$Q/app/www/ringtagebuch" "$Q/upd/alt" "$Q/upd/neu" "$Q/upd/www/ringtagebuch"
tar -xf "$P/ausgabe/ringtagebuch-$V.spk" -C "$Q/x"; tar -xzf "$Q/x/package.tgz" -C "$Q/x"
cp -r "$Q"/x/src/. "$Q/app/www/ringtagebuch/"
# Update-Test: „alt“ = dieses Paket, „neu“ = dasselbe mit höherer Versionsnummer
N="$V.1"
cp -r "$Q"/x/src/. "$Q/upd/alt/"; cp -r "$Q"/x/src/. "$Q/upd/neu/"; cp -r "$Q"/x/src/. "$Q/upd/www/ringtagebuch/"
sed -i "s/^const APP_VERSION = '[^']*'/const APP_VERSION = '$N'/" "$Q/upd/neu/app.js"
sed -i "s/^const CACHE = 'ringtagebuch-[^']*'/const CACHE = 'ringtagebuch-$N'/" "$Q/upd/neu/sw.js"
printf '{"version":"%s","notes":["Testneuerung A","Testneuerung B"]}' "$N" > "$Q/upd/neu/version.json"
sed -i "s/?v=$V\"/?v=$N\"/g" "$Q/upd/neu/index.html"
node "$P/pruefung/server.js" "$Q/app/www" 8401 & S1=$!
node "$P/pruefung/server.js" "$Q/upd/www" 8402 & S2=$!
trap 'kill $S1 $S2 2>/dev/null' EXIT
sleep 1
echo "== App-Test (Version $V)"
BASE=http://127.0.0.1:8401/ringtagebuch/ node "$P/pruefung/app-test.js" "$Q/app" | tee "$Q/app.txt" | grep -vE '^PASS' || true
echo "   $(grep -c '^PASS' "$Q/app.txt") bestanden"
echo "== Update-Test ($V → $N)"
BASE=http://127.0.0.1:8402/ringtagebuch/ OLD=$V NEW=$N node "$P/pruefung/update-test.js" "$Q/upd" | tee "$Q/upd.txt" | grep -vE '^PASS' || true
echo "   $(grep -c '^PASS' "$Q/upd.txt") bestanden"
grep -q 'ALLES OK' "$Q/app.txt" && grep -q 'ALLES OK' "$Q/upd.txt"
