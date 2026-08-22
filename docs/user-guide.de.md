# Benutzerhandbuch: SolarLog Viewer

Deutsch · [English](user-guide.md)

Dieses Handbuch beschreibt die Nutzung des veröffentlichten SolarLog-Viewer-Dashboards. Wenn Sie
das Projekt lokal ausführen oder mit den Validierungs-/Aggregationsskripten arbeiten möchten,
siehe stattdessen das [README](../README.de.md) und das
[Entwicklerhandbuch](developer-guide.md) (Englisch).

## Inhaltsverzeichnis

1. [Dashboard-Navigation & Diagramme](#dashboard-navigation--diagramme)
2. [Statistik-Seite](#statistik-seite)
3. [Ereignisse-Seite](#ereignisse-seite)
4. [Dynamischer Himmel-Hintergrund](#dynamischer-himmel-hintergrund)
5. [Globales Desktop-Infopanel](#globales-desktop-infopanel)
6. [Automatische Aktualisierung der Tagesansicht & Startseite](#automatische-aktualisierung-der-tagesansicht--startseite)
7. [Vermiedenes CO2](#vermiedenes-co2)
8. [Erklär-Tooltips](#erklär-tooltips)

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

Dieses Handbuch selbst ist bei jeder Bildschirmbreite über ein eigenständiges Dokument-Icon im
Header erreichbar, direkt links neben dem Transparenz-Umschalter — nicht über die Navigationsliste,
sodass es immer nur einen Klick entfernt ist, ohne vorher das Burger-Menü zu öffnen.

| Diagrammelement                                        | Verhalten                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legendeneintrag UDC (V) (Tagesansicht)                 | Standardmäßig ausgeblendet. Ein Klick blendet eine fette Durchschnittslinie über alle meldenden Strings ein (gemittelt, nicht summiert) mit einem schattierten Min/Max-Band; erneuter Klick blendet beides wieder aus. Wahl wird über Reloads und andere Tage gemerkt. Fehlt an Tagen ohne Spannungsdaten. |
| y-Achsen der Tagesansicht                              | Einspeisung (W), Wirkungsgrad (%) und UDC (V) verwenden unabhängig vom Tag stets denselben festen Wertebereich/dieselbe Gitterlinien-Schrittweite, damit Tage vergleichbar bleiben und die Skala beim Blättern nicht springt.                                                                              |
| x-Achse der Tagesansicht                               | Zoomt standardmäßig auf die tatsächlichen Daten des Tages (kleine Polsterung an beiden Enden); eine Admin-Person kann fest auf den vollen Tag 00:00–24:00 umstellen über `DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE` und `DAY_CHART_X_AXIS_PADDING_MINUTES` in `web/js/config.js`.                          |
| Umschalter Gesamt / Wechselrichter (Monat/Jahr/Gesamt) | "Gesamt" (Standard) zeigt einen Summenbalken pro Zeitraum; "Wechselrichter" stapelt einen Abschnitt pro String, mit Gesamtsumme plus Einzelwerten im Tooltip. Wird über Reloads gemerkt und zwischen den drei Ansichten geteilt. Drilldown per Klick funktioniert in beiden Modi.                          |

## Statistik-Seite

`#/statistics` ("Statistik" in der Navigation, zwischen "Gesamt" und "Ereignisse") ist eine
zweigeteilte Seite mit Bestwerten und Langzeittrends, komplett berechnet aus der bereits
aufgezeichneten Historie der Anlage — es werden keine zusätzlichen Daten geladen, außer denen,
die eine Sitzung, die bereits Monat/Jahr/Gesamt geöffnet hat, ohnehin schon heruntergeladen hat.
Eine linke Themen-Navigation listet fünf Themen, jedes mit eigenem, teil-/lesezeichenfähigem Link:

Bei "rückgefüllten" Tagen gibt es zwei Varianten, die in den folgenden Themen wieder auftauchen —
siehe Heatmaps unten für die vollständige Erklärung. Kurz gefasst: Die meisten rückgefüllten Tage
haben eine echte, vom Gerät erfasste Tagessumme und haben nur ihren minutengenauen Leistungsverlauf
verloren; ein schmaler Datumsbereich (die Wechselrichter-Ausfalllücke 2026) hat dagegen eine
_geschätzte_ Tagessumme, gleichmäßig verteilt auf seine Tage aus einer einzelnen manuellen
Zählerablesung.

- **Allgemein** — ein 8-Kachel-Raster mit Bestwerten: bester/schwächster Monat & Jahr, der
  höchste je erfasste Tages-Spitzenwert, der Tag mit dem höchsten "Ist %", sowie der Tag mit der
  höchsten CO2-Ersparnis bzw. dem höchsten Erlös. Jede Kachel verlinkt zur passenden
  Tages-/Monats-/Jahresansicht. Die Kachel zur maximalen Tagesleistung trägt einen kleinen
  Hinweis: es ist der erfasste Tages-Spitzenwert, nicht an eine bestimmte Uhrzeit gebunden. Die
  Kachel zum schwächsten Jahr schließt das laufende (noch nicht abgeschlossene) Jahr sowie das
  erste (Inbetriebnahme-)Jahr der Anlage aus — beide sind naturgemäß unvollständige Jahre, die
  sonst grundlos immer als "schwächstes Jahr" gewinnen würden — als Hinweis in einem Tooltip auf
  der Kachel vermerkt. Die Kachel zur maximalen Tagesleistung ignoriert jeden rückgefüllten Tag
  (dessen Spitzenwert liest sich als 0, unabhängig von der echten Leistung an diesem Tag). Die
  Kacheln zu Ist %/CO2/Erlös sowie die Tagesertrag-Kachel unter Bestwerte vs. Tiefstwerte
  vertrauen der echten Tagessumme eines rückgefüllten Tages und ignorieren nur den schmaleren
  Bereich mit geschätzter Tagessumme — ein Tag mit echtem, bekanntem Ertrag kann also weiterhin
  einen Rekord "gewinnen".
- **Heatmaps** — eine Jahresauswahl oberhalb dreier Kalender-Heatmaps (Energie/kWh, Erlös/€,
  CO2/kg), eine Zelle pro Tag, Farbintensität relativ zum Minimum/Maximum dieses Jahres. Ein Tag
  ohne erfasste Daten wird als schraffiertes Muster dargestellt, immer visuell unterscheidbar von
  einer echten erfassten Null. Ein rückgefüllter Tag behält seine echte Farbe (der Wert bleibt
  sichtbar), bekommt aber zusätzlich ein schwarz/weißes Diagonalstreifen-Muster und einen
  Legendeneintrag "rückgefüllt"; beim Hovern zeigt der Tooltip, um welche der beiden Varianten es
  sich handelt — "rückgefüllt, Tagessumme real (Leistungsverlauf rekonstruiert)" für die meisten,
  oder "rückgefüllt, geschätzt (monatliche Zählerablesung gleichmäßig auf die Tage verteilt)" für
  die Wechselrichter-Ausfalllücke 2026.
- **Serien** — zwei Karten: die längste Serie aufeinanderfolgender Tage mit jeweils mindestens
  20 kWh Ertrag ("Ertragsstark"), und die längste Serie mit jeweils unter 5 kWh Ertrag
  ("Ertragsschwach"), jeweils mit einem "läuft noch"-Abzeichen, falls diese Serie noch aktiv ist.
  Jede Karte zeigt einen Streifen der Serie eigener Tage (plus zwei Kontexttage an jedem Ende) —
  beim Hovern eines Tages erscheint der genaue Ertrag, ein Klick springt zur Tagesansicht. Die
  echte Tagessumme eines rückgefüllten Tages zählt wie bei jedem anderen erfassten Tag für die
  Serien; nur der Bereich mit geschätzter Tagessumme (siehe Heatmaps oben) wird ausgeschlossen, da
  eine Serie durch eine gleichmäßig verteilte Schätzung keine echte Tag-zu-Tag-Schwankung
  widerspiegeln würde. Tage aus diesem Bereich tauchen im Kontextstreifen trotzdem auf, mit dem
  "geschätzt"-Hinweis im Tooltip.
- **Trends** — drei Diagramme: Jahresvergleich des kumulierten Ertrags (ausgerichtet nach Tag im
  Jahr, inklusive rückgefüllter Tage — ihre echte oder geschätzte Tagessumme trägt korrekt zur
  laufenden Summe bei), kumulierte Lebenszeit-Ersparnis in €/CO2 seit Inbetriebnahme,
  sowie spezifischer Ertrag pro Jahr (kWh/kWp) — letzteres trägt einen dauerhaften Hinweis, dass
  von konstanter installierter Leistung ausgegangen wird, ohne Wetter-Normalisierung. Die
  Diagramme für Lebenszeit-Ersparnis und spezifischen Ertrag zeigen zusätzlich zwei "wenn es so
  weitergeht" Prognosejahre über das letzte tatsächliche Jahr hinaus, grau/gestrichelt
  dargestellt, um sich klar von erfassten Daten abzuheben.
- **Bestwerte vs. Tiefstwerte** — dieselben Best-/Tiefstwert-Paare aus dem Thema Allgemein (Monat,
  Jahr, Tagesertrag) nebeneinander dargestellt, jeweils mit eigenem Link, ohne Umschalter.

Heatmaps, Serien und Trends zeigen jeweils einen Platzhalter "Noch nicht genug Daten" anstelle
eines leeren Diagramms, wenn die Anlage für dieses Thema noch nicht genug aufgezeichnete Historie
hat; Allgemein und Bestwerte vs. Tiefstwerte werden immer angezeigt, da schon wenige Tage Historie
einen aussagekräftigen "bisherigen Bestwert" ergeben.

## Ereignisse-Seite

`#/events` ("Ereignisse" in der Navigation, nach "Gesamt") listet jedes erfasste
Wechselrichter-Status-/Fehlerereignis als eine Tabelle, neueste zuerst — das historische Archiv
(`web/data/events.js`) wird mit dem heutigen Protokoll (`web/data/events_day.js`)
zusammengeführt, exakte Duplikate zwischen beiden werden entfernt. Ein noch laufendes Ereignis
(ohne Endzeit) zeigt statt einer leeren Endzeit-Zelle ein kleines pulsierendes „aktiv“-Badge neben
der Startzeit. Jede Zeile zeigt die kombinierte Start–Ende-Zeit ("Von – Bis", das Ende nur als
Uhrzeit, wenn es auf denselben Kalendertag wie der Start fällt), den Wechselrichter (farbiger
Punkt plus WR-Bezeichnung), die Dauer, einen farbigen Status-Pill sowie den Fehler (ein
gedämpfter Strich, wenn keiner vorlag, ein fett-rotes Label, wenn doch).

Die Spaltenköpfe Von–Bis, WR und Dauer sind klickbar und sortieren: ein Klick sortiert nach
dieser Spalte (ein Pfeil im Kopf zeigt die Richtung), ein weiterer Klick kehrt sie um. Das
Sortieren ordnet nur die bereits gefilterten Zeilen um — es ändert nie, welche Ereignisse
angezeigt werden. Auf schmalen Bildschirmen bricht die Filterleiste in mehrere Zeilen um, und die
Tabelle scrollt horizontal innerhalb ihres eigenen Rahmens, statt die Seite zu verbreitern. Passt
keine Kombination zu Ereignissen, erscheint statt einer leeren Tabelle die Meldung „Keine
Ereignisse gefunden“. Die Zählung in der Titelzeile ("401 Ereignisse" bzw. "18 von 401
Ereignissen") zeigt immer, wie viele Zeilen die aktuellen Filter übrig lassen.

| Filter         | Grenzt ein nach              | Kombinierbar | Sortierziel |
| -------------- | ---------------------------- | ------------ | ----------- |
| Wechselrichter | Wechselrichter (WR1, WR2, …) | Ja           | Nein        |
| Tag            | Kalendertag                  | Ja           | Nein        |
| Status         | Status-Pill-Wert             | Ja           | Nein        |
| Fehler         | Fehlercode                   | Ja           | Nein        |

Jeder aktive Filter erscheint zusätzlich als entfernbarer Chip, und „Filter zurücksetzen“ löscht
alle auf einmal.

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
Mond-Zustand weiterhin aktualisiert werden. Vögel werden als animierte Silhouetten-Sprites
dargestellt statt als einfache Form — eine rein optische Verbesserung ohne Konfigurationsbedarf.

## Globales Desktop-Infopanel

Ab Desktop-Breiten (768px und mehr) zeigt ein Panel im Header — sichtbar in jeder Ansicht, nicht
nur im Dashboard — die aktuelle Leistung der Anlage zusammen mit dem aktuellen Wetter und einer
Prognose für den Standort der Anlage. Beide Wetteranzeigen sind kompakt: ein kleines dekoratives
Icon (☀️/⛅/☁️/🌧️/❄️) mit nur der Temperatur (aktuelle Bedingung, z. B. „24°C“) bzw. der
Tiefst-Höchst-Spanne (Prognose, z. B. „15° - 19°“) darunter, getrennt durch eine senkrechte
Trennlinie — nachts zeigt eine „sonnig“-Meldung bei der aktuellen Bedingung stattdessen ein
Mond-Icon statt des Sonnen-Icons. Ein Hover, Fokus (Tastatur) oder Tap (Touch) auf ein Icon zeigt
eine schwebende Sprechblase mit der vollständigen Beschreibung, die früher direkt im Text stand,
z. B. „Regen, 18°C“ für die aktuelle Bedingung oder „Heute: Sonnig (13°C - 19°C)“ für die
Prognose — wechselt ab 18:00 Uhr Ortszeit auf „Morgen:“ (Prognose für den Folgetag); derselbe
vollständige Text steht Screenreadern unabhängig von Hover/Fokus/Tap auch immer als
Accessible-Name des Icons zur Verfügung. Der Leistungswert stammt von einem Live-Status-Endpunkt
mit eigenem, dediziertem Aktualisierungstakt (standardmäßig 1 Minute,
`LIVE_REFRESH_INTERVAL_MS` in `web/js/config.js`), vollständig unabhängig vom Takt von
„Tagesertrag“/„Monatsertrag“ (siehe „Automatische Aktualisierung der Tagesansicht & Startseite“
unten) und vom eigenen, langsameren Takt des Wetter-/Prognosebereichs (standardmäßig alle
~10 Minuten), da sich das Wetter nicht minütlich merklich ändert. Schlägt ein Abruf fehl, zeigt
das Panel weiterhin den zuletzt erfolgreich abgerufenen Leistungswert (samt eigenem Zeitstempel)
an, statt zu leeren oder einzufrieren — nur ein Wert, der noch nie erfolgreich abgerufen wurde,
zeigt „Nicht verfügbar“ — und fragt sofort erneut ab, sobald der Browser-Tab wieder aktiv wird.
Ein kleiner pulsierender Punkt neben dem Leistungswert wird größer und pulsiert schneller, je
näher die aktuelle Leistung an der konfigurierten Spitzenleistung der Anlage liegt, und beruhigt
sich nahe null (z. B. nachts). Die Tagesansicht (`#/day/YYYY/MM/DD`) zeigt einen eigenen
Wirkungsgrad (AC-Ausgang ÷ DC-Eingang) als zweite Kurve neben der Leistungskurve (aus den
minutengenauen Werten dieses Tages), mit Lücken überall dort, wo der DC-Eingang null oder unbekannt
ist, und komplett ausgeblendet für rekonstruierte/archivierte Tage, die nur eine Ertragskurve
besitzen — der Leistungswert im Infopanel selbst zeigt diesen Wirkungsgrad nicht mehr an, da der
Live-Status-Endpunkt diese Detailinformation nicht liefert. Ein Klick/Tap auf den
Wetter-/Prognosebereich öffnet eine wetteronline.de-Suche für die Adresse der Anlage in einem
neuen Tab. Können Leistungs- oder Wetterdaten nicht abgerufen werden, zeigt der jeweilige Bereich
"Nicht verfügbar" an, während der andere Bereich normal weiterarbeitet. Das Panel ist unterhalb
von 768px vollständig ausgeblendet — es beansprucht im mobilen Layout keinen zusätzlichen Platz.

## Automatische Aktualisierung der Tagesansicht & Startseite

Solange die Tagesansicht (`#/day/YYYY/MM/DD`) den heutigen Tag zeigt, hält sie sich von selbst
aktuell: Sie fragt die Tageswerte regelmäßig erneut ab und zeichnet Statistikpanel, Diagramm und
Datentabelle direkt neu — die Seite kann so stundenlang geöffnet bleiben (z. B. auf einem
Wandmonitor) und zeigt weiterhin neue Messwerte, ganz ohne manuelles Neuladen. Ein fehlgeschlagener
Aktualisierungsversuch wird stillschweigend übersprungen — der zuletzt bekannte gute Wert bleibt
sichtbar, statt die Ansicht zu leeren. Andere Tage als der heutige aktualisieren sich nie
automatisch, da ihre Daten archiviert sind und sich nicht mehr ändern. Die Startseite (`#/`,
„Anlageninfo“) tut dasselbe für ihr Tagesdiagramm und ihre Statistikkarte. Alle drei — die
„Tagesertrag“/„Monatsertrag“-Werte des Infopanels oben, die Tagesansicht und die Startseite —
verwenden dasselbe Aktualisierungsintervall, sodass sie nie unterschiedlich aktuell sind. Es
beträgt standardmäßig 1 Minute und kann von einem Seitenbetreiber über `DATA_REFRESH_INTERVAL_MS`
in `web/js/config.js` geändert werden. Der Live-Leistungswert und der Wetter-/Prognoseabruf des
Infopanels haben jeweils ihre eigenen, separaten Intervalle (`LIVE_REFRESH_INTERVAL_MS` bzw.
`WEATHER_REFRESH_INTERVAL_MS` — siehe „Globales Desktop-Infopanel“ oben).

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

## Erklär-Tooltips

Mehrere Werte im Statistikbereich (Tages-/Monats-/Jahres-/Gesamt-/Willkommensansicht) — Ertrag
in €, Soll, Soll (auflaufend), Ist und Vermiedenes CO2 — haben ein kleines „i“-Symbol neben ihrem
Label. Am Desktop öffnet Hover oder Tab-Fokus ein kurzes Tooltip, das genau erklärt, wie dieser
Wert berechnet wird (z. B. ist „Ist“ der tatsächliche Ertrag als Prozentsatz des danebenstehenden
Soll-Werts). Auf reinen Touch-Geräten (Smartphone/Tablet) wird das Symbol gar nicht angezeigt —
ein Tippen darauf hätte keinen sinnvollen Effekt, daher wird es komplett weggelassen statt inaktiv
angezeigt.
