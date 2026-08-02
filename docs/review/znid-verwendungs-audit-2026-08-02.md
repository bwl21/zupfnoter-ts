# Audit: Verwendung von `znId`

Datum: 2026-08-02
Geltungsbereich: `packages/core`, `packages/types`, `apps/web`, `apps/viewsvg`

## Ergebnis

`znId` wird im Modell grundsätzlich fachgerecht verwendet: als stabile
Identität von notiertem Material und als Referenz für nachgelagerte
Konfiguration und Darstellung. `znId` ist jedoch keine global eindeutige
Identität einer Note. Dieselbe `znId` kann in mehreren Stimmen vorkommen.

Die stimmsichere Identität lautet daher:

```text
voiceId + znId
```

Für SVG-Klicks kann der konkrete `confKey` zusätzlich die Stimme des
angeklickten Sheet-Objekts bestimmen.

## Geprüfte Bereiche

| Bereich | Verwendung | Bewertung |
| --- | --- | --- |
| Musikmodell und Export | `MusicEntity.znId`, Drawable-Metadaten und SVG-Attribute | korrekt: `znId` wird als fachliche Materialreferenz exportiert, nicht als Stimmenindex |
| Sheet-Index | `byZnId` enthält mehrere Einträge pro ID | korrekt: der Index ist eine Mehrfachzuordnung und verwirft keine Stimmen |
| Zeitprojektion | Auflösung über `musicTime` und anschließend `znId` | korrekt für Scope-Projektionen, sofern der Stimmen-Scope erhalten bleibt |
| Playback | `playbackId = voiceId::znId` | korrekt und stimmsicher |
| Konfigurationsobjekte | Auflösung über `confKey`, mit `znId` als Materialbezug | korrekt |
| Editor-Selektion | Textbereich plus erkannte Stimme | korrekt; der Editorpfad nutzt die Quelltextposition und den Stimmenkontext |
| Harfenpanel-Selektion | SVG-Hitbox mit `znId` und umgebendem `confKey` | war fehlerhaft, seit Commit `137519e` korrigiert |
| Scorepanel-Selektion | Textbereich und fachliche Origin-Auflösung | grundsätzlich korrekt; bei späteren Änderungen muss die Stimmenauflösung erhalten bleiben |
| Generische `znId`-Events | `selection.znid-selected` und `selection.music-range-selected` | nur für kontextfreie bzw. absichtlich mehrstimmige Auswahl geeignet; für einen konkreten Stimmenklick nicht ausreichend |

## Gefundener Fehler

Das Harfenpanel verwendete beim Klick zunächst ausschließlich
`resolveSelectionOriginByZnId()`. Bei einer geteilten `znId` wurde dadurch der
erste Musik-Eintrag gewählt. Im Stimmenmodus konnte ein Bassklick deshalb die
erste Stimme selektieren.

Die Korrektur wertet nun zusätzlich den `data-conf-key` des angeklickten SVG-
Objekts aus. Dadurch wird die Stimmen-ID des konkreten Drawables in die
`SelectionOrigin` übernommen. Der Regressionstest
`HarpPreviewPanel.selection.spec.ts` bildet zwei Stimmen mit derselben
`znId` ab.

## Bewusste Mehrfachauflösung

Die Auflösung einer `znId` auf mehrere Indexeinträge ist nicht an sich ein
Fehler. Sie ist erforderlich, wenn eine Auswahl bewusst über mehrere Stimmen
oder über mehrere adressierbare Darstellungen projiziert wird. Entscheidend
ist, dass ein konkreter Stimmenklick vorher durch `voiceId`, `musicTime` oder
`confKey` eingeschränkt wird.

Insbesondere darf nicht:

- `znId` als alleiniger Primärschlüssel behandelt werden,
- bei einem konkreten SVG-Klick der erste Treffer aus `byZnId` gewählt werden,
- `znId` allein als stimmsichere Playback-ID verwendet werden.

## Bezug zu `r:`-Referenzen

Die betreffende Funktion ist im TypeScript-Code vorhanden und durch Core-Tests
abgesichert. Das User-Handbuch beschreibt sie ebenfalls als eingebettete
Verschiebemarke `[r:name]` (siehe
`docs/user-manual/UD_Zupfnoter-Handbuch/050_UD_Zupfnoter-Einstellungen.md`).
Das `R` muss dabei lowercase geschrieben werden; in der Parser-/Testschicht
erscheint die Eingabe als ABC-Feld `r:custom_id`.

Das Feld wird stimmbezogen und zeitbezogen gesammelt. Die nächste musikalische
Entität an dieser Zeitposition erhält den angegebenen Wert als `znId`; ohne
`r:` wird weiterhin die abc2svg-Zeitposition als `znId` verwendet. Ungültige
Namen werden diagnostiziert und nicht stillschweigend als gültige Referenz
übernommen.

Belegt ist das durch:

- `AbcToSong._transformRemark()` und `_makeZnId()`;
- `packages/core/src/testing/__tests__/AbcToSong.spec.ts` mit gültigem
  `r:custom_id`;
- einen Core-Test für ungültige Zeichen in `r:`.
- das User-Handbuch mit dem Beispiel `[r:n_11]`.

Damit funktioniert die fachliche Referenzierung. Sie macht die `znId` aber
nicht global stimmen-eindeutig: Bei gleichem `r:`-Wert in mehreren Stimmen
muss die aufrufende Auswahl weiterhin `voiceId`, `musicTime` oder `confKey`
berücksichtigen.

## Testbeleg

Ausgeführt:

- `pnpm run test:web`: 34 Testdateien, 219 Tests erfolgreich
- `pnpm --filter @zupfnoter/web run type-check`: erfolgreich
- `git diff --check`: erfolgreich

Der konkrete Harfenpanel-Regressionstest prüft den vollständigen Pfad
SVG-Hitbox → `confKey` → `voiceId` → Selection-Origin.

## Offener Prüfpunkt

Die generischen Selection-Events für `znId` bleiben bewusst allgemeine APIs.
Bei einer zukünftigen Verwendung für einen konkreten UI-Klick muss stattdessen
ein Origin mit Stimmenkontext oder ein konkreter `confKey` übergeben werden.
Eine weitere Prüfung ist nur nötig, wenn neue Aufrufer dieser generischen
Events hinzukommen.
