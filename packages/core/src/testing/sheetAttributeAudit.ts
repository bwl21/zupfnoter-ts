import type { DrawableFixture, SheetFixture } from './semanticMatch.js'

export type AttributeIssueKind = 'missing' | 'mismatch' | 'extra'

export interface AttributeIssue {
  path: string
  field: string
  kind: AttributeIssueKind
  expected: unknown
  actual: unknown
}

function compareKnownField(
  expected: DrawableFixture,
  actual: DrawableFixture,
  field: keyof DrawableFixture,
  path: string,
  issues: AttributeIssue[],
): void {
  const expectedValue = expected[field]
  const actualValue = actual[field]
  if (expectedValue === undefined && actualValue === undefined) return
  if (expectedValue === undefined && actualValue !== undefined) {
    issues.push({ path, field: String(field), kind: 'extra', expected: undefined, actual: actualValue })
    return
  }
  if (expectedValue !== undefined && actualValue === undefined) {
    issues.push({ path, field: String(field), kind: 'missing', expected: expectedValue, actual: undefined })
    return
  }

  if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
    issues.push({ path, field: String(field), kind: 'mismatch', expected: expectedValue, actual: actualValue })
  }
}

export function auditSheetAttributes(actual: SheetFixture, expected: SheetFixture): AttributeIssue[] {
  const issues: AttributeIssue[] = []
  const childCount = Math.min(actual.children.length, expected.children.length)

  for (let index = 0; index < childCount; index++) {
    const actualChild = actual.children[index]
    const expectedChild = expected.children[index]
    if (!actualChild || !expectedChild) continue
    const path = `children[${index}]`

    compareKnownField(expectedChild, actualChild, 'type', path, issues)
    compareKnownField(expectedChild, actualChild, 'center', path, issues)
    compareKnownField(expectedChild, actualChild, 'size', path, issues)
    compareKnownField(expectedChild, actualChild, 'fill', path, issues)
    compareKnownField(expectedChild, actualChild, 'from', path, issues)
    compareKnownField(expectedChild, actualChild, 'to', path, issues)
    compareKnownField(expectedChild, actualChild, 'style', path, issues)
    compareKnownField(expectedChild, actualChild, 'glyphName', path, issues)
    compareKnownField(expectedChild, actualChild, 'text', path, issues)
    compareKnownField(expectedChild, actualChild, 'color', path, issues)
    compareKnownField(expectedChild, actualChild, 'lineWidth', path, issues)
    compareKnownField(expectedChild, actualChild, 'znId', path, issues)
    compareKnownField(expectedChild, actualChild, 'confKey', path, issues)
    compareKnownField(expectedChild, actualChild, 'draginfo', path, issues)
    compareKnownField(expectedChild, actualChild, 'more_conf_keys', path, issues)
    compareKnownField(expectedChild, actualChild, 'path', path, issues)
  }

  if (actual.children.length !== expected.children.length) {
    issues.push({
      path: 'children.length',
      field: 'children',
      kind: 'mismatch',
      expected: expected.children.length,
      actual: actual.children.length,
    })
  }

  return issues
}
