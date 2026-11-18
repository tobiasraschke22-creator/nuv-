# Ringtagebuch – Hinweise für Änderungen

Symptomtagebuch für NuvaRing und Endometriose. Statische Web-App (PWA) für das iPhone, ausgeliefert
als Synology-Paket (`.spk`) über Web Station unter `/ringtagebuch/`. Alle Gesundheitsdaten bleiben im
`localStorage` des Handys, nie auf dem Server.

## Pflicht bei jeder Änderung

1. **Einführung mitpflegen** (`intro.js`, Folien in `INTRO_SLIDES`, Animationen `.ia-*` in `style.css`):
   - Neue Funktion → passende Folie ergänzen oder bestehende anpassen.
   - Optikänderung (Farben, Bedienelemente, Reiter, Tableiste …) → die Mini-Darstellungen in den
     Folien so ändern, dass sie wie die echte App aussehen.
   - Entfernte Funktion → Folie entfernen.
   - `INTRO_VERSION` nur erhöhen, wenn alle sie nach dem Update automatisch noch einmal sehen sollen.
     Sonst reicht „Was ist neu“, das einen Knopf „Einführung ansehen“ hat.
2. **`NEUES.txt`**: in einfachen Sätzen, was neu ist (erscheint nach dem Update einmal auf dem iPhone).
3. **`VERSION`** erhöhen, dann `sh werkzeug/paket.sh` (setzt die Version in `app.js`, `sw.js`,
   `version.json` und baut/prüft `ausgabe/ringtagebuch-<v>.spk`).
4. **Tests**: `sh pruefung/test.sh` (App-Test + Update-Test). Neue Funktionen bekommen neue Prüfungen
   in `pruefung/app-test.js`.
5. **Installationsanleitung** (Artifact „Ringtagebuch installieren“, https://claude.ai/artifact/ATS314sUhmTeZrKP1pgQa5):
   Dateiname der `.spk` anpassen, bei neuen Einrichtungsschritten ergänzen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `app.js` | Ganze App: Speicher, Ring-Phasen, Ansichten (Heute mit Reitern, Verlauf, Auswertung, Mehr), Auswertung, KI-Auftrag, Export, Updates |
| `intro.js` | Einführung (Startbildschirm), wird vor `app.js` geladen |
| `style.css` | Weiß/Hellgrau mit Rosa nur als Akzent, Glasflächen, iOS-artige Animationen |
| `sw.js` | Offline-Speicher; fragt immer zuerst den Server (`no-cache`), damit Updates sofort ankommen |
| `version.json` | von `paket.sh` erzeugt; die App vergleicht sie beim Zurückkehren aus dem Hintergrund |
| `werkzeug/` | `paket.sh` und `spk/` (Synology-Paket nach dem Muster von NununuMe, aber statisch, ohne PHP) |
| `pruefung/` | `test.sh`, `app-test.js`, `update-test.js` (Playwright, iPhone-Emulation) |

Daten im `localStorage`: `nuv.settings` (Einsetzdaten, Ring-Rhythmus), `nuv.entries` (Einträge je Tag),
`nuv.lastBackup`, `nuv.seenVersion`, `nuv.intro`. Alte Einträge müssen nach jedem Update lesbar bleiben.

## Stil

- Deutsch, Du-Form gegenüber der Nutzerin, kurze einfache Sätze.
- Rosa nur für Auswahl, Hauptknöpfe und Status; sonst neutral. Glas mit `backdrop-filter`.
- Bewegungen mit Feder-Kurve (`--spring`), `prefers-reduced-motion` beachten.
- Beim Antippen nicht die ganze Seite neu zeichnen (sonst flackern die Animationen).
