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
cp "$Q"/x/src/* "$Q/app/www/ringtagebuch/"
# Update-Test: „alt“ = dieses Paket, „neu“ = dasselbe mit höherer Versionsnummer
N="$V.1"
cp "$Q"/x/src/* "$Q/upd/alt/"; cp "$Q"/x/src/* "$Q/upd/neu/"; cp "$Q"/x/src/* "$Q/upd/www/ringtagebuch/"
sed -i "s/^const APP_VERSION = '[^']*'/const APP_VERSION = '$N'/" "$Q/upd/neu/app.js"
sed -i "s/^const CACHE = 'ringtagebuch-[^']*'/const CACHE = 'ringtagebuch-$N'/" "$Q/upd/neu/sw.js"
printf '{"version":"%s","notes":["Testneuerung A","Testneuerung B"]}' "$N" > "$Q/upd/neu/version.json"
python3 -m http.server 8401 --directory "$Q/app/www" >/dev/null 2>&1 & S1=$!
python3 -m http.server 8402 --directory "$Q/upd/www" >/dev/null 2>&1 & S2=$!
trap 'kill $S1 $S2 2>/dev/null' EXIT
sleep 1
echo "== App-Test (Version $V)"
BASE=http://localhost:8401/ringtagebuch/ node "$P/pruefung/app-test.js" "$Q/app" | tee "$Q/app.txt" | grep -vE '^PASS' || true
echo "   $(grep -c '^PASS' "$Q/app.txt") bestanden"
echo "== Update-Test ($V → $N)"
BASE=http://localhost:8402/ringtagebuch/ OLD=$V NEW=$N node "$P/pruefung/update-test.js" "$Q/upd" | tee "$Q/upd.txt" | grep -vE '^PASS' || true
echo "   $(grep -c '^PASS' "$Q/upd.txt") bestanden"
grep -q 'ALLES OK' "$Q/app.txt" && grep -q 'ALLES OK' "$Q/upd.txt"
