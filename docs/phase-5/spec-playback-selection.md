# Spezifikation: Selection-gesteuertes Playback

## Zweck

Diese Spezifikation beschreibt einen klar abgegrenzten Arbeitsschritt innerhalb von
Phase 5.7 `MIDI-Player`:

- die Wiedergabe soll die zentrale Selection als fachlichen Start- oder Bereichsbezug
  verwenden

Sie dient bewusst als kleines Arbeitspaket, damit weitere Implementierungsschritte
nicht wieder unkontrolliert zwischen Selection, Commands, Preview und Audio-Details
vermischen.

## Kontext

In `apps/web` existieren bereits:

- eine zentrale Selection
- Projektionen in Editor, Harfenvorschau und Score-Vorschau
- ein Playback-Ablaufmodell auf Basis des expandierten musikalischen Ablaufs
- ein Audio-Adapter für die eigentliche Tonerzeugung

Der noch offene Punkt ist die fachlich saubere Kopplung zwischen Selection und
Playback-Startverhalten.

Die Grundidee aus Phase 5 bleibt:

- Selection wird auf dem notierten Material definiert
- Playback arbeitet auf dem expandierten Ablauf
- die Projektion von Selection auf Playback erfolgt zentral und nicht panelspezifisch

## Ziel

Die Wiedergabe soll von der aktuellen zentralen Selection gesteuert werden, unabhängig
davon, ob diese aus dem ABC-Editor, der Score-Vorschau oder der Harfenvorschau stammt.

## Nicht-Ziele

Diese Spezifikation fordert nicht:

- neue Audio-Engines oder neue Instrumente
- eine neue globale Shortcut-Architektur
- Mehrfach- oder disjunkte Selektionen als ersten Ausbauschritt
- neue Selection-Typen außerhalb der bereits vorhandenen zentralen Selection
- vollständige Legacy-Parität für alle historischen Player-Sonderfälle

## Fachliche Anforderungen

### 1. Zentrale Selection ist maßgeblich

Playback darf fachlich nicht davon abhängen, aus welcher View die Selection stammt.

Das bedeutet:

- Editor-Selektion, Score-Selektion und Harfen-Selektion speisen dieselbe zentrale
  Selection
- Playback liest diese gemeinsame Selection
- panelspezifische Sonderlogik für den Wiedergabebereich ist nicht zulässig

### 2. Drei Playback-Fälle

Für das Startverhalten gibt es genau drei Fälle:

- keine Selection
- Punktselektion
- Bereichsselektion

Die Bedeutung ist:

- keine Selection
  - das ganze Stück im expandierten Ablauf spielen
- Punktselektion
  - ab der ersten passenden Ablaufstelle der gewählten notierten Entity spielen
- Bereichsselektion
  - nur Ablauf-Events spielen, deren notierter Ursprung innerhalb des gewählten
    Bereichs liegt

### 3. Bezug auf notiertes Material

Die Auswahl für Playback bezieht sich auf das notierte Material, nicht direkt auf
bereits expandierte Playback-Durchläufe.

Das bedeutet:

- Wiederholungen und Volten werden weiterhin durch den expandierten Ablauf bestimmt
- dieselbe notierte Entity kann im Ablauf mehrfach vorkommen
- Bereichs-Playback darf deshalb im Ablauf mehrere Treffer derselben notierten
  Selection enthalten, wenn dies musikalisch aus Wiederholungen folgt

### 4. Extract- und Stimmenbezug bleibt erhalten

Selection-gesteuertes Playback darf nicht die bereits eingeführten Regeln für aktive
Extract-Stimmen umgehen.

Das bedeutet:

- bei Scope `extract-voices` bleibt die aktive Extract-Auswahl wirksam
- bei Scope `all-voices` darf Playback nicht künstlich auf den Extract reduziert
  werden
- bei Scope `single-voice` gilt die Ursprungsauswahl der Selection
- die Selection schränkt den Ablauf zusätzlich ein, ersetzt aber nicht die
  Scope-Logik der zentralen Selection

### 5. Highlighting bleibt getrennt

Playback-Highlight und Benutzer-Selection bleiben getrennte Zustände.

Das bedeutet:

- die laufende Wiedergabe darf die Benutzer-Selection nicht überschreiben
- das Playback-Highlight folgt dem aktuell abgespielten Ablauf
- nach Stop bleibt die Benutzer-Selection erhalten

## Architekturvorgaben

### Zuständigkeit

- der `SelectionStore` bleibt Träger des transienten Auswahlzustands
- die Ableitung von Playback-Umfang oder Playback-Start erfolgt zentral in der
  Playback-Orchestrierung
- Views liefern Selection-Ereignisse ein, entscheiden aber nicht selbst über den
  Playback-Scope
- die Playback-Orchestrierung arbeitet auf der zentralen Selection inklusive
  ihrer Scope-Semantik

### Trennung

- Selection-Logik bleibt von Audio-Ausgabe getrennt
- die Audio-Schicht spielt die bereits aufgelösten Playback-Schritte ab
- View-spezifische `source`-Information darf nicht die fachliche Wahrheit des
  Playback-Modus bestimmen

## Akzeptanzkriterien

Die Umsetzung gilt für dieses Arbeitspaket als ausreichend, wenn:

1. Wiedergabe ohne Selection weiterhin das ganze Stück spielt
2. Wiedergabe mit Punktselektion ab der ersten passenden Ablaufstelle startet
3. Wiedergabe mit Bereichsselektion nur den gewählten Bereich spielt
4. dieselbe Logik für Selection aus Editor, Score und Harfe gilt
5. aktive Extract-Stimmen weiter korrekt berücksichtigt werden
6. Playback-Highlight und Benutzer-Selection getrennt bleiben

## Offene Punkte

- Ob Kommandos wie `selection.play` und `selection.playFrom` direkt benannt in die
  neue Command-Oberfläche übernommen werden, ist ein angrenzendes, aber separates
  Thema.
- Mehrsegment-Selection oder disjunkte Bereiche sind nicht Teil dieses ersten
  Arbeitspakets.
- Eine mögliche spätere Policy wie `first-occurrence-only` gegenüber
  `all-occurrences` bleibt eine spätere Erweiterung.
