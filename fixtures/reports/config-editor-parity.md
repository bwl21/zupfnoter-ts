# Config-Editor-Parität: implizites `show`

Stand: 2026-08-01

## Festgestellte Legacy-Abweichung

Bei notengebundenen Annotationen und Akkorden behandelt die Legacy-Rendering-
Runtime einen fehlenden `show`-Wert als sichtbar. In
`src/harpnotes.rb` wird aus einem fehlenden Wert explizit `true`:

```ruby
show = show_from_config.nil? ? true : show_from_config
```

Der Legacy-Config-Editor übernimmt dagegen nur den vorhandenen Wert aus dem
Confstack. Da `defaults.notebound.annotation.show` und
`defaults.notebound.chord.show` im Legacy-Builtin nicht gesetzt sind, bleibt
das Feld im Editor leer, obwohl das Objekt gerendert wird.

## TS-Verhalten

Der TS-Config-Editor zeigt für fehlende `show`-Overrides den wirksamen Wert
`true` (`Ja`) an. Das entspricht der Rendering-Semantik und verhindert, dass
die Anzeige im Editor fälschlich wie „aus“ oder „unbekannt“ wirkt. Der Wert
wird dabei nicht in die ABC-Konfiguration geschrieben; erst eine explizite
Änderung erzeugt einen lokalen `show`-Eintrag.

Der Unterschied zum Legacy-Editor ist damit eine bewusst dokumentierte
Korrektur des Legacy-UI-Verhaltens, keine Abweichung der Rendering-Semantik.
