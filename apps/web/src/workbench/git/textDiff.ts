export interface TextDiffPart {
  value: string
  added?: boolean
  removed?: boolean
}

/** Small line-oriented diff for the version dialog; Git remains the source of truth for file contents. */
export function diffText(left: string, right: string): TextDiffPart[] {
  const leftLines = left === '' ? [] : left.split('\n')
  const rightLines = right === '' ? [] : right.split('\n')
  const table: number[][] = Array.from({ length: leftLines.length + 1 }, () => Array<number>(rightLines.length + 1).fill(0))

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const row = table[leftIndex]
      const nextRow = table[leftIndex + 1]
      if (row === undefined || nextRow === undefined) continue
      row[rightIndex] = leftLines[leftIndex] === rightLines[rightIndex]
        ? (nextRow[rightIndex + 1] ?? 0) + 1
        : Math.max(nextRow[rightIndex] ?? 0, row[rightIndex + 1] ?? 0)
    }
  }

  const parts: TextDiffPart[] = []
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    if (leftIndex < leftLines.length && rightIndex < rightLines.length && leftLines[leftIndex] === rightLines[rightIndex]) {
      parts.push({ value: `${leftLines[leftIndex]}\n` })
      leftIndex += 1
      rightIndex += 1
    } else if (rightIndex < rightLines.length && (leftIndex === leftLines.length || (table[leftIndex]?.[rightIndex + 1] ?? 0) >= (table[leftIndex + 1]?.[rightIndex] ?? 0))) {
      parts.push({ value: `+ ${rightLines[rightIndex]}\n`, added: true })
      rightIndex += 1
    } else {
      parts.push({ value: `- ${leftLines[leftIndex] ?? ''}\n`, removed: true })
      leftIndex += 1
    }
  }
  return parts
}
