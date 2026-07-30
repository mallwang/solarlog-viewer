# SolarLog Viewer

Statischer Viewer für SolarLog-Datenexporte (HTML/JS/CSS).

## Entwicklungsserver

```bash
npm install
npm run start
npm run open
```

Startet den Dev-Server unter http://localhost:3000 — Einstiegspunkt ist `index.html`.  
Mit `npm run open` wird der Viewer im Standardbrowser geöffnet.

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
