/**
 * Liest und schreibt den globalen ABC-Liedtext im Legacy-Format aus `W:`-Zeilen.
 */

const lyricsLinePattern = /(?:^|\n)W:[^\n]*/g
const lyricsBlockPattern = /(?:^|\n)W:[^\n]*(?:\nW:[^\n]*)*/

export function extractLyricsText(abcText: string): string {
  const lines = [...abcText.matchAll(lyricsLinePattern)]
    .map((match) => match[0].replace(/^\n?W:[ \t]*/, ''))

  return lines.join('\n')
}

export function replaceLyricsText(abcText: string, lyricsText: string): string {
  const lines = (lyricsText === '' ? [' '] : lyricsText.split('\n'))
    .map((line) => `W:${line}`)
  const replacement = `\n${lines.join('\n')}`
  const match = lyricsBlockPattern.exec(abcText)

  if (match === null || match.index === undefined) {
    return `${abcText.trimEnd()}\n%\n${lines.join('\n')}\n%\n%\n`
  }

  return `${abcText.slice(0, match.index)}${replacement}${abcText.slice(match.index + match[0].length)}`
}
