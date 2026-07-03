# Architektur-Issue: Stabile Stimmenidentität statt positionsbasierter Stimmenlogik

## Status

Offen.

Dieses Dokument beschreibt ein bewusst offen gelassenes Architekturproblem.
Es ist noch **keine** umgesetzte ADR-Entscheidung, sondern ein priorisiertes
Architektur-Issue mit Zielbild, Randbedingungen und Migrationspfad.

## Problem

Im aktuellen System existieren mehrere konkurrierende Arten, eine Stimme zu
adressieren:

- Array-Position in `song.voices`
- fachliche Stimmennummer aus Konfiguration und UI
- `voice.index`
- `sheet.activeVoices`
- abgeleitete IDs in Selection und Playback

Das ist besonders fragil, weil im Core aktuell zusätzlich eine Legacy-Dublette
für Stimme 1 existiert:

- `song.voices[0]` ist eine technische Legacy-Dublette
- benutzerrelevante Stimmen beginnen fachlich erst bei `voice.index = 1`

Dadurch entsteht regelmäßig dieselbe Fehlerklasse:

- Selection expandiert auf falsche Stimmen
- Playback spielt falsche Stimmen oder falsche Stimmengruppen
- Extract-Filter und Projektionen laufen auseinander
- UI, Core und später CLI können verschiedene Stimmensichten verwenden

Das Problem ist strukturell. Einzelne Fixes in Selection, Playback oder UI
beheben jeweils nur Symptome.

## Konkreter Auslöser

Beim Stück `0013_jesus-wir-sehen-auf-dich.abc` führte die aktuelle
Mehrdeutigkeit dazu, dass:

- `Auszug 2` fachlich die Stimmen `1, 3, 4` meinte
- Teile der Projektion aber mit intern anderer Stimmennummerierung arbeiteten
- daraus falsche Selection-Erweiterungen und falsche Score-Markierungen
  entstanden

Der konkrete Bug wurde zwar lokal behoben, zeigt aber nur das Grundproblem.

## Ziel

Es soll im gesamten System genau **eine fachliche Stimmenidentität** geben.

Diese Identität muss:

- in Core, Web und CLI gleich verstanden werden
- unabhängig von Array-Positionen sein
- gegenüber Legacy-Sonderfällen stabil bleiben
- in Selection, Playback, Layout und Rendern konsistent verwendet werden

## Zielbild

Fachlich soll eine Stimme über eine stabile Stimmen-ID adressiert werden.

Mindestanforderungen:

- jede benutzerrelevante Stimme hat genau eine stabile fachliche ID
- diese ID ist **nicht** die zufällige Array-Position
- `voice.index` ist die aktuelle fachlich führende Nummer
- technische Legacy-Sonderkonstruktionen dürfen nicht in UI- oder
  Applikationslogik ausstrahlen

Langfristig ist dafür ein Modell mit direktem Lookup nach Stimmen-ID
anzustreben, statt versteckter Ableitung aus Arrays.

## Optionen

### Option A: Array-Modell beibehalten, aber Lookup zentralisieren

`Song.voices` bleibt ein Array.

Zusätzlich wird ein zentraler Stimmen-Lookup etabliert, zum Beispiel:

- `resolveSongVoiceById(song, voiceId)`
- `resolveSongArrayIndexByVoiceId(song, voiceId)`
- `resolveUserVisibleVoiceIds(song)`

Alle fachlichen Pfade verwenden nur noch diese Helfer.

#### Vorteile

- geringe Migrationskosten
- Fixture- und Parity-Strukturen bleiben stabil
- schrittweise Einführung möglich

#### Nachteile

- das zugrundeliegende Array-Modell bleibt missverständlich
- technische Dubletten bleiben im Grundmodell sichtbar
- die Gefahr von Rückfällen bleibt ohne harte Guards bestehen

### Option B: Stimmen intern als Objekt/Registry nach fachlicher ID modellieren

Das Fachmodell verwendet eine stabile Registry oder Map nach Stimmen-ID.

Ein Array wäre dann nur noch:

- ein abgeleiteter View für Legacy-Parity
- oder ein Serialisierungs-/Kompatibilitätsformat

#### Vorteile

- die Fachidentität ist strukturell eindeutig
- Array-basierte Verwechslungen werden deutlich reduziert
- Selection, Playback, Layout und CLI arbeiten auf derselben Identitätsebene

