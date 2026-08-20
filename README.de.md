**Deutsch** · [English](README.md)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

# SolarLog Viewer

<p align="center">
  <img src="solarlog-viewer.png" alt="Solarlog Viewer Icon" width="120" />
</p>

<p align="center">
  <sub>Wolke Sonne bewölkt Wetter Icon by Matt Cooper on <a href="https://icon-icons.com/de/authors/268-matt-cooper">Icon-Icons.com</a></sub>
</p>

SolarLog Viewer ist ein statisches Dashboard für SolarLog-Datenexporte einer Photovoltaikanlage.
Es zeigt die aktuelle Leistung sowie Tages-, Monats-, Jahres-, Gesamt- und
Jahresvergleichsansichten, ein Ereignisprotokoll für Wechselrichter-Status-/Fehlerereignisse, eine
wetterabhängige Himmel-Animation im Hintergrund und ein Desktop-Infopanel, das die aktuelle
Leistung und Prognose der Anlage von überall in der App sichtbar hält. Die gesamte Anwendung läuft
als statisches HTML/JS/CSS ohne Backend — die App ist ein Ordner, der per FTP auf das
Hosting-Gerät übertragen wird.

- Fünf Hash-Routing-Ansichten (Tag/Monat/Jahr/Gesamt/Vergleich) sowie ein Dashboard und eine
  Ereignisse-Seite, alle mit einem einheitlichen, responsiven Tailwind-Design in Hell- und
  Dunkelmodus, nutzbar von 320px-Smartphones bis zu 2560px-Monitoren
- Ein dynamischer Himmel-Hintergrund, der das reale aktuelle Wetter und die Tageszeit der Anlage
  widerspiegelt
- Ein dauerhaftes Desktop-Infopanel mit aktueller Leistung, Wetter und Prognose
- Eine "Statistik"-Seite mit Bestwerten und Langzeittrends (bester/schwächster Monat & Jahr,
  Kalender-Heatmaps, Ertragsserien, Jahresvergleichs-/Lebenszeit-/Degradationstrends), komplett
  berechnet aus bereits geladenen Aggregatdaten
- Eine "Ereignisse"-Seite mit jedem Wechselrichter-Status-/Fehlerereignis, filter- und sortierbar
- Erklär-Tooltips an Statistikwerten, die genau erläutern, wie jeder Wert berechnet wird
- Deutsch/Englisch als UI-Sprache, bleibt über Neuladen hinweg erhalten

Die vollständige Anleitung zur Nutzung des Dashboards — Navigation, Diagramme, Ereignisse,
Tooltips — steht im [Benutzerhandbuch](docs/user-guide.de.md).

## Live Application

