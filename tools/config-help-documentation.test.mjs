import assert from 'node:assert/strict'
import test from 'node:test'

import { parseConfigHelpMarkdown, parseDocumentedOptions } from './config-help-documentation.mjs'

test('parses visible named values, list values and placeholders', () => {
  const sections = parseConfigHelpMarkdown([
    '## tuning',
    '',
    '**Feste Stimmung: `fixed`**',
    '',
    'Die Stimmung ist vorgegeben.',
    '',
    '- `okon-*`: eine Okon-Variante',
  ].join('\n'))

  assert.deepEqual(parseDocumentedOptions(sections.tuning), {
    fixed: {
      label: 'Feste Stimmung',
      description: 'Die Stimmung ist vorgegeben.',
    },
    'okon-*': {
      label: 'okon-*',
      description: 'eine Okon-Variante',
    },
  })
})

test('parses named list values without an invisible marker', () => {
  const options = parseDocumentedOptions('- **Mitte: `center`** positioniert die Pause.')
  assert.deepEqual(options.center, {
    label: 'Mitte',
    description: 'positioniert die Pause.',
  })
})
