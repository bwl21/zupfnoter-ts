import { ensureDir, writeFileSafe } from '../lib/fsx.js';
import { AI_ROOT, TASK_DIR, TEMPLATE_DIR, INDEX_FILE } from '../lib/paths.js';

const templates: Record<string, string> = {
  'analysis-prompt.md': `# Repo-Analyse-Prompt

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
`,
  'strategy-prompt.md': `# Strategie-Prompt

Erstelle aus Thema und Repo-Analyse einen minimalen Implementierungsplan.

## Thema

{{TOPIC}}

## Repo-Analyse

{{ANALYSIS_RESULT}}

## Ausgabeformat

- Goal
- Scope
- Betroffene Dateien
- Requirements
- Do not change
- Verification
- Risiken
- Offene Fragen

## Grenzen

- Keine Codebeispiele.
- Keine allgemeinen Architekturtexte.
- Keine Refactorings außerhalb des Scopes.
`,
  'codex-prompt.md': `# Codex-Prompt

Formuliere einen knappen Codex-Arbeitsauftrag aus Thema, Analyse und Strategie.

## Thema

{{TOPIC}}

## Analyse

{{ANALYSIS_RESULT}}

## Strategie

{{STRATEGY_RESULT}}

## Zielausgabe

Schreibe einen Codex-Prompt im Format:

Goal:
Scope:
Requirements:
Do not change:
Verification:
Notes:

Der Prompt soll klein, konkret und umsetzungsorientiert sein.
`,
  'review-prompt.md': `# Review-Prompt

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
`
};

export async function initCommand(): Promise<void> {
  await ensureDir(AI_ROOT);
  await ensureDir(TEMPLATE_DIR);
  await ensureDir(TASK_DIR);
  for (const [name, content] of Object.entries(templates)) {
    await writeFileSafe(`${TEMPLATE_DIR}/${name}`, content, false).catch(() => undefined);
  }
  await writeFileSafe(INDEX_FILE, JSON.stringify({ tasks: [] }, null, 2), false).catch(() => undefined);
  console.log('Initialized docs/ai with templates and task index.');
}
