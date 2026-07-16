/** Prüft einen Dateinamen nach dem tokenbasierten Dropbox-Dateinamenverhalten. */
export function matchesStorageDocumentQuery(name: string, query: string): boolean {
  const queryTokens = toTokens(query)
  if (queryTokens.length === 0) return false
  const filenameTokens = toTokens(name.replace(/\.abc$/i, ''))
  const lastToken = queryTokens[queryTokens.length - 1]
  if (lastToken === undefined) return false
  return queryTokens.slice(0, -1).every((token) => filenameTokens.includes(token))
    && filenameTokens.some((token) => token.startsWith(lastToken))
}

function toTokens(value: string): string[] {
  return value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token !== '')
}
