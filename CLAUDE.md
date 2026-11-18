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
   - Mini-Darstellungen nutzen dieselben Variablen und Symbole wie die App (`icon()`, `--sl-a`, `--solid` …), damit sie in Hell und Dunkel passen.
   - `INTRO_VERSION` nur erhöhen, wenn alle sie nach dem Update automatisch noch einmal sehen sollen.
     Sonst reicht „Was ist neu“, das einen Knopf „Einführung ansehen“ hat.
2. **`NEUES.txt`**: in einfachen Sätzen, was neu ist (erscheint nach dem Update einmal auf dem iPhone).
3. **`VERSION`** erhöhen, dann `sh werkzeug/paket.sh` (setzt die Version in `app.js`, `sw.js`, `version.json` und
   in die Dateiadressen in `index.html` (`app.js?v=…`, damit das iPhone sicher neu lädt), baut/prüft die `.spk`).
4. **Tests**: `sh pruefung/test.sh` (App-Test + Update-Test, eigener Testserver `pruefung/server.js`). Neue Funktionen
   bekommen neue Prüfungen in `pruefung/app-test.js`. Knöpfe nahe der schwebenden Tableiste im Test per
   `$eval(sel, b => b.click())` auslösen (das Testwerkzeug scrollt sie sonst unter die Leiste).
5. **Installationsanleitung** (Artifact „Ringtagebuch installieren“, https://claude.ai/artifact/ATS314sUhmTeZrKP1pgQa5):
   Dateiname der `.spk` anpassen, bei neuen Einrichtungsschritten ergänzen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `app.js` | Ganze App: Speicher, Ring-Phasen, Ansichten (Heute mit Reitern, Verlauf, Auswertung, Mehr), Schieberegler, Zusatzbereiche (`MODULES`), Arzttermin, Auswertung, Vormonatsvergleich, KI-Auftrag, Export, Updates |
| `icons.js` | Symbole (`ICONS`, `icon()`), von App und Einführung genutzt; die Tableisten-Symbole stehen zusätzlich direkt in `index.html` |
| `intro.js` | Einführung (Startbildschirm), wird vor `app.js` geladen |
| `style.css` | Alle Farben als Variablen: hell in `:root`, dunkel im `prefers-color-scheme: dark`-Block. Bauteile nutzen nur Variablen. |
| `sw.js` | Offline-Speicher. **Greift online bewusst nicht ein** (sonst blieb beim Update manchmal das Öffnen hängen, nachgestellt im Update-Test); nur offline kommt die beim Installieren gespeicherte Version |
| `splash/` | iPhone-Startbilder hell/dunkel, erzeugt mit `node werkzeug/startbilder.js` (neu ausführen, wenn sich Icon oder Hintergrundfarben ändern) |
| `version.json` | von `paket.sh` erzeugt; die App vergleicht sie beim Zurückkehren aus dem Hintergrund |
| `werkzeug/` | `paket.sh` und `spk/` (Synology-Paket nach dem Muster von NununuMe, aber statisch, ohne PHP) |
| `pruefung/` | `test.sh`, `app-test.js`, `update-test.js` (Playwright, iPhone-Emulation) |

Daten im `localStorage`: `nuv.settings` (Einsetzdaten, Ring-Rhythmus, `modules` = ein/aus der Zusatzbereiche),
`nuv.entries` (Einträge je Tag), `nuv.doctor` (Arzttermin, Fragen, Notizen), `nuv.lastBackup`, `nuv.seenVersion`,
`nuv.intro`. Alte Einträge müssen nach jedem Update lesbar bleiben; neue Felder sind immer optional.

Felder je Tag: `pain`, `painDay` {m,n,a}, `painAreas`, `cramps`, `diarrhea`, `bleeding`, `symptoms`, `symNote`, `meals`
[{time,text,amount}], `foodTags`, `foodNote`, `mood`, `anxiety`, `anger`, `stress`, `note`, `sleep`, `energy`, `water`,
`movement`, `meds`, `medsNote`, `medTime`, `medEffect`. Neue Felder auch in `hasData`, `SECTIONS`, `dayText` (KI),
`csv()` und ggf. `correlationNotes` eintragen.

## Stil

- Deutsch, Du-Form gegenüber der Nutzerin, kurze einfache Sätze.
- Rosa nur für Auswahl, Hauptknöpfe und Status; sonst neutral. Glas mit `backdrop-filter`. Hell und dunkel.
- Skalen als Schieberegler (`scaleHTML`), Zahlen darunter genau unter ihrer Stelle; Berührfläche nicht über die Zahlen.
- Bewegungen mit Feder-Kurve (`--spring`), `prefers-reduced-motion` beachten.
- Beim Antippen nicht die ganze Seite neu zeichnen (sonst flackern die Animationen).
