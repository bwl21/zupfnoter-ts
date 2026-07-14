import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseConfigHelpMarkdown,
  parseDocumentedOptions,
  renderConfigHelpHtml,
} from './config-help-documentation.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const handbookDir = path.join(repoRoot, 'docs/user-manual/UD_Zupfnoter-Handbuch')
const helpSource = path.join(handbookDir, 'help_de-de.md')
const helpJsonTarget = path.join(repoRoot, 'apps/web/public/locale/conf-help_de-de.json')
const metadataTarget = path.join(repoRoot, 'packages/core/src/generated/configEditorDocumentation.ts')
const handbookChapterSource = path.join(handbookDir, '090_UD_Zupfnoter-Konfiguration.source.md')
const handbookChapter = path.join(handbookDir, '090_UD_Zupfnoter-Konfiguration.md')

const markdown = await readFile(helpSource, 'utf8')
const sections = parseConfigHelpMarkdown(markdown)
const helpJson = Object.fromEntries(
  Object.entries(sections).map(([key, content]) => [key, renderConfigHelpHtml(content)]),
)
const optionDocumentation = Object.fromEntries(
  Object.entries(sections)
    .map(([key, content]) => [key, parseDocumentedOptions(content)])
    .filter(([, options]) => Object.keys(options).length > 0),
)

await mkdir(path.dirname(helpJsonTarget), { recursive: true })
await writeFile(helpJsonTarget, `${JSON.stringify(helpJson, null, 2)}\n`)
await mkdir(path.dirname(metadataTarget), { recursive: true })
await writeFile(
  metadataTarget,
  `/** Generated from docs/user-manual/UD_Zupfnoter-Handbuch/help_de-de.md. */\nexport interface ConfigEditorOptionDocumentation {\n  label: string\n  description: string\n}\n\nexport const CONFIG_EDITOR_OPTION_DOCUMENTATION: Readonly<Record<string, Readonly<Record<string, ConfigEditorOptionDocumentation>>>> = ${JSON.stringify(optionDocumentation, null, 2)} as const\n`,
)

// The complete migrated chapter contains the long defaults and examples that are
// intentionally not duplicated in the concise in-app help source.
const chapter = await readFile(handbookChapterSource, 'utf8')
await writeFile(handbookChapter, chapter)

console.log(`generated ${Object.keys(helpJson).length} help entries and ${Object.keys(optionDocumentation).length} option groups`)
