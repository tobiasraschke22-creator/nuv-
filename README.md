# Ringtagebuch (NuvaRing & Endometriose)

Offline-fähige Web-App (PWA) ohne Build-Schritt. Alle Daten bleiben im Browser (localStorage).

- Tägliches Assessment ab dem ersten Ring-Tag:
  - Endometriose-Symptome: Schmerzen mit Ort, Krämpfe, Durchfall, Blutung
  - Essenstagebuch: Mahlzeiten mit Uhrzeit und Menge, Freitext
  - Emotionen: Laune (−5 bis +5), Angst, Wut, Stress, Freitext
  - Körper: Schlaf, Energie, Schmerzmittel
- Ring-Rhythmus durchgehend oder mit Pause, Tagebuch-Tag-Zähler, Wechsel-Hinweise
- Kalender-Erinnerungen (.ics): Ringwechsel 2× am Tag, tägliche Tagebuch-Erinnerung
- Auswertung (gesamt, aktueller Ring, letzte 31 Tage): Zusammenhänge zwischen Essen,
  Emotionen, Schlaf und Symptomen, Verläufe, Vergleich nach Ring-Woche und Ring
- Bericht als Datei teilen (für die Ärztin), Drucken, CSV, Backup

Lokal starten: `python3 -m http.server 8000`, dann http://localhost:8000 öffnen.

## Synology-Paket

```sh
# 1. Versionsnummer in VERSION erhöhen (z. B. 1.3.0 → 1.4.0)
# 2. In NEUES.txt eintragen, was neu ist (erscheint nach dem Update einmal auf dem iPhone)
sh werkzeug/paket.sh     # baut ausgabe/ringtagebuch-<v>.spk und prüft es
sh pruefung/test.sh      # App-Test und Update-Test gegen das fertige Paket
```

Regeln für Änderungen (Einführung mitpflegen usw.): `CLAUDE.md`.

Installation: Paket-Zentrum → „Manuell installieren“ → `.spk` wählen. Danach unter
`http://IP-der-DiskStation/ringtagebuch/` erreichbar. Ausführlich: `LIESMICH.txt`.

Updates erreichen das iPhone von selbst: Die App lädt beim Öffnen immer zuerst von der DiskStation
und prüft beim Zurückkehren aus dem Hintergrund `version.json`. Bei einer neuen Version lädt sie sich neu
und zeigt einmal „Was ist neu“.

Aufbau wie beim NununuMe-Paket (`werkzeug/spk/`), aber ohne PHP und ohne Hintergrund-Dienst:
Web Station liefert die Dateien statisch aus, Gesundheitsdaten liegen nie auf der DiskStation.
Benötigt: Python 3 mit Pillow, Node.js.
