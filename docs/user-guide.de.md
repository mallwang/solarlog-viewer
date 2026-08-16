# Benutzerhandbuch: SolarLog Viewer

Deutsch · [English](user-guide.md)

Dieses Handbuch beschreibt die Nutzung des veröffentlichten SolarLog-Viewer-Dashboards. Wenn Sie
das Projekt lokal ausführen oder mit den Validierungs-/Aggregationsskripten arbeiten möchten,
siehe stattdessen das [README](../README.de.md) und das
[Entwicklerhandbuch](developer-guide.md) (Englisch).

## Inhaltsverzeichnis

1. [Dashboard-Navigation & Diagramme](#dashboard-navigation--diagramme)
2. [Ereignisse-Seite](#ereignisse-seite)
3. [Dynamischer Himmel-Hintergrund](#dynamischer-himmel-hintergrund)
4. [Globales Desktop-Infopanel](#globales-desktop-infopanel)
5. [Automatische Aktualisierung der Tagesansicht & Startseite](#automatische-aktualisierung-der-tagesansicht--startseite)
6. [Vermiedenes CO2](#vermiedenes-co2)
7. [Erklär-Tooltips](#erklär-tooltips)

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

| Diagrammelement                                        | Verhalten                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legendeneintrag UDC (V) (Tagesansicht)                 | Standardmäßig ausgeblendet. Ein Klick blendet eine fette Durchschnittslinie über alle meldenden Strings ein (gemittelt, nicht summiert) mit einem schattierten Min/Max-Band; erneuter Klick blendet beides wieder aus. Wahl wird über Reloads und andere Tage gemerkt. Fehlt an Tagen ohne Spannungsdaten. |
| y-Achsen der Tagesansicht                              | Einspeisung (W), Wirkungsgrad (%) und UDC (V) verwenden unabhängig vom Tag stets denselben festen Wertebereich/dieselbe Gitterlinien-Schrittweite, damit Tage vergleichbar bleiben und die Skala beim Blättern nicht springt.                                                                              |
| x-Achse der Tagesansicht                               | Zoomt standardmäßig auf die tatsächlichen Daten des Tages (kleine Polsterung an beiden Enden); eine Admin-Person kann fest auf den vollen Tag 00:00–24:00 umstellen über `DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE` und `DAY_CHART_X_AXIS_PADDING_MINUTES` in `web/js/config.js`.                          |
| Umschalter Gesamt / Wechselrichter (Monat/Jahr/Gesamt) | "Gesamt" (Standard) zeigt einen Summenbalken pro Zeitraum; "Wechselrichter" stapelt einen Abschnitt pro String, mit Gesamtsumme plus Einzelwerten im Tooltip. Wird über Reloads gemerkt und zwischen den drei Ansichten geteilt. Drilldown per Klick funktioniert in beiden Modi.                          |

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
nur im Dashboard — die aktuelle Leistung der Anlage zusammen mit dem aktuellen Wetter und der
Restprognose für den heutigen Tag am Standort der Anlage. Die Leistung (sowie „Tagesertrag“/
„Monatsertrag“) aktualisiert sich nach demselben Zeitplan wie das Diagramm der Tagesansicht
(siehe „Automatische Aktualisierung der Tagesansicht & Startseite“ unten) — eine gemeinsame
Einstellung, damit beide nie auseinanderlaufen. Der Wetter-/Prognosebereich aktualisiert sich
separat und seltener (standardmäßig alle ~10 Minuten), da sich das Wetter nicht minütlich merklich
ändert. Ein kleiner pulsierender Punkt neben dem Leistungswert wird größer und pulsiert schneller,
je näher die aktuelle Leistung an der konfigurierten Spitzenleistung der Anlage liegt, und
beruhigt sich nahe null (z. B. nachts). Neben dem Leistungswert zeigt das Panel den aktuellen
Wirkungsgrad des Wechselrichters (AC-Ausgang ÷ DC-Eingang, z. B. „1234 W · 94%“), sofern
DC-Eingangsdaten verfügbar und ungleich null sind — andernfalls bleibt er ausgeblendet statt eines
irreführenden 0%/∞. Die Tagesansicht (`#/day/YYYY/MM/DD`) zeigt denselben Wirkungsgrad als zweite
Kurve neben der Leistungskurve, mit Lücken überall dort, wo der DC-Eingang null oder unbekannt
ist, und komplett ausgeblendet für rekonstruierte/archivierte Tage, die nur eine Ertragskurve
besitzen. Ein Klick/Tap auf den Wetter-/Prognosebereich öffnet eine wetteronline.de-Suche für die
Adresse der Anlage in einem neuen Tab. Können Leistungs- oder Wetterdaten nicht abgerufen werden,
zeigt der jeweilige Bereich "Nicht verfügbar" an, während der andere Bereich normal weiterarbeitet.
Das Panel ist unterhalb von 768px vollständig ausgeblendet — es beansprucht im mobilen Layout
keinen zusätzlichen Platz.

## Automatische Aktualisierung der Tagesansicht & Startseite

Solange die Tagesansicht (`#/day/YYYY/MM/DD`) den heutigen Tag zeigt, hält sie sich von selbst
aktuell: Sie fragt die Tageswerte regelmäßig erneut ab und zeichnet Statistikpanel, Diagramm und
Datentabelle direkt neu — die Seite kann so stundenlang geöffnet bleiben (z. B. auf einem
Wandmonitor) und zeigt weiterhin neue Messwerte, ganz ohne manuelles Neuladen. Ein fehlgeschlagener
Aktualisierungsversuch wird stillschweigend übersprungen — der zuletzt bekannte gute Wert bleibt
sichtbar, statt die Ansicht zu leeren. Andere Tage als der heutige aktualisieren sich nie
automatisch, da ihre Daten archiviert sind und sich nicht mehr ändern. Die Startseite (`#/`,
„Anlageninfo“) tut dasselbe für ihr Tagesdiagramm und ihre Statistikkarte. Alle drei — die
Leistungs-/Ertragswerte des Infopanels oben, die Tagesansicht und die Startseite — verwenden
dasselbe Aktualisierungsintervall, sodass sie nie unterschiedlich aktuell sind. Es beträgt
standardmäßig 1 Minute und kann von einem Seitenbetreiber über `DATA_REFRESH_INTERVAL_MS` in
`web/js/config.js` geändert werden (der Wetter-/Prognoseabruf des Infopanels hat sein eigenes,
langsameres Intervall, `WEATHER_REFRESH_INTERVAL_MS`).

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
