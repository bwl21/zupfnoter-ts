import { describe, expect, it } from 'vitest'

import { WorkbenchLogger, type ConsoleLogEntry } from '../consoleLog'

describe('WorkbenchLogger', () => {
  it('formats non-command messages consistently with a timestamp and severity', () => {
    const entries: ConsoleLogEntry[] = []
    const logger = new WorkbenchLogger(
      (entry) => entries.push(entry),
      () => new Date(2026, 6, 17, 14, 5, 9),
    )

    logger.command('sconnection private')
    logger.info('storage connection selected: Privat (dropbox)')
    logger.warning('worker: unavailable')
    logger.error('storage save incomplete: Privat (0 saved, 1 failed)')

    expect(entries).toEqual([
      { id: 1, kind: 'command', message: 'sconnection private' },
      { id: 2, kind: 'info', message: '14:05:09  storage connection selected: Privat (dropbox)' },
      { id: 3, kind: 'warning', message: '14:05:09  worker: unavailable' },
      { id: 4, kind: 'error', message: '14:05:09  storage save incomplete: Privat (0 saved, 1 failed)' },
    ])
  })
})
