# SolarLog Viewer

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

<p align="center">
  <img src="solarlog-viewer.png" alt="Solarlog Viewer" width="120" />
</p>

Statischer Viewer für SolarLog-Datenexporte (HTML/JS/CSS). `web/` ist das einzige Verzeichnis, das
per FTP auf die Synology DiskStation übertragen wird — `web/index.html` ist ein Single-Page-
Dashboard (vanilla ES-Module, Tailwind CSS als statische Build-Datei, ApexCharts) mit aktueller
Leistung und den vier Ertragssummen (Tag/Monat/Jahr/Gesamt) sowie Detailansichten über Hash-Routing
(`#/day/JJJJ/MM/TT`, `#/month/JJJJ/MM`, `#/year/JJJJ`, `#/total`, `#/compare`) sowie eine
"Ereignisse"-Seite (`#/events`) mit jedem Wechselrichter-Status-/Fehlerereignis aus
`web/data/events.js`/`web/data/events_day.js`, filterbar nach Wechselrichter/Tag/Status/Fehler und
sortierbar nach Startzeit/Wechselrichter/Dauer — siehe
[Ereignisse-Seite](#ereignisse-seite) weiter unten. Alle Ansichten teilen sich ein einheitliches
Tailwind-Design in Hell- und Dunkelmodus. Ein responsives Navigationsmenü listet alle Ansichten
und hebt die aktive hervor — auf Desktop-Breiten dauerhaft sichtbar, unterhalb von ~768px als
Hamburger-Menü, nutzbar von 320px bis 2560px Breite ohne horizontales Scrollen. Die Sprachauswahl
(DE/EN) bleibt über Neuladen hinweg erhalten. Die frühere Frameset-Website liegt schreibgeschützt
als `archive/legacy-site.tar.gz` vor (`tar -xzf archive/legacy-site.tar.gz` entpackt sie bei
Bedarf — sie ist nicht mehr Teil des Arbeitsverzeichnisses und wird nirgends mehr ausgeliefert).

Die SolarLog-Daten sind aufgeteilt auf `web/hist/` (eingefrorene historische Daten bis
einschließlich 28.07.2026 vom alten Gerät) und `web/data/` (laufend überschriebene Live-Daten des
seit 29.07.2026 installierten neuen Geräts); die App führt beide zusammen, wenn eine Abfrage diese
Grenze überschreitet — siehe `specs/001-website-modernization/data-model.md`. Die Ansichten für
Monat/Jahr/Gesamt/Dashboard/Startseite sowie das Info-Panel laden ihre `months.js`-/`years.js`-/
`days_hist.js`-Aggregate alle über eine gemeinsame Hilfsfunktion (`fetchFromBothSources`,
`web/js/data/data-source.js`), die jede Datei im Speicher zwischenspeichert
(`web/js/data/fetch-cache.js`), statt sie bei jeder Navigation erneut zu laden: `hist/*` wird für
die Lebensdauer der Seite zwischengespeichert, da es sich nie ändert, `data/*` für
`DATA_REFRESH_INTERVAL_MS`, da das Live-Gerät die Datei nur einmal täglich beim Start neu
schreibt. Ein vollständiges Neuladen der Seite setzt den Cache zurück.

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
der Anlage — sichtbar in jeder Ansicht, nicht nur im Dashboard. Es fragt `data/min_cur.js` (sowie
`days.js`/`months.js` für die Ertragswerte) alle `DATA_REFRESH_INTERVAL_MS` ab (`web/js/config.js`,
Standard 1 Minute) — dieselbe Konstante, die auch die automatische Aktualisierung der Tagesansicht
verwendet (siehe unten), sodass Nav-Leiste und Tagesdiagramm nie auseinanderlaufen.
[Open-Meteo](https://open-meteo.com) wird separat und seltener abgefragt, alle
`WEATHER_REFRESH_INTERVAL_MS` (Standard 10 Minuten) — das Wetter ändert sich nicht minütlich
merklich, eine so häufige Abfrage wie bei den PV-Daten wäre also verschwendet. Eine kleine
pulsierende Anzeige neben dem
Leistungswert skaliert Größe/Geschwindigkeit mit `currentPacW / capacityKwp` (ruhig nahe null,
am aktivsten nahe der konfigurierten Spitzenleistung der Anlage). Neben dem Leistungswert zeigt
das Panel außerdem den aktuellen Wirkungsgrad des Wechselrichters (ΣPAC ÷ ΣPDC, z. B. „1234 W ·
94%“), sofern DC-Eingangsdaten verfügbar und ungleich null sind — andernfalls wird er ausgeblendet
statt eines irreführenden 0%/∞. Die Tagesansicht (`#/day/YYYY/MM/DD`) zeigt denselben Wirkungsgrad
als zweite Kurve auf einer sekundären y-Achse neben der Leistungskurve, mit Lücken überall dort,
wo PDC null oder fehlt, und komplett ausgeblendet für rekonstruierte/archivierte Tage, die nur
eine Ertragskurve besitzen. Das Tagesdiagramm führt außerdem einen einzigen "UDC"-Legendeneintrag
(DC-Stringspannung) mit eigener rechter Achse: eine fette Durchschnittslinie über alle meldenden
Strings (gemittelt statt summiert — eine Summe würde einen unplausiblen Wert über 1000 V ergeben)
mit einem weichen, dahinterliegenden Band, das für jeden Punkt die Spanne zwischen Min- und
Max-Wert der Strings zeigt. Intern sind das zwei ApexCharts-Serien (ein rangeArea-Band plus eine
Linie), aber die eigene Legendenzeile des Bands ist ausgeblendet (über eine CSS-Regel anhand seines
Legenden-Index zur Laufzeit — siehe `hideUdcRangeLegendEntry` in `web/js/charts/chart-factory.js`)
und seine Sichtbarkeit folgt bei jedem Klick der Linie, sodass beide als ein einziger
Aktivierungspunkt wirken. Standardmäßig ausgeblendet und per Klick auf den Legendeneintrag
einblendbar, an Tagen ohne Spannungsdaten gar nicht erst angeboten. Diese Ein-/Ausblend-Wahl wird
gemerkt (`localStorage`) und beim nächsten Tagesdiagramm übernommen. Der Tooltip zeigt den
Durchschnitt fett mit einer Detailzeile "Min: … / Max: …" darunter, sobald UDC sichtbar ist. Die
drei y-Achsen des Tagesdiagramms (Einspeisung W, Wirkungsgrad %, UDC V) verwenden feste
Wertebereiche/Schrittweiten statt sich an den Tageswerten zu orientieren, damit Tage optisch
vergleichbar bleiben und die Skala beim Blättern nicht springt; die x-Achse orientiert sich
standardmäßig nur an den tatsächlich vorhandenen Daten des Tages (beidseitig um eine konfigurierbare
Minutenzahl gepolstert, damit Anfang/Ende der Linie nicht direkt am Diagrammrand kleben), kann
aber auch fest auf den vollen Tag 00:00–24:00 gestellt werden — alles konfigurierbar über
`DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE` und `DAY_CHART_X_AXIS_PADDING_MINUTES` in
`web/js/config.js`. Die Balkendiagramme für Monat/Jahr/Gesamt (Lebenszeit) bieten einen gespeicherten Umschalter
"Gesamt" / "Wechselrichter" oberhalb des Diagramms: "Gesamt" (Standard) zeigt wie bisher einen
einzelnen Summenbalken; "Wechselrichter" stapelt stattdessen je einen Abschnitt pro
Wechselrichter-String, mit Gesamtsumme plus Einzelwerten pro String im Tooltip. Die Auswahl wird
(`localStorage`) über Reloads und zwischen den drei Ansichten hinweg gemerkt. Der Klick-Drilldown
funktioniert in beiden Ansichten weiterhin auf jedem Balken/Abschnitt. Ein Klick auf den Wetter-/
Prognosebereich öffnet eine wetteronline.de-Suche für die konfigurierte Adresse der Anlage in
einem neuen Tab — die übliche Wetterquelle des Anlagenbetreibers. Leistung und Wetter/Prognose
zeigen jeweils unabhängig einen "nicht verfügbar"-Zustand an, falls die jeweilige Datenquelle
nicht abgerufen werden kann, ohne den anderen Bereich zu beeinträchtigen. Siehe
`specs/010-global-info-panel/` für die vollständige Spezifikation/Planung.

Die Tagesansicht (`#/day/YYYY/MM/DD`) aktualisiert sich auf dieselbe Art, solange sie _den
heutigen Tag_ zeigt: alle `DATA_REFRESH_INTERVAL_MS` (dieselbe Konstante, die auch das Infopanel
oben verwendet) fragt sie `min_day.js` erneut ab und zeichnet Statistikpanel, Diagramm
und Datentabelle direkt neu — die Seite kann so stundenlang geöffnet bleiben (z. B. auf einem
Wandmonitor) und zeigt neue Messwerte ohne manuelles Neuladen. Vergangene Tage werden nicht
abgefragt, da ihre min-Dateien nach der Archivierung statisch sind. Ein fehlgeschlagener
Aktualisierungsversuch wird stillschweigend übersprungen — der zuletzt bekannte gute Wert bleibt
sichtbar, statt die Ansicht zu leeren. Die Startseite (`#/`, „Anlageninfo“) aktualisiert ihr
Tagesdiagramm und die Statistikkarte im selben `DATA_REFRESH_INTERVAL_MS`-Takt, sodass alle drei
„live“ Bereiche — Nav-Leiste, Tagesdiagramm, Startseite — immer gleich aktuell sind.

## Ereignisse-Seite

`#/events` zeigt jedes Wechselrichter-Status-/Fehlerereignis als eine dedupliziert Tabelle,
neueste zuerst — historisches Archiv (`web/data/events.js`) und aktueller Tag
(`web/data/events_day.js`) werden zusammengeführt. Ein Ereignis ohne Endzeit (das jüngste des
aktuellen Tages) zeigt statt einer leeren Zelle ein pulsierendes „aktiv“-Badge. Status-/
Fehlercodes werden pro Wechselrichter über `StatusCodes[]`/`FehlerCodes[]` in
`web/data/base_vars.js` aufgelöst (derselbe Zahlencode bedeutet bei WR1 etwas anderes als bei
WR2); ein Statuscode außerhalb des bekannten Bereichs fällt auf „Offline“ zurück, ein unbekannter
Fehlercode zeigt seinen rohen Zahlenwert. Vier Dropdown-Filter (Wechselrichter/Tag/Status/Fehler,
kombinierbar, mit entfernbaren Chips und einer Zurücksetzen-Schaltfläche) grenzen die Tabelle ein,
ohne neu zu laden; die Spaltenköpfe Von–Bis/WR/Dauer sortieren (Klick wechselt die Richtung)
innerhalb der aktuell gefilterten Menge. Siehe `web/js/data/events.js` (Parsen/Zusammenführen/
Deduplizieren/Label-Auflösung, ohne DOM) und `web/js/views/events-view.js` (Rendering +
Filter-/Sortierzustand).

## Erklär-Tooltips

Zeilen im Statistik-Panel (Tages-/Monats-/Jahres-/Gesamt-/Willkommensansicht) können neben ihrem
Label eine kleine, fokussierbare „i“-Schaltfläche tragen. Auf dem Desktop öffnet Hover oder
Tastatur-Fokus ein kurzes Tooltip, das erklärt, wie genau dieser Wert berechnet wird; auf reinen
Touch-Geräten wird die Schaltfläche gar nicht erst gerendert (`@media (hover: hover) and
(pointer: fine)` in `web/css/app.css`), sodass das mobile Layout nie beeinflusst wird. Die
gesamte Rendering-/Positionierungslogik (einschließlich des Kipp-Verhaltens am Bildschirmrand,
das ein Abschneiden des Tooltips verhindert) liegt zentral in `web/js/views/stats-panel.js` — kein
Ansichtsmodul baut dieses Markup selbst.

Um einen neuen Wert zu erklären, sind keine Änderungen an `stats-panel.js` nötig:

1. Einen `explanations.<key>`-Eintrag (deutscher + englischer Text) in `web/i18n/de.json` und
   `web/i18n/en.json` hinzufügen, neben den übrigen UI-Texten.
2. In der Zeilen-Builder-Funktion der Ansicht (z. B. `monthStatsRows()` in
   `web/js/views/month-view.js`) den i18n-Key als drittes Element an das Zeilen-Tupel anhängen:
   `[labelKey, value, 'explanations.<key>']`. Eine Zeile mit nur `[labelKey, value]` wird
   weiterhin genau wie bisher gerendert — die Erklärung ist pro Zeile optional.

Derselbe `explanations.<key>` kann über mehrere Ansichten hinweg wiederverwendet werden (z. B.
bedeutet „Soll“ in der Tages-, Monats-, Jahres- und Gesamtansicht dasselbe) — der i18n-Eintrag
wird einmal gepflegt, und jede Ansicht, die ihn referenziert, aktualisiert sich mit. Siehe
`specs/020-explanatory-tooltips/` für die vollständige Spezifikation/den Plan/den Contract.

## Entwicklungsserver

```bash
npm install
npm run start
npm run open
```

Startet den Dev-Server unter http://localhost:3000 — Einstiegspunkt ist `web/index.html`. `npm start`
startet die Tailwind-CLI im `--watch`-Modus parallel zu `browser-sync`, sodass auch CSS-Änderungen
per Hot-Reload übernommen werden. Mit `npm run open` wird der Viewer im Standardbrowser geöffnet.

`bs-config.cjs` leitet jede `/data/*`- und `/hist/*`-Anfrage direkt an das aktive SolarLog-Gerät
unter `https://wolfsbach.synology.me` weiter, statt sie von der Festplatte zu bedienen — der
Dev-Server zeigt so immer aktuelle Messwerte, ganz ohne lokale Kopie. `web/data/` und `web/hist/`
existieren in diesem Repo (egal welcher Checkout) nicht mehr — sie waren der eigene Live-/
eingefrorene Datenspiegel des Geräts und wurden gelöscht; das Gerät liefert sie direkt aus, und
`npm start` leitet einfach dorthin weiter. Auch `scripts/ftp-sync.js` (und das `sync-ftp`-Skill)
fassen `data`/`hist` nicht mehr an — siehe
[Validierungs- und Aggregationsskripte](#validierungs--und-aggregationsskripte) weiter unten, was
das für die Skripte bedeutet, die diese Verzeichnisse bisher von der Festplatte gelesen haben. Das
eingefrorene historische Archiv, das früher unter `web/hist/` lag, ist als
`archive/web-hist.tar.gz` erhalten (`tar -xzf archive/web-hist.tar.gz -C web` entpackt es bei
Bedarf wieder nach `web/hist/` für eines dieser Skripte).

`npm run build:css` kompiliert `web/css/tailwind.css` zur eingecheckten statischen Datei
`web/css/tailwind.generated.css`, die produktiv genutzt wird — kein CDN-/Runtime-Skript.

## Produktions-Build & Deploy

`npm run build` (`scripts/build.js`) erzeugt `dist/`, den Baum, der tatsächlich per FTP übertragen
wird — `web/` selbst dient nur noch als vom Dev-Server ausgelieferte Quelle, nicht als das, was
ausgeliefert wird. Der Build bündelt und minifiziert den gesamten JS-Importgraphen zu einer
einzigen `js/main-<sha>.js` sowie die drei Stylesheets zu einer einzigen `css/styles-<sha>.css`
(`<sha>` = der aktuelle git-Short-SHA) und schreibt `dist/index.html` so um, dass sie darauf
verweist — das ist der Cache-Busting-Fix: jedes Deployment erhält frische, nie zuvor gesehene
Asset-URLs, sodass Browser nach einem Update keine veraltete zwischengespeicherte Kopie mehr
ausliefern können. `i18n/*.json`, `img/plant/*.jpg` und `vendor/*.svg` werden unverändert
kopiert, aber statt einer Umbenennung mit einem `?v=<sha>`-Query-String cache-gebustet, da diese
Pfade zur Laufzeit referenziert werden statt zur Build-Zeit bekannt zu sein. `dist/` enthält kein
`data`/`hist`-Verzeichnis oder Symlink mehr — das Gerät verwaltet diese selbst, dieses Projekt
fasst sie überhaupt nicht mehr an. `npm run build` vor dem Synchronisieren ausführen;
`scripts/ftp-sync.js` (und das `sync-ftp`-Skill) vergleichen/übertragen `dist/`, nicht `web/`, und
auch dort nur die eigenen Anwendungs-Assets — `data`/`hist` sind für diese Skripte kein Thema mehr.

## Frontend-Tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test-Unit-Tests für web/js/data/*-Parser und web/js/**
npm run lint
npm run format:check
```

## Datendateien

Die `min*.js`-Dateien (eine pro Tag, ~7000+ Dateien) enthalten die vom SolarLog-Gerät exportierten Rohdaten. Die `days*.js`- und `days_hist*.js`-Dateien enthalten aggregierte Tages-/Monatsübersichten. Diese liegen auf dem SolarLog-Gerät (`web/data/` aktuell, `web/hist/` eingefroren-historisch) und werden im Arbeitsverzeichnis dieses Repos nicht mehr gespiegelt — siehe [Dev-Server](#dev-server) oben.

## Validierungs- und Aggregationsskripte

> **⚠️ Ohne manuelle Vorbereitung derzeit nicht nutzbar.** Jedes der folgenden Skripte liest
> `web/data/`/`web/hist/` direkt vom Dateisystem, aber beide Verzeichnisse wurden aus dem Repo
> gelöscht (siehe [Dev-Server](#dev-server)), und `scripts/ftp-sync.js`/`sync-ftp` holen sie nicht
> mehr nach. Um eines dieser Skripte auszuführen, zuerst die benötigten Verzeichnisse manuell
> befüllen — z. B. `tar -xzf archive/web-hist.tar.gz -C web` für `web/hist/`, für die Live-Seite
> einen manuellen FTP-/SCP-Kopiervorgang des `data`-Ordners vom Gerät nach `web/data/` — und
> anschließend wieder löschen.

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
