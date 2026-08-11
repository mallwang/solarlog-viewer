# SolarLog Viewer

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

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

## Dynamischer Himmel-Hintergrund

Die animierte Wolkenkulisse hinter dem Dashboard spiegelt das reale aktuelle Wetter und die
Ortszeit der Anlage wider, statt immer gleich auszusehen. Die Koordinaten werden aus der
konfigurierten Adresse der Anlage ermittelt (`SKY_LOCATION_OVERRIDE` in `web/js/config.js`, oder
automatisches Geokodieren mit Zwischenspeicherung in `localStorage`, falls nicht gesetzt) und
dienen dazu, alle 15 Minuten die kostenlose, schlüssellose [Open-Meteo](https://open-meteo.com)-
API nach Bewölkung sowie Sonnenauf-/-untergang abzufragen:

- **Wolkendichte** — spärliche, mäßige oder dichte Wolken je nach aktueller Bewölkungsstufe
  (klar/teilweise/bedeckt).
- **Sonne/Mond-Position** — Sonne oder Mond folgen einem vereinfachten Tag-/Nacht-Bogen zwischen
  Sonnenauf- und -untergang, mit sanftem Überblenden am Übergang und gedämpfter Sichtbarkeit bei
  dichter Bewölkung.
- **Fliegende Objekte** — Vögel, Schmetterlinge, Libellen und Gänse-Formationen queren den
  Himmel als animierte SVG-Sprite-Sheets (realistische Silhouetten, keine Emojis); Flugzeuge,
  Ballons und ein Raketen-Osterei Richtung Mond erscheinen selten.

Bei jedem Fehler (keine Position, kein Netzwerk, fehlgeschlagene Anfrage) fällt die Ansicht
stillschweigend auf die ursprüngliche statische Kulisse zurück — es gibt keine Fehleranzeige und
keine Auswirkung auf die PV-Datenfunktionen des Dashboards. `prefers-reduced-motion: reduce`
unterdrückt jegliche Animation und das Spawnen fliegender Objekte, spiegelt die realen
Bedingungen aber weiterhin über statische Hinweise wider. Siehe
`specs/007-dynamic-sky-weather/` für die vollständige Spezifikation/Planung.

## Globales Desktop-Infopanel

Ein dauerhaftes Panel im Header (nur ab Desktop-Breiten ab 768px sichtbar) zeigt die aktuelle
Leistung der Anlage, das aktuelle Wetter und die Restprognose für den heutigen Tag am Standort
der Anlage — sichtbar in jeder Ansicht, nicht nur im Dashboard. Es fragt `data/min_cur.js` und
[Open-Meteo](https://open-meteo.com) alle ~10 Minuten ab, passend zum minimalen
Aktualisierungsintervall des SolarLog-Geräts selbst. Eine kleine pulsierende Anzeige neben dem
Leistungswert skaliert Größe/Geschwindigkeit mit `currentPacW / capacityKwp` (ruhig nahe null,
am aktivsten nahe der konfigurierten Spitzenleistung der Anlage). Neben dem Leistungswert zeigt
das Panel außerdem den aktuellen Wirkungsgrad des Wechselrichters (ΣPAC ÷ ΣPDC, z. B. „1234 W ·
94%“), sofern DC-Eingangsdaten verfügbar und ungleich null sind — andernfalls wird er ausgeblendet
statt eines irreführenden 0%/∞. Die Tagesansicht (`#/day/YYYY/MM/DD`) zeigt denselben Wirkungsgrad
als zweite Kurve auf einer sekundären y-Achse neben der Leistungskurve, mit Lücken überall dort,
wo PDC null oder fehlt, und komplett ausgeblendet für rekonstruierte/archivierte Tage, die nur
eine Ertragskurve besitzen. Ein Klick auf den Wetter-/
Prognosebereich öffnet eine wetteronline.de-Suche für die konfigurierte Adresse der Anlage in
einem neuen Tab — die übliche Wetterquelle des Anlagenbetreibers. Leistung und Wetter/Prognose
zeigen jeweils unabhängig einen "nicht verfügbar"-Zustand an, falls die jeweilige Datenquelle
nicht abgerufen werden kann, ohne den anderen Bereich zu beeinträchtigen. Siehe
`specs/010-global-info-panel/` für die vollständige Spezifikation/Planung.

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

## Pflege der CO2-Emissionsfaktor-Referenztabelle

Die Ansichten Tag/Monat/Jahr/Gesamt zeigen jeweils einen Wert für vermiedenes CO2, berechnet durch
Multiplikation des Ertrags mit dem CO2-Emissionsfaktor des deutschen Strommixes für das
Kalenderjahr, in dem der Ertrag erzielt wurde. Die jährlichen Faktoren liegen in
`web/js/data/co2-factors.js` als einfaches Objekt (`CO2_FACTOR_KG_PER_KWH_BY_YEAR`), auf Basis der
jährlichen Umweltbundesamt-Veröffentlichung "Entwicklung der spezifischen Treibhausgas-Emissionen
des deutschen Strommix". Jedes Kalenderjahr, das noch nicht in der Tabelle steht (das laufende Jahr
und jedes zukünftige Jahr), verwendet stattdessen die Konstante
`CO2_FALLBACK_FACTOR_KG_PER_KWH` (0,363 kg/kWh).

Um den nächsten vom UBA veröffentlichten Jahreswert einzutragen: den veröffentlichten g CO2/kWh-Wert
in kg/kWh umrechnen (durch 1000 teilen) und als einzelnen neuen Eintrag `jahr: faktor` in
`CO2_FACTOR_KG_PER_KWH_BY_YEAR` hinzufügen — es muss keine andere Datei geändert werden; jede
Ansicht übernimmt den neuen Wert beim nächsten Laden.
