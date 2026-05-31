# Repo-Analyse-Prompt

Analysiere ausschließlich folgendes Thema aus dem Repo-Kontext.

## Thema

{{TOPIC}}

## Auftrag

Liefere nur belegbare Fakten aus dem Repo:

- betroffene Dateien
- relevante Typen, Klassen, Funktionen
- bestehende Zustände und Datenflüsse
- Legacy-Referenzen
- vorhandene Tests und Fixtures
- offene GAPs oder TODOs
- Risiken bei Änderungen

## Grenzen

- Keine Implementierung vorschlagen.
- Keine Refactorings vorschlagen.
- Keine Architektur neu entwerfen.
- Keine Dateien ändern.
- Wenn etwas unklar ist, explizit als unklar markieren.
