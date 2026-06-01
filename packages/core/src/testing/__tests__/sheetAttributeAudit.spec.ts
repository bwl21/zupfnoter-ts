import { describe, expect, it } from 'vitest'

import { auditSheetAttributes } from '../sheetAttributeAudit.js'
import type { SheetFixture } from '../semanticMatch.js'

describe('sheet attribute audit', () => {
  it('normalizes created-footer timestamps in text fields', () => {
    const expected: SheetFixture = {
      children: [
        {
          type: 'Annotation',
          text: 'demo.abc - created 2026-04-28 15:40:22 by Zupfnoter v1.17.1 [zupfnoter-cli]',
        },
      ],
    }

    const actual: SheetFixture = {
      children: [
        {
          type: 'Annotation',
          text: 'demo.abc - created by Zupfnoter',
        },
      ],
    }

    expect(auditSheetAttributes(actual, expected)).toHaveLength(0)
  })
})