https://wolfsbach.synology.me

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
weiter, statt sie von der Festplatte zu bedienen — der Dev-Server zeigt so immer aktuelle
Messwerte, ganz ohne lokale Kopie. `web/data/` und `web/hist/` existieren in diesem Repo nicht
mehr. Siehe
[Validierungs- und Aggregationsskripte](#validierungs--und-aggregationsskripte) weiter unten, was
das für Skripte bedeutet, die diese Verzeichnisse von der Festplatte lesen.

`npm run build:css` kompiliert `web/css/tailwind.css` zur eingecheckten statischen Datei
`web/css/tailwind.generated.css`, die produktiv genutzt wird — kein CDN-/Runtime-Skript.

## Produktions-Build & Deploy

`npm run build` (`scripts/build.js`) erzeugt `dist/`, den Baum, der tatsächlich per FTP übertragen
wird — `web/` selbst dient nur als vom Dev-Server ausgelieferte Quelle, nicht als das, was
ausgeliefert wird. Der Build bündelt und minifiziert den gesamten JS-Importgraphen und die
Stylesheets zu cache-gebusteten, SHA-markierten Dateien und schreibt `dist/index.html` so um, dass
sie darauf verweisen — so erhält jedes Deployment frische, nie zuvor gesehene Asset-URLs, und
Browser können nach einem Update keine veraltete Kopie mehr ausliefern. `npm run build` vor dem
Synchronisieren ausführen; `scripts/ftp-sync.js` (und das `sync-ftp`-Skill) vergleichen/übertragen
`dist/`, nicht `web/`, und nur die eigenen Anwendungs-Assets.

## Dynamischer Himmel-Hintergrund

Die animierte Wolkenkulisse hinter dem Dashboard spiegelt das reale aktuelle Wetter und die
Ortszeit der Anlage wider, statt immer gleich auszusehen — Wolkendichte, ein Sonne/Mond-Bogen über
den Himmel und gelegentliche fliegende Objekte (Vögel, Flugzeuge, Ballons, eine seltene Rakete)
reagieren alle alle 15 Minuten auf die realen Bedingungen. Bei jedem Fehler (keine Position, kein
Netzwerk) fällt die Ansicht stillschweigend auf die ursprüngliche statische Kulisse zurück, und
"Bewegung reduzieren"-Einstellungen unterdrücken die Animation, während weiterhin reale
Bedingungen über statische Hinweise gezeigt werden. Siehe `specs/007-dynamic-sky-weather/` für die
vollständige Spezifikation/Planung.

## Globales Desktop-Infopanel

Ein dauerhaftes Panel im Header, sichtbar ab Desktop-Breiten, zeigt die aktuelle Leistung der
Anlage sowie kompakte Icon-über-Temperatur-Anzeigen für das aktuelle Wetter und eine Prognose
(für heute, ab 18:00 Uhr Ortszeit für morgen) — Bedingung und Tagespräfix erscheinen als
Sprechblase bei Hover/Fokus/Tap — aus jeder Ansicht, nicht nur dem Dashboard. Es hält seine
Leistungs-/Ertragswerte synchron mit der automatischen Aktualisierung des Tagesdiagramms, und das
Wetter aktualisiert sich separat und seltener. Siehe `specs/010-global-info-panel/`,
`specs/023-weather-panel-icons/` und `specs/025-weather-icon-compact/` für die vollständige
Spezifikation/Planung.

## Ereignisse-Seite

`#/events` zeigt jedes Wechselrichter-Status-/Fehlerereignis als eine dedupliziert Tabelle,
neueste zuerst — historisches Archiv und der aktuelle Tag werden zusammengeführt. Vier
kombinierbare Dropdown-Filter grenzen die Tabelle ein, und die Spalten Von–Bis/WR/Dauer sortieren
per Klick. Siehe [Ereignisse-Seite](docs/user-guide.de.md#ereignisse-seite) im Benutzerhandbuch
für die vollständige Beschreibung.

## Erklär-Tooltips

Zeilen im Statistik-Panel der Tages-/Monats-/Jahres-/Gesamt-/Willkommensansicht können eine
kleine, fokussierbare „i“-Schaltfläche tragen, die ein kurzes Tooltip mit der genauen Berechnung
des Werts einblendet — auf reinen Touch-Geräten komplett ausgeblendet, da dort nicht nützlich.
Siehe `specs/020-explanatory-tooltips/` für die vollständige Spezifikation/den Plan/den Contract.

## Frontend-Tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test-Unit-Tests für web/js/data/*-Parser und web/js/**
npm run lint
npm run format:check
```

## Datendateien

Die `min*.js`-Dateien (eine pro Tag, ~7000+ Dateien) enthalten die vom SolarLog-Gerät exportierten
Rohdaten. Die `days*.js`- und `days_hist*.js`-Dateien enthalten aggregierte Tages-/
Monatsübersichten. Diese liegen auf dem SolarLog-Gerät (`web/data/` aktuell, `web/hist/`
eingefroren-historisch) und werden im Arbeitsverzeichnis dieses Repos nicht mehr gespiegelt —
siehe [Entwicklungsserver](#entwicklungsserver) oben.

## Validierungs- und Aggregationsskripte

Skripte zum Erkennen von Datenlücken, Validieren von Summen und Reparieren aggregierter Dateien
liegen in `scripts/` und sind im [Entwicklerhandbuch](docs/developer-guide.md) dokumentiert,
einschließlich der manuellen Vorbereitung, die vor ihrer Ausführung nötig ist (`web/data`/
`web/hist` existieren in diesem Repo nicht mehr).

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

## Releases

Releases folgen [Conventional Commits](https://www.conventionalcommits.org/) und
[Semantic Versioning](https://semver.org/). `npm run release` (auf Basis von
[release-it](https://github.com/release-it/release-it) mit
`@release-it/conventional-changelog`) erhöht die Version in `package.json`, erzeugt
`CHANGELOG.md` neu aus den Commits seit dem letzten Tag und legt ein `vX.Y.Z`-Git-Tag
an — es wird nicht auf npm veröffentlicht, kein Docker-Image gepusht, und es wird
weder gebaut noch deployt. Für Maintainer führt das begleitete `release`-Skill in
Claude Code (`/release`) durch eine Dry-Run-Vorschau, eine Bestätigungsabfrage, das
eigentliche Release und formatierte GitHub-Release-Notes zum manuellen Einfügen.
Siehe `.claude/skills/release/SKILL.md` für den vollständigen Ablauf. Nach dem
Release `npm run build` und das `sync-ftp`-Skill ausführen, um tatsächlich zu
deployen.

## Lizenz

MIT — siehe [LICENSE.md](LICENSE.md).
