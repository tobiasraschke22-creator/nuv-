# Ringtagebuch (NuvaRing & Endometriose)

Offline-fähige Web-App (PWA) ohne Build-Schritt. Alle Daten bleiben im Browser (localStorage).

- Tägliches Assessment ab dem ersten Ring-Tag:
  - Endometriose-Symptome: Schmerzen mit Ort, Krämpfe, Durchfall, Blutung
  - Essenstagebuch: Mahlzeiten mit Uhrzeit und Menge, Freitext
  - Emotionen: Angst, Wut, Stress, Freitext
  - Körper: Schlaf, Energie, Schmerzmittel
- Ring-Rhythmus durchgehend oder mit Pause, Tagebuch-Tag-Zähler, Wechsel-Hinweise
- Kalender-Erinnerungen (.ics): Ringwechsel 2× am Tag, tägliche Tagebuch-Erinnerung
- Auswertung (gesamt, aktueller Ring, letzte 31 Tage): Zusammenhänge zwischen Essen,
  Emotionen, Schlaf und Symptomen, Verläufe, Vergleich nach Ring-Woche und Ring
- Bericht als Datei teilen (für die Ärztin), Drucken, CSV, Backup

Starten lokal: `python3 -m http.server 8000`, dann http://localhost:8000 öffnen.
Veröffentlichung: Die Dateien sind statisch und lassen sich bei jedem HTTPS-Hoster ablegen (z. B. Netlify, Cloudflare Pages).

## Installation auf der Synology

```sh
sh deploy/install.sh                                   # direkt auf der NAS
sh deploy/install.sh benutzer@nas-ip:/volume1/web/ringtagebuch   # vom Computer aus
```

Danach den Ordner in Web Station als Webportal freigeben, oder `deploy/docker-compose.yml`
im Container Manager starten (Port 8080). Für die iPhone-Installation wird HTTPS benötigt.
