import { cp, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const legacyLocaleDir = path.resolve(repoRoot, '../200_zupfnoter/30_sources/SRC_Zupfnoter/public/locale')
const targetLocaleDir = path.resolve(repoRoot, 'apps/web/public/locale')

await mkdir(targetLocaleDir, { recursive: true })

const localeFiles = (await readdir(legacyLocaleDir))
  .filter((entry) => /^conf-help_.*\.json$/i.test(entry))

for (const fileName of localeFiles) {
  await cp(path.join(legacyLocaleDir, fileName), path.join(targetLocaleDir, fileName))
}

console.log(`synced ${localeFiles.length} conf-help locale file(s)`)
