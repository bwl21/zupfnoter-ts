import { diffArrays, diffWordsWithSpace } from 'diff'

export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'changed'
export type DiffSegmentType = 'unchanged' | 'added' | 'removed'

export interface DiffSegment {
  value: string
  type: DiffSegmentType
}

export interface DiffLine {
  type: DiffLineType
  oldLineNumber?: number
  newLineNumber?: number
  segments: DiffSegment[]
}

interface DiffChunk<T> {
  value: T[]
  added?: boolean
  removed?: boolean
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n')
}

function inlineSegments(oldLine: string, newLine: string): DiffSegment[] {
  return diffWordsWithSpace(oldLine, newLine).map((part) => ({
    value: part.value,
    type: part.added === true ? 'added' : part.removed === true ? 'removed' : 'unchanged',
  }))
}

function appendAdded(lines: DiffLine[], values: string[], nextLineNumber: number): number {
  for (const value of values) {
    lines.push({ type: 'added', newLineNumber: nextLineNumber, segments: [{ value, type: 'added' }] })
    nextLineNumber += 1
  }
  return nextLineNumber
}

function appendRemoved(lines: DiffLine[], values: string[], oldLineNumber: number): number {
  for (const value of values) {
    lines.push({ type: 'removed', oldLineNumber, segments: [{ value, type: 'removed' }] })
    oldLineNumber += 1
  }
  return oldLineNumber
}

/** Creates a line diff and adds a word/whitespace diff for changed lines. */
export function createTextDiff(oldText: string, newText: string): DiffLine[] {
  if (oldText === '' && newText !== '') {
    const lines: DiffLine[] = []
    appendAdded(lines, splitLines(newText), 1)
    return lines
  }
  if (newText === '' && oldText !== '') {
    const lines: DiffLine[] = []
    appendRemoved(lines, splitLines(oldText), 1)
    return lines
  }
  const chunks = diffArrays(splitLines(oldText), splitLines(newText)) as DiffChunk<string>[]
  const lines: DiffLine[] = []
  let oldLineNumber = 1
  let newLineNumber = 1

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    if (chunk === undefined) continue
    const next = chunks[index + 1]

    if (chunk.removed === true && next?.added === true) {
      const pairCount = Math.min(chunk.value.length, next.value.length)
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const oldLine = chunk.value[pairIndex] ?? ''
        const newLine = next.value[pairIndex] ?? ''
        lines.push({ type: 'changed', oldLineNumber, newLineNumber, segments: inlineSegments(oldLine, newLine) })
        oldLineNumber += 1
        newLineNumber += 1
      }
      oldLineNumber = appendRemoved(lines, chunk.value.slice(pairCount), oldLineNumber)
      newLineNumber = appendAdded(lines, next.value.slice(pairCount), newLineNumber)
      index += 1
      continue
    }

    if (chunk.added === true) {
      newLineNumber = appendAdded(lines, chunk.value, newLineNumber)
      continue
    }
    if (chunk.removed === true) {
      oldLineNumber = appendRemoved(lines, chunk.value, oldLineNumber)
      continue
    }

    for (const value of chunk.value) {
      lines.push({ type: 'unchanged', oldLineNumber, newLineNumber, segments: [{ value, type: 'unchanged' }] })
      oldLineNumber += 1
      newLineNumber += 1
    }
  }
  return lines
}

export const diffText = createTextDiff
