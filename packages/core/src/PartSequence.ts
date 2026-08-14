/** Parses the standard ABC header P: part sequence. */

export interface PartSequenceParseResult {
  order: string[]
  error?: string
}

/**
 * Expands ABC part sequences such as `P:(AB)2C` to `A, B, A, B, C`.
 * abc2svg exposes the raw header value but does not expand or play it.
 */
export function parsePartSequence(value: string): PartSequenceParseResult {
  const source = value.trim()
  let index = 0

  const parseSequence = (stopAtClose: boolean): string[] => {
    const result: string[] = []
    while (index < source.length) {
      const character = source[index]
      if (character === undefined) break
      if (/\s/.test(character)) {
        index += 1
        continue
      }
      if (character === ')') {
        if (!stopAtClose) throw new Error('unerwartete schließende Klammer')
        index += 1
        return result
      }

      let item: string[]
      if (character === '(') {
        index += 1
        item = parseSequence(true)
      } else {
        if (!/[A-Za-z]/.test(character)) {
          throw new Error(`ungültiges Zeichen „${character}“`)
        }
        index += 1
        item = [character]
      }

      const repeatStart = index
      while (index < source.length && /\d/.test(source[index] ?? '')) index += 1
      const repeatText = source.slice(repeatStart, index)
      const repeat = repeatText === '' ? 1 : Number.parseInt(repeatText, 10)
      if (!Number.isSafeInteger(repeat) || repeat < 1) {
        throw new Error('Wiederholungszahl muss größer als null sein')
      }
      if (repeat > 1000 || result.length + item.length * repeat > 10000) {
        throw new Error('Partfolge ist zu lang')
      }
      for (let repetition = 0; repetition < repeat; repetition += 1) result.push(...item)
    }

    if (stopAtClose) throw new Error('fehlende schließende Klammer')
    return result
  }

  try {
    const order = parseSequence(false)
    return order.length > 0 ? { order } : { order: [], error: 'Partfolge ist leer' }
  } catch (error) {
    return {
      order: [],
      error: error instanceof Error ? error.message : 'ungültige Partfolge',
    }
  }
}
