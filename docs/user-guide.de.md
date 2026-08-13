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

Die Ansichten Tag, Monat und Jahr haben jeweils oberhalb des Diagramms eine Zeile mit
Vor-/Zurück-Links, einem Link zum aktuellen Zeitraum (z. B. "Heute"/"Dieser Monat") und einem
Link zur nächstgrößeren Zeitebene (Tag → Monat → Jahr → Gesamt) — z. B. führt "Monat" von einer
Tagesansicht direkt zur zugehörigen Monatsansicht. Die Gesamt-Ansicht hat keinen solchen Link, da
sie die oberste Ebene der Hierarchie ist.

Die Legende der Tagesansicht enthält einen einzigen Eintrag "UDC (V)" für die DC-Stringspannung
mit eigener rechter Achse — ein Klick darauf blendet eine fette Durchschnittslinie ein (gemittelt
über alle meldenden Wechselrichter-Strings, nicht summiert — eine Summe würde einen unplausiblen
Wert über 1000 V ergeben) mit einem weichen Band dahinter, das für jeden Punkt die Spanne vom
niedrigsten bis zum höchsten String-Wert zeigt, sodass auf einen Blick sowohl der Durchschnitt als
auch die Streuung zwischen den Strings sichtbar wird. Standardmäßig ausgeblendet, damit das
Diagramm nicht überladen wirkt; ein erneuter Klick blendet Linie und Band gemeinsam wieder aus.
Beim Hovern über das sichtbare Diagramm zeigt der Tooltip den Durchschnitt fett mit einer Zeile
"Min: … V / Max: … V" darunter. Diese Ein-/Ausblend-Wahl wird über Reloads und andere
Tagesdiagramme hinweg gemerkt — eine eingeblendete UDC-Linie bleibt also eingeblendet, bis sie
wieder ausgeblendet wird. An Tagen ohne erfasste Spannungsdaten (z. B. rekonstruierte/archivierte
Tage, die nur den Ertragsverlauf zeigen) wird der UDC-Eintrag gar nicht erst angeboten, da es
nichts zu zeichnen gibt. Die drei y-Achsen des
Tagesdiagramms (Einspeisung W, Wirkungsgrad %,
UDC V) verwenden unabhängig vom Tag stets denselben festen Wertebereich und dieselbe
Gitterlinien-Schrittweite, damit ein ertragsschwacher Tag nicht optisch genauso stark wirkt wie
ein ertragsstarker und die Skala beim Blättern zwischen Tagen nicht springt. Die x-Achse zoomt
normalerweise auf die Zeiten, für die an diesem Tag tatsächlich Daten vorliegen (mit etwas
Polsterung an beiden Enden, damit die Linie nicht direkt am Diagrammrand beginnt/endet — das
erleichtert auch das Hovern dieser Randpunkte); eine Admin-Person kann stattdessen fest auf den
vollen Tag 00:00–24:00 umstellen — siehe `DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE` und
`DAY_CHART_X_AXIS_PADDING_MINUTES` in `web/js/config.js`. Die Monats-, Jahres- und Gesamt-Ansicht zeigen oberhalb des Diagramms einen
Umschalter "Gesamt" / "Wechselrichter": "Gesamt" (Standard) zeigt wie bisher einen einzelnen
Summenbalken pro Zeitraum, während "Wechselrichter" jeden Balken in einen gestapelten Abschnitt
pro Wechselrichter-String aufteilt (WR1, WR2, …) — der Tooltip zeigt dann zusätzlich zur
Gesamtsumme auch die einzelnen Beiträge jedes Strings. Die gewählte Ansicht wird gemerkt (im
Browser gespeichert) und beim nächsten Öffnen einer dieser drei Ansichten automatisch wieder
angewendet. Ein Klick auf einen beliebigen Teil eines Balkens führt in beiden Ansichten weiterhin
genau wie zuvor zur nächstfeineren Ansicht.

## Dynamischer Himmel-Hintergrund

