/* oxlint-disable jest/expect-expect -- report-style test prints actionable prompts */
import { describe, it } from 'vitest'

import { formatOpenImplementations, getOpenImplementations } from '../openImplementations.js'

describe('gap report', () => {
  it('prints overall gap summary', () => {
    const songEntries = getOpenImplementations('song')
    const sheetEntries = getOpenImplementations('sheet')
    const total = songEntries.length + sheetEntries.length
    const allIds = [...songEntries, ...sheetEntries].map((entry) => entry.id)

    console.log(`\n[gap-report:summary]\nTotal open implementations: ${total}\nIDs: ${allIds.join(', ')}\n`)
  })

  it('prints actionable prompt for song gaps', () => {
    const message = formatOpenImplementations(getOpenImplementations('song'))
    console.log(`\n[gap-report:song]\n${message}\n`)
  })

  it('prints actionable prompt for sheet gaps', () => {
    const message = formatOpenImplementations(getOpenImplementations('sheet'))
    console.log(`\n[gap-report:sheet]\n${message}\n`)
  })
})
