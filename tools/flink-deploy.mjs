import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const apps = {
  web: { directory: 'apps/web', packageName: '@zupfnoter/web' },
  practice: { directory: 'apps/practice', packageName: '@zupfnoter/practice' },
}

function loadRootEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match === null) continue
    const key = match[1]
    const value = match[2]?.trim().replace(/^(['"])(.*)\1$/, '$2')
    if (key !== undefined && value !== undefined && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function findFlink() {
  const configured = process.env.FLINK_BIN
  if (configured !== undefined && existsSync(configured)) return configured
  const local = join(ROOT, '.flink', 'bin', 'flink')
  if (existsSync(local)) return local
  try {
    return execFileSync('which', ['flink'], { encoding: 'utf8' }).trim() || undefined
  } catch {
    return undefined
  }
}

const appName = process.argv[2]
const app = appName === undefined ? undefined : apps[appName]
if (app === undefined) {
  console.error('Verwendung: node tools/flink-deploy.mjs <web|practice>')
  process.exit(2)
}

loadRootEnv()
const flink = findFlink()
if (flink === undefined) {
  console.error('Flink-CLI nicht gefunden. Installieren oder FLINK_BIN=/pfad/zu/flink setzen.')
  process.exit(1)
}
if (process.env.FLINK_PASSWORD === undefined) {
  console.error('FLINK_PASSWORD fehlt. Root-.env prüfen oder als Umgebungsvariable setzen.')
  process.exit(1)
}

const result = spawnSync(flink, ['publish', 'dist', '--public'], {
  cwd: join(ROOT, app.directory),
  env: process.env,
  stdio: 'inherit',
})
process.exitCode = result.status ?? 1
