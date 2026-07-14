/** Parses the maintained German configuration help without hidden metadata markers. */
export function parseConfigHelpMarkdown(markdown) {
  const sections = {}
  const heading = /^##\s+(.+)\s*$/gm
  const matches = [...markdown.matchAll(heading)]

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const key = match[1].trim()
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? markdown.length
    sections[key] = markdown.slice(start, end).trim()
  }

  return sections
}

/** Extracts visible option names and explanations from a help section. */
export function parseDocumentedOptions(markdown) {
  const options = {}
  const lines = markdown.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const title = lines[index].match(/^\s*\*\*([^:]+):\s*`([^`]+)`\*\*\s*$/)
    const namedList = lines[index].match(/^\s*-\s+\*\*([^:]+):\s*`([^`]+)`\*\*\s*(.*)$/)
    const list = lines[index].match(/^\s*-\s+(?:\*\*)?`([^`]+)`(?:\*\*)?\s*(?::|-)?\s*(.*)$/)
    const value = title?.[2] ?? namedList?.[2] ?? list?.[1]
    if (value === undefined) continue

    const label = title?.[1].trim() ?? namedList?.[1].trim() ?? value
    const initialDescription = namedList?.[3].trim() ?? list?.[2]?.trim() ?? ''
    const descriptionLines = initialDescription === '' ? [] : [initialDescription]
    let nextIndex = index + 1
    if (title !== null && initialDescription === '') {
      while (nextIndex < lines.length && lines[nextIndex].trim() === '') {
        nextIndex += 1
      }
    }
    while (nextIndex < lines.length && lines[nextIndex].trim() !== '') {
      if (/^\s*(?:-\s+|\*\*[^:]+:\s*`)/.test(lines[nextIndex])) break
      descriptionLines.push(lines[nextIndex].trim())
      nextIndex += 1
    }
    options[value] = {
      label,
      description: descriptionLines.join(' ').trim(),
    }
  }

  return options
}

export function renderConfigHelpHtml(markdown) {
  const escaped = escapeHtml(markdown)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  const blocks = escaped.split(/\n\s*\n/).filter((block) => block.trim() !== '')
  return blocks.map((block) => {
    const lines = block.split('\n')
    if (lines.every((line) => /^\s*-\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${line.replace(/^\s*-\s+/, '')}</li>`).join('')}</ul>`
    }
    return `<p>${lines.join('<br>')}</p>`
  }).join('\n')
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
