# Benutzerhandbuch: Validierungs- und Aggregationsworkflow

Dieses Dokument beschreibt, wie Datenlücken erkannt, Summen validiert und aggregierte Dateien repariert werden können.

## Dashboard-Navigation & Diagramme

`web/index.html` listet alle sechs Ansichten (Übersicht, Tag, Monat, Jahr, Gesamt, Vergleich) oben
in der Navigationsleiste auf. Ab Desktop-Breiten (768px und mehr) ist die Navigation dauerhaft
sichtbar; darunter klappt sie hinter einem Hamburger-Button zusammen — antippen öffnet die Liste,
ein Klick auf einen Link (oder daneben, oder die Escape-Taste) schließt sie wieder. Die aktuelle
Ansicht ist immer hervorgehoben.

Diagramme in den Ansichten Tag/Monat/Jahr/Gesamt/Vergleich werden mit ApexCharts gerendert: beim
Hovern über einen Balken oder eine Linie erscheint ein Tooltip mit dem genauen Wert und seiner
Einheit (W für die Tagesansicht, kWh in den übrigen). Diagramme passen sich der Fenstergröße an,
und das gesamte Layout — inklusive Navigation — bleibt von 320px breiten Smartphones bis zu
2560px breiten Monitoren nutzbar, ohne horizontales Scrollen.

## Voraussetzungen

- Node.js 22+
- Alle Befehle vom **Repo-Wurzelverzeichnis** aus ausführen (dort, wo `days_hist.js`, `months.js`, `years.js` und `min*.js` liegen)

---

## Schritt 1 — Lücken in Archivdaten erkennen

`gap-detect.js` kann zwei Datenquellen prüfen:

**Min-Dateien** (Standard) — scannt `min*.js`-Dateinamen auf fehlende Kalendertage:

```bash
node scripts/gap-detect.js
node scripts/gap-detect.js --since 2020-01-01
node scripts/gap-detect.js --output json --out-file gap-report.json
```

**`days_hist.js`** — prüft auf fehlende Einträge in der aggregierten Historiendatei:

```bash
node scripts/gap-detect.js --source days_hist
node scripts/gap-detect.js --source days_hist --since 2020-01-01
```

Beide Modi erzeugen das gleiche Ausgabeformat: eine lesbare Liste fehlender Datumsbereiche oder „No gaps detected." Die Optionen `--since`, `--output json` und `--out-file` funktionieren mit beiden Quellen.

---

## Schritt 2 — Tagessummen gegen days_hist.js prüfen

```bash
node scripts/validate-plausibility.js
```

Vergleicht die Wh-Summe aus der ersten Zeile jeder `minJJMMTT.js` mit dem Eintrag in `days_hist.js`. Tage, die die Toleranz von ±1 Wh überschreiten, werden mit den Abweichungen je Wechselrichter ausgegeben.

Toleranz anpassen:

```bash
node scripts/validate-plausibility.js --tolerance 10
```

JSON-Ausgabe:

```bash
node scripts/validate-plausibility.js --output json --out-file validation.json
```

---

## Schritt 3 — Lücken in days_hist.js auffüllen

Für einen Monat mit fehlenden Einträgen in `days_hist.js`:

Vorschau ohne Schreiben:

```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
```

Anwenden (fragt vor dem Schreiben nach):

```bash
node scripts/fill-days-hist.js 2026-06
```

Ohne Bestätigungsabfrage anwenden:

```bash
node scripts/fill-days-hist.js 2026-06 --force
```

Das Skript verwendet pro fehlendem Tag eine zweistufige Strategie:

- **Pass 1**: Sucht das Datum in allen `days*.js`-Dateien und übernimmt Wh- und Einspeisequoten direkt
- **Pass 2**: Falls kein Treffer, liest die erste Zeile der `minJJMMTT.js`-Datei (Einspeisung wird auf 0 gesetzt)

Tage ohne Quelle in beiden Passes werden als nicht auffüllbar gemeldet.

---

## Schritt 4 — Monatssummen neu berechnen

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

Liest alle `min2606*.js`-Dateien, summiert WR1- und WR2-Wh und schreibt oder aktualisiert den `mo[mx++]=`-Eintrag für den Monat in `months.js`.

---

## Schritt 5 — Jahressummen neu berechnen

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

Liest alle `min26*.js`-Dateien des Jahres und schreibt oder aktualisiert den `ye[yx++]=`-Eintrag in `years.js`.

---

## Agentische Skills (Claude Code)

Mit Claude Code stehen Skills zur Verfügung, die den Ablauf Vorschau → Bestätigung → Anwenden kapseln:

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```

Jeder Skill zeigt zunächst eine Vorschau, fragt nach Bestätigung und gibt anschließend eine Zusammenfassung aus.

---

## Typischer Arbeitsablauf

```
gap-detect → validate-plausibility → fill-days-hist → fill-months → fill-years
```

Reihenfolge einhalten: zuerst fehlende Daten erkennen, vorhandene validieren, dann von unten nach oben auffüllen.
