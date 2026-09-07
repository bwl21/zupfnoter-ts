import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export function readBuildMetadata(packageJsonPath, repositoryRoot) {
  const buildTime = new Date().toISOString()
  let appVersion = 'unknown'
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    if (typeof packageJson.version === 'string' && packageJson.version !== '') appVersion = packageJson.version
  } catch {
    // Keep the explicit fallback when package metadata is unavailable.
  }

  try {
    const commitHash = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const description = execFileSync('git', ['describe', '--always', '--dirty'], {
      cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return { appVersion, commitHash, buildIdentifier: `${appVersion} (${description}; ${commitHash})`, buildTime }
  } catch {
    return { appVersion, commitHash: 'unknown', buildIdentifier: appVersion, buildTime }
  }
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const [, , outputPath, packageJsonPath, repositoryRoot] = process.argv
  if (outputPath === undefined || packageJsonPath === undefined || repositoryRoot === undefined) {
    throw new Error('Usage: build-metadata.mjs <output> <package.json> <repository-root>')
  }
  const metadata = readBuildMetadata(resolve(packageJsonPath), resolve(repositoryRoot))
  const target = resolve(outputPath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, `${JSON.stringify(metadata, undefined, 2)}\n`, 'utf8')
}
