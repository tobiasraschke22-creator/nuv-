# Ringtagebuch (NuvaRing & Endometriose)

Offline-fähige Web-App (PWA) ohne Build-Schritt. Alle Daten bleiben im Browser (localStorage).

- Tägliches Assessment: Endometriose-Symptome (Schmerzen, Krämpfe, Durchfall, Blutung), Essenstagebuch, Emotionen (Angst, Wut, Stress, Freitext)
- Ring-Zyklus mit Wechsel-Hinweis und Kalender-Export (.ics, 2× täglich)
- Auswertung nach Ring-Phase und Zyklus, Diagramm, Auffälligkeiten, PDF/CSV/Backup

Starten lokal: `python3 -m http.server 8000`, dann http://localhost:8000 öffnen.
Veröffentlichung: GitHub Pages über den Workflow `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).
