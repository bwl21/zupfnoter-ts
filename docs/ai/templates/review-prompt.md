# Review-Prompt

Prüfe den Diff gegen den ursprünglichen Codex-Auftrag.

## Codex-Auftrag

{{CODEX_PROMPT}}

## Diff

{{DIFF}}

## Prüfe

- Scope-Verletzungen
- unnötige Refactorings
- Seiteneffekte
- Legacy-Paritätsrisiken
- fehlende oder falsche Tests
- Typ- oder Architekturprobleme

## Ausgabeformat

- Ergebnis: ok / nacharbeiten / kritisch
- Befunde
- Konkrete Korrekturvorschläge