#### Nachteile

- größerer Umbau im Core
- viele bestehende Pfade müssen angepasst werden
- höheres Risiko für breite Seiteneffekte während der Migration

## Empfehlung

Empfohlen wird ein **zweistufiger Migrationspfad**:

### Stufe 1: Fachliche Identität zentralisieren, Datenformat noch nicht brechen

- `Song.voices` bleibt zunächst Array
- zentrale Voice-Identity-API wird in Core und Web verbindlich
- freie `+1/-1`-Umrechnungen werden technisch untersagt
- Legacy-Dublette wird als technischer Sonderfall gekapselt

Ziel:

- dieselbe Fehlerklasse darf nicht mehr neu entstehen
- Fixture-Tests bleiben stabil

### Stufe 2: Internes Fachmodell auf Lookup-orientierte Stimmenstruktur vorbereiten

- zusätzliche Registry oder Lookup-Struktur im Core
- zentrale Pfade lesen Stimmen nur noch über fachliche IDs
- Array-Zugriffe werden auf klar begrenzte Legacy-/Parity-Bereiche reduziert

### Stufe 3: Entscheidung über echtes Objekt-/Map-Modell

Erst wenn Stufe 1 und 2 stabil sind, wird entschieden:

- ob `Song.voices` fachlich als Array bestehen bleibt
- oder ob eine echte Umstellung des Kernmodells sinnvoll ist

## Harte Randbedingung

Die bestehenden Fixture- und Parity-Tests sollen durch diese Architekturarbeit
nicht unnötig destabilisiert werden.

Das bedeutet:

- keine stillen Serialisierungsänderungen
- keine unbegründete Änderung der Legacy-Vergleichsdaten
- Migration muss schrittweise und testgestützt erfolgen

Wenn sich Fixture-Ergebnisse ändern, muss das aus einer bewusst dokumentierten
fachlichen Entscheidung folgen, nicht aus einer unbeabsichtigten
Indexverschiebung.

## Akzeptanzkriterien

Das Architekturproblem gilt erst dann als ausreichend gelöst, wenn:

1. Core, Web und CLI dieselbe fachliche Stimmen-ID verwenden.
2. Neue freie Umrechnungen wie `voiceIndex + 1` oder `voiceNr - 1` in
   Produktionscode technisch geblockt sind.
3. Selection- und Playback-Logik keine Array-Position mehr als fachliche
   Stimmenidentität interpretiert.
4. Die Legacy-Dublette nicht mehr unkontrolliert in UI- oder
   Applikationslogik ausstrahlt.
5. Die Fixture-/Parity-Tests weiterhin gezielt nachvollziehbar bleiben.

## Nächste Umsetzungsschritte

1. Core-Voice-Identity-API definieren und verbindlich machen.
2. Web und Core mit Guards gegen freie Stimmen-Umrechnungen absichern.
3. Alle produktiven Pfade inventarisieren, die noch implizit
   Array-Positionen als Stimmen-ID verwenden.
4. Danach entscheiden, ob die zusätzliche Lookup-Struktur im Core genügt oder
   ob das Fachmodell selbst umgestellt werden soll.

## Inventarstand nach Option A

Nach Einführung der zentralen Lookup-Helfer sollen freie fachliche
Stimmen-Umrechnungen im Produktionscode nicht mehr vorkommen.

Aktuell verbleiben nur noch bewusst zentrale Stellen:

- `packages/core/src/voiceIdentity.ts`
  - zentrale erlaubte Umrechnung `abcVoiceIndex -> configVoiceNumber`
  - zentrale Lookups `voiceNumber -> Voice`
- `apps/web/src/workbench/songVoiceIdentity.ts`
  - zentrale benutzersichtbare Stimmen-ID im Web
- `packages/core/src/AbcToSong.ts`
  - technischer Legacy-Aufbau der Dublette an `song.voices[0]`

Alle weiteren produktiven Pfade sollen über diese Helfer laufen und nicht mehr
selbst `+1/-1` oder positionsbasierte Ableitungen durchführen.

## Betroffene Bereiche

- `packages/core`
- `apps/web`
- `apps/cli`
- Fixture-/Parity-Tests
- Selection
- Playback
- Layout
- Render-Pipeline
