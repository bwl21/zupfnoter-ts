import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_ROOT = join(__dirname, '../..')
const INCLUDED_EXTENSIONS = new Set(['.ts', '.vue'])
const EXCLUDED_SEGMENTS = new Set([
  '__tests__',
])

interface GuardFinding {
  file: string
  line: number
  snippet: string
}

const FORBIDDEN_PATTERNS: Array<{ label: string, pattern: RegExp }> = [
  {
    label: 'voiceIndex + 1',
    pattern: /\bvoiceIndex\s*\+\s*1\b/g,
  },
  {
    label: 'voiceNr + 1',
    pattern: /\bvoiceNr\s*\+\s*1\b/g,
  },
  {
    label: 'voiceIndex - 1',
    pattern: /\bvoiceIndex\s*-\s*1\b/g,
  },
  {
    label: 'voiceNr - 1',
    pattern: /\bvoiceNr\s*-\s*1\b/g,
  },
]

function collectSourceFiles(root: string): string[] {
  const result: string[] = []

  for (const entry of readdirSync(root)) {
    const absolutePath = join(root, entry)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      if (EXCLUDED_SEGMENTS.has(entry)) continue
      result.push(...collectSourceFiles(absolutePath))
      continue
    }

    const extension = absolutePath.slice(absolutePath.lastIndexOf('.'))
    if (!INCLUDED_EXTENSIONS.has(extension)) continue
    result.push(absolutePath)
  }

  return result
}

function collectFindings(): GuardFinding[] {
  const findings: GuardFinding[] = []

  for (const file of collectSourceFiles(SOURCE_ROOT)) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('// voice-identity-guard: allow')) return

      for (const { pattern } of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0
        if (!pattern.test(line)) continue
        findings.push({
          file,
          line: index + 1,
          snippet: trimmed,
        })
      }
    })
  }

  return findings
}

describe('voice identity guard', () => {
  it('forbids ad-hoc voice number conversions in web production code', () => {
    const findings = collectFindings()

    expect(findings).toEqual([])
  })
})
