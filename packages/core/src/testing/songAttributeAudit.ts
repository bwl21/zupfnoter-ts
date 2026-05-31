import type { EntityFixture, SongFixture } from './semanticMatch.js'

export type AttributeIssueKind = 'missing' | 'mismatch'

export interface AttributeIssue {
  path: string
  kind: AttributeIssueKind
  expected: unknown
  actual: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareArrayScore(actual: unknown, expected: unknown): number {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return -1
  let score = 0
  for (let i = 0; i < expected.length; i++) {
    score += compareValueScore(actual[i], expected[i])
  }
  return score
}

function compareValueScore(actual: unknown, expected: unknown): number {
  if (expected === null || typeof expected !== 'object') {
    return actual === expected ? 1 : 0
  }

  if (Array.isArray(expected)) {
    return compareArrayScore(actual, expected)
  }

  if (!isObject(actual)) return 0

  let score = 1
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) continue
    score += compareValueScore(actual[key], value)
  }
  return score
}

function scoreEntityMatch(actual: EntityFixture, expected: EntityFixture): number {
  if (actual.type !== expected.type) return -1

  let score = 100
  if (actual.beat === expected.beat) score += 20
  if (actual.time === expected.time) score += 20
  if (expected.znId !== undefined && actual.znId === expected.znId) score += 10
  if (expected.confKey !== undefined && actual.confKey === expected.confKey) score += 10
  if (expected.text !== undefined && actual.text === expected.text) score += 10
  if (expected.from !== undefined && actual.from === expected.from) score += 15
  if (expected.to !== undefined && actual.to === expected.to) score += 15
  score += compareValueScore(actual.policy, expected.policy)
  score += compareValueScore(actual.position, expected.position)
  score += compareValueScore(actual.style, expected.style)
  score += compareValueScore(actual.pitch, expected.pitch)
  score += compareValueScore(actual.duration, expected.duration)
  return score
}

function findBestMatch(
  expected: EntityFixture,
  actualEntities: EntityFixture[],
  usedIndices: Set<number>,
): number {
  const exactMatchers: Array<(actual: EntityFixture) => boolean> = []
  if (expected.znId !== undefined) {
    exactMatchers.push((actual) => actual.type === expected.type && actual.znId === expected.znId)
  }
  if (expected.confKey !== undefined) {
    exactMatchers.push((actual) => actual.type === expected.type && actual.confKey === expected.confKey)
  }
  if (expected.time !== undefined) {
    exactMatchers.push((actual) => actual.type === expected.type && actual.time === expected.time)
  }
  if (expected.from !== undefined || expected.to !== undefined) {
    exactMatchers.push((actual) => {
      if (actual.type !== expected.type) return false
      if (expected.from !== undefined && actual.from !== expected.from) return false
      if (expected.to !== undefined && actual.to !== expected.to) return false
      return true
    })
  }

  for (const matcher of exactMatchers) {
    for (let index = 0; index < actualEntities.length; index++) {
      if (usedIndices.has(index)) continue
      const actual = actualEntities[index]
      if (actual === undefined) continue
      if (matcher(actual)) return index
    }
  }

  let bestIndex = -1
  let bestScore = -1
  for (let index = 0; index < actualEntities.length; index++) {
    if (usedIndices.has(index)) continue
    const actual = actualEntities[index]
    if (actual === undefined) continue
    const score = scoreEntityMatch(actual, expected)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestIndex
}

function collectIssues(
  actual: unknown,
  expected: unknown,
  path: string,
  issues: AttributeIssue[],
): void {
  if (expected === null || typeof expected !== 'object') {
    if (actual === undefined) {
      issues.push({ path, kind: 'missing', expected, actual })
      return
    }
    if (actual !== expected) {
      issues.push({ path, kind: 'mismatch', expected, actual })
    }
    return
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      issues.push({ path, kind: 'missing', expected, actual })
      return
    }
    if (actual.length !== expected.length) {
      issues.push({ path, kind: 'mismatch', expected, actual })
    }
    const limit = Math.min(actual.length, expected.length)
    for (let index = 0; index < limit; index++) {
      collectIssues(actual[index], expected[index], `${path}[${index}]`, issues)
    }
    return
  }

  if (!isObject(actual)) {
    issues.push({ path, kind: 'missing', expected, actual })
    return
  }

  for (const [key, value] of Object.entries(expected)) {
    collectIssues(actual[key], value, `${path}.${key}`, issues)
  }
}

export function auditSongAttributes(actual: SongFixture, expected: SongFixture): AttributeIssue[] {
  const issues: AttributeIssue[] = []

  for (let vi = 0; vi < expected.voices.length; vi++) {
    const expectedVoice = expected.voices[vi]
    const actualVoice = actual.voices[vi]
    if (!expectedVoice || !actualVoice) continue

    const usedIndices = new Set<number>()
    for (let ei = 0; ei < expectedVoice.entities.length; ei++) {
      const expectedEntity = expectedVoice.entities[ei]
      const actualEntities = actualVoice.entities
      if (!expectedEntity) continue

      const matchIndex = findBestMatch(expectedEntity, actualEntities, usedIndices)
      if (matchIndex === -1) {
        issues.push({
          path: `voices[${vi}].entities[${ei}]`,
          kind: 'missing',
          expected: expectedEntity,
          actual: undefined,
        })
        continue
      }

      usedIndices.add(matchIndex)
      const actualEntity = actualEntities[matchIndex]
      collectIssues(actualEntity, expectedEntity, `voices[${vi}].entities[${ei}]`, issues)
    }
  }

  return issues
}
