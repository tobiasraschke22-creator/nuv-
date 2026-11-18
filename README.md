# Ringtagebuch (NuvaRing & Endometriose)

Offline-fähige Web-App (PWA) ohne Build-Schritt. Alle Daten bleiben im Browser (localStorage).

- Tägliches Assessment: Endometriose-Symptome (Schmerzen, Krämpfe, Durchfall, Blutung), Essenstagebuch, Emotionen (Angst, Wut, Stress, Freitext)
- Ring-Zyklus mit Wechsel-Hinweis und Kalender-Export (.ics, 2× täglich)
- Auswertung nach Ring-Phase und Zyklus, Diagramm, Auffälligkeiten, PDF/CSV/Backup

Starten lokal: `python3 -m http.server 8000`, dann http://localhost:8000 öffnen.
Veröffentlichung: Die Dateien sind statisch und lassen sich bei jedem HTTPS-Hoster ablegen (z. B. Netlify, Cloudflare Pages).

## Installation auf der Synology

```sh
sh deploy/install.sh                                   # direkt auf der NAS
sh deploy/install.sh benutzer@nas-ip:/volume1/web/ringtagebuch   # vom Computer aus
```

Danach den Ordner in Web Station als Webportal freigeben, oder `deploy/docker-compose.yml`
im Container Manager starten (Port 8080). Für die iPhone-Installation wird HTTPS benötigt.
