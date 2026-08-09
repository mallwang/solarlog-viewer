# SolarLog Viewer

Statischer Viewer für SolarLog-Datenexporte (HTML/JS/CSS). `web/` ist das einzige Verzeichnis, das
per FTP auf die Synology DiskStation übertragen wird — `web/index.html` ist ein Single-Page-
Dashboard (vanilla ES-Module, Tailwind CSS als statische Build-Datei, ApexCharts) mit aktueller
Leistung und den vier Ertragssummen (Tag/Monat/Jahr/Gesamt) sowie Detailansichten über Hash-Routing
(`#/day/JJJJ/MM/TT`, `#/month/JJJJ/MM`, `#/year/JJJJ`, `#/total`, `#/compare`). Alle sechs Ansichten
teilen sich ein einheitliches Tailwind-Design in Hell- und Dunkelmodus. Ein responsives
Navigationsmenü listet alle sechs Ansichten und hebt die aktive hervor — auf Desktop-Breiten
dauerhaft sichtbar, unterhalb von ~768px als Hamburger-Menü, nutzbar von 320px bis 2560px Breite
ohne horizontales Scrollen. Die Sprachauswahl (DE/EN) bleibt über Neuladen hinweg erhalten. Die
frühere Frameset-Website liegt schreibgeschützt unter `legacy-site/`.

Die SolarLog-Daten sind aufgeteilt auf `web/hist/` (eingefrorene historische Daten bis
einschließlich 28.07.2026 vom alten Gerät) und `web/data/` (laufend überschriebene Live-Daten des
seit 29.07.2026 installierten neuen Geräts); die App führt beide zusammen, wenn eine Abfrage diese
Grenze überschreitet — siehe `specs/001-website-modernization/data-model.md`.

## Entwicklungsserver

```bash
npm install
npm run start
npm run open
```

Startet den Dev-Server unter http://localhost:3000 — Einstiegspunkt ist `web/index.html`. `npm start`
startet die Tailwind-CLI im `--watch`-Modus parallel zu `browser-sync`, sodass auch CSS-Änderungen
per Hot-Reload übernommen werden. Mit `npm run open` wird der Viewer im Standardbrowser geöffnet.

`npm run build:css` kompiliert `web/css/tailwind.css` zur eingecheckten statischen Datei
`web/css/tailwind.generated.css`, die produktiv genutzt wird — kein CDN-/Runtime-Skript.

## Frontend-Tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test-Unit-Tests für web/js/data/*-Parser und web/js/**
npm run lint
npm run format:check
```

## Datendateien

Die `min*.js`-Dateien (eine pro Tag, ~7000+ Dateien) enthalten die vom SolarLog-Gerät exportierten Rohdaten. Die `days*.js`- und `days_hist*.js`-Dateien enthalten aggregierte Tages-/Monatsübersichten.

## Validierungs- und Aggregationsskripte

Ausführung vom Repo-Wurzelverzeichnis mit Node.js 22+.

**Fehlende Tagesdateien erkennen (scannt `min*.js`-Dateinamen):**

```bash
node scripts/gap-detect.js
node scripts/gap-detect.js --since 2020-01-01
node scripts/gap-detect.js --output json --out-file gap-report.json
```

**Fehlende Einträge in `days_hist.js` erkennen:**

```bash
node scripts/gap-detect.js --source days_hist
node scripts/gap-detect.js --source days_hist --since 2020-01-01
```

**Min-Datei-Summen gegen `days_hist.js` prüfen:**

```bash
node scripts/validate-plausibility.js
node scripts/validate-plausibility.js --tolerance 10
```

**Fehlende Einträge in `days_hist.js` für einen Monat auffüllen (zweistufig: days-Dateien → min-Datei):**

```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
node scripts/fill-days-hist.js 2026-06 --force
```

**Monatssumme in `months.js` neu berechnen:**

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

**Jahrssumme in `years.js` neu berechnen:**

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

**Agentische Skills (Claude Code):**

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```
