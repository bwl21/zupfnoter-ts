import '@zupfnoter/core'

declare module '@zupfnoter/core' {
  interface AbcParser {
    renderSvg(abcText: string): string
  }
}