Die Wolkenkulisse hinter dem Dashboard ändert sich mit dem realen aktuellen Wetter und der
Ortszeit der Anlage, statt immer gleich auszusehen: Die Wolkendichte (spärlich/mäßig/dicht)
spiegelt die aktuelle Bewölkung wider, Sonne oder Mond folgen einem vereinfachten Tag-/
Nacht-Bogen und blenden am Sonnenauf-/-untergang sanft über, und gelegentlich queren Vögel,
Flugzeuge, Ballons oder eine seltene Raketen-Animation Richtung Mond den Himmel. Das läuft
automatisch — es gibt nichts zu konfigurieren — und aktualisiert sich alle 15 Minuten. Können
keine Wetterdaten abgerufen werden (kein Netzwerk, keine konfigurierte Position), behält die
Kulisse einfach ihr ursprüngliches statisches Aussehen bei; der Rest des Dashboards ist davon
nicht betroffen. Ist in System/Browser "Bewegung reduzieren" aktiviert, werden sämtliche
Himmel-Animationen und fliegenden Objekte unterdrückt, während Wolkendichte und Sonne-/
Mond-Zustand weiterhin aktualisiert werden.

## Globales Desktop-Infopanel

Ab Desktop-Breiten (768px und mehr) zeigt ein Panel im Header — sichtbar in jeder Ansicht, nicht
nur im Dashboard — die aktuelle Leistung der Anlage zusammen mit dem aktuellen Wetter und der
Restprognose für den heutigen Tag am Standort der Anlage. Beide werden alle ~10 Minuten
aktualisiert (passend zum minimalen Aktualisierungsintervall des SolarLog-Geräts selbst, ein
schnelleres Abfragen würde also ohnehin keine neueren Daten finden). Ein kleiner pulsierender
Punkt neben dem Leistungswert wird größer und pulsiert schneller, je näher die aktuelle Leistung
an der konfigurierten Spitzenleistung der Anlage liegt, und beruhigt sich nahe null (z. B.
nachts). Neben dem Leistungswert zeigt das Panel den aktuellen Wirkungsgrad des Wechselrichters
(AC-Ausgang ÷ DC-Eingang, z. B. „1234 W · 94%“), sofern DC-Eingangsdaten verfügbar und ungleich
null sind — andernfalls bleibt er ausgeblendet statt eines irreführenden 0%/∞. Die Tagesansicht
(`#/day/YYYY/MM/DD`) zeigt denselben Wirkungsgrad als zweite Kurve neben der Leistungskurve, mit
Lücken überall dort, wo der DC-Eingang null oder unbekannt ist, und komplett ausgeblendet für
rekonstruierte/archivierte Tage, die nur eine Ertragskurve besitzen. Ein Klick/Tap auf den
Wetter-/Prognosebereich öffnet eine wetteronline.de-Suche für die
Adresse der Anlage in einem neuen Tab. Können Leistungs- oder Wetterdaten nicht abgerufen
werden, zeigt der jeweilige Bereich "Nicht verfügbar" an, während der andere Bereich normal
weiterarbeitet. Das Panel ist unterhalb von 768px vollständig ausgeblendet — es beansprucht im
mobilen Layout keinen zusätzlichen Platz.

## Vermiedenes CO2

Die Ansichten Tag, Monat, Jahr und Gesamt (Lebenszeit) zeigen im Statistikbereich neben dem
Diagramm jeweils einen Wert "Vermiedenes CO2" an. Er schätzt, wie viel CO2-Ausstoß durch die
Solarstromerzeugung vermieden wurde, verglichen mit dem Bezug der gleichen Strommenge aus dem
deutschen Netz — anhand des vom Umweltbundesamt veröffentlichten jährlichen Emissionsfaktors des
deutschen Strommixes (kg CO2 pro kWh) für das Kalenderjahr, in dem der Ertrag erzielt wurde. Bei
einem Zeitraum über mehrere Jahre (die Gesamt-Ansicht) wird der Beitrag jedes Jahres einzeln
berechnet und aufsummiert, statt einen einzigen Faktor auf die Gesamtsumme anzuwenden. Werte unter
10.000 kg werden in kg angezeigt, ab diesem Wert in Tonnen ("t"). Für das laufende Jahr (und jedes
zukünftige Jahr) liegt noch kein veröffentlichter Faktor vor; bis das Umweltbundesamt den Wert für
dieses Jahr veröffentlicht, wird stattdessen ein fester Ersatzwert (0,363 kg/kWh) verwendet. Dieser
Wert wird vollständig aus bereits geladenen Daten berechnet — es wird keine zusätzliche
Netzwerkanfrage dafür ausgelöst.

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
