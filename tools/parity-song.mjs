#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  let all = false
  let caseId
  for (const arg of argv) {
    if (arg === '--all') {
      all = true
      continue
    }
    if (arg.startsWith('--')) continue
    if (caseId === undefined) caseId = arg
  }
  return { all, caseId }
}

function runVitest(env) {
  return spawnSync(
    'pnpm',
    [
      '--filter',
      '@zupfnoter/core',
      'exec',
      'vitest',
      'run',
      'src/testing/__tests__/song/gap_report.spec.ts',
      '--reporter=verbose',
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    },
  )
}

function main() {
  const { all, caseId } = parseArgs(process.argv.slice(2))
  const env = all
    ? { SONG_PARITY_ALL: '1', SONG_PARITY_CASE_IDS: '', ZUPFNOTER_GAP_REPORTS: '1' }
    : caseId
      ? { SONG_PARITY_CASE_IDS: caseId, SONG_PARITY_ALL: '0', ZUPFNOTER_GAP_REPORTS: '1' }
      : { SONG_PARITY_ALL: '1', SONG_PARITY_CASE_IDS: '', ZUPFNOTER_GAP_REPORTS: '1' }

  const result = runVitest(env)
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  const reportPath = new URL('../fixtures/reports/song-gap-report.json', import.meta.url)
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))

  for (const caseReport of report.cases ?? []) {
    console.log(`${caseReport.caseId}: required gaps=${caseReport.result.requiredGapCount}, warnings=${caseReport.result.warningCount}`)
  }
  console.log('Global report: fixtures/reports/song-gap-report.md')

  if ((report.requiredGapCount ?? 0) > 0) {
    process.exitCode = 1
  }
}

main()
