import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const deployments = {
  web: {
    localDirectory: join(ROOT, 'apps/web/dist'),
    remoteDirectory: 'web/zupfnoter/znts',
    publicUrl: 'https://znts.zupfnoter.de/',
  },
  practice: {
    localDirectory: join(ROOT, 'apps/practice/dist'),
    remoteDirectory: 'web/zupfnoter/practice',
    publicUrl: 'https://practice.zupfnoter.de/',
  },
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

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (value === undefined || value === '') {
    console.error(`${name} fehlt. Root-.env prüfen.`)
    process.exit(1)
  }
  return value
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    ...options,
  })
  if (result.error !== undefined) {
    console.error(`${command} konnte nicht gestartet werden: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const deploymentName = process.argv[2]
const checkOnly = process.argv[3] === '--check'
const deployment = deploymentName === undefined ? undefined : deployments[deploymentName]
if (deployment === undefined) {
  console.error('Verwendung: node tools/zupfnoter-de-deploy.mjs <web|practice>')
  process.exit(2)
}

loadRootEnv()

const host = requiredEnv('ZUPFNOTER_DE_DEPLOY_HOST')
const user = requiredEnv('ZUPFNOTER_DE_DEPLOY_USER')
const port = process.env.ZUPFNOTER_DE_DEPLOY_PORT?.trim() || '22'
if (host === 'dein-server.serverdomain.org' || host.endsWith('.example.org')) {
  console.error('ZUPFNOTER_DE_DEPLOY_HOST enthält noch einen Beispielwert. Servernamen eintragen.')
  process.exit(1)
}
if (!/^[A-Za-z0-9.-]+$/.test(host)) {
  console.error('ZUPFNOTER_DE_DEPLOY_HOST enthält ungültige Zeichen.')
  process.exit(1)
}
if (!/^[A-Za-z0-9._-]+$/.test(user)) {
  console.error('ZUPFNOTER_DE_DEPLOY_USER enthält ungültige Zeichen.')
  process.exit(1)
}
if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) {
  console.error('ZUPFNOTER_DE_DEPLOY_PORT muss ein gültiger TCP-Port sein.')
  process.exit(1)
}
const configuredIdentity = process.env.ZUPFNOTER_DE_DEPLOY_IDENTITY_FILE?.trim()
const defaultIdentity = join(homedir(), '.ssh', 'id_ed25519_zupfnoter_deploy')
const identityFile = configuredIdentity || (existsSync(defaultIdentity) ? defaultIdentity : undefined)
if (identityFile !== undefined && !existsSync(identityFile)) {
  console.error(`SSH-Schlüssel nicht gefunden: ${identityFile}`)
  process.exit(1)
}

const sshOptions = ['-p', port, '-o', 'IdentitiesOnly=yes']
if (identityFile !== undefined) sshOptions.push('-i', identityFile)

const sshTarget = `${user}@${host}`
const rsyncTarget = `${sshTarget}:${deployment.remoteDirectory}/`
const rsyncShell = ['ssh', ...sshOptions].join(' ')

if (checkOnly) {
  run('ssh', [
    ...sshOptions,
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=10',
    sshTarget,
    'pwd',
  ])
  console.log('SSH-Verbindung erfolgreich.')
  process.exit(0)
}

if (!existsSync(join(deployment.localDirectory, 'index.html'))) {
  console.error(`Build fehlt: ${deployment.localDirectory}/index.html wurde nicht gefunden.`)
  process.exit(1)
}

console.log(`Deployment nach ${deployment.remoteDirectory}/ auf ${host}`)
run('ssh', [...sshOptions, sshTarget, 'mkdir', '-p', '--', deployment.remoteDirectory])

// Keep the old index usable until every asset referenced by the new index exists.
run('rsync', [
  '-az',
  '--exclude',
  'index.html',
  '-e',
  rsyncShell,
  `${deployment.localDirectory}/`,
  rsyncTarget,
])
run('rsync', [
  '-az',
  '-e',
  rsyncShell,
  join(deployment.localDirectory, 'index.html'),
  `${rsyncTarget}index.html`,
])

// Clean obsolete hashed assets only after the new index and its assets are live.
run('rsync', [
  '-az',
  '--delete',
  '-e',
  rsyncShell,
  `${deployment.localDirectory}/`,
  rsyncTarget,
])

const configuredPublicUrl = deploymentName === 'practice'
  ? process.env.PRACTICE_PUBLIC_URL
  : process.env.ZUPFNOTER_WEB_PUBLIC_URL
console.log(`Deployment abgeschlossen: ${configuredPublicUrl ?? deployment.publicUrl}`)
