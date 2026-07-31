// Vite inlines the unchanged LGPL Legacy converter at build time.
// @ts-ignore – Vite ?raw import has no TypeScript declaration
import xml2abcSource from '../../../../packages/core/vendor/xml2abc.js?raw'

interface XmlNodes {
  readonly length: number
  [index: number]: Element
  find(selector: string): XmlNodes
  eq(index: number): XmlNodes
  first(): XmlNodes
  attr(name: string): string | undefined
  text(): string
  children(): XmlNodes
  each(callback: (this: Element, index: number, node: Element) => void): XmlNodes
  map<T>(callback: (this: Element, index: number, node: Element) => T): { get(): T[] }
  get(): Element[]
  toArray(): Element[]
  add(other: XmlNodes): XmlNodes
  append(value: XmlNodes | Element | Element[]): XmlNodes
}

class XmlNodeList implements XmlNodes {
  [index: number]: Element

  constructor(private readonly nodes: Element[]) {
    for (const [index, node] of nodes.entries()) this[index] = node
  }

  get length(): number { return this.nodes.length }
  find(selector: string): XmlNodes { return new XmlNodeList(this.nodes.flatMap((node) => Array.from(node.querySelectorAll(selector)))) }
  eq(index: number): XmlNodes { return new XmlNodeList(this.nodes[index] === undefined ? [] : [this.nodes[index]]) }
  first(): XmlNodes { return this.eq(0) }
  attr(name: string): string | undefined { return this.nodes[0]?.getAttribute(name) ?? undefined }
  text(): string { return this.nodes[0]?.textContent ?? '' }
  children(): XmlNodes { return new XmlNodeList(this.nodes.flatMap((node) => Array.from(node.children))) }
  each(callback: (this: Element, index: number, node: Element) => void): XmlNodes {
    this.nodes.forEach((node, index) => callback.call(node, index, node))
    return this
  }
  map<T>(callback: (this: Element, index: number, node: Element) => T): { get(): T[] } {
    return { get: () => this.nodes.map((node, index) => callback.call(node, index, node)) }
  }
  get(): Element[] { return [...this.nodes] }
  toArray(): Element[] { return this.get() }
  add(other: XmlNodes): XmlNodes { return new XmlNodeList([...this.nodes, ...other.get()]) }
  append(value: XmlNodes | Element | Element[]): XmlNodes {
    const nodes: Element[] = value instanceof XmlNodeList
      ? value.get()
      : Array.isArray(value)
        ? value
        : 'get' in value
          ? value.get()
          : [value]
    for (const target of this.nodes) for (const node of nodes) target.append(node)
    return this
  }
}

type LegacyConverter = (xml: Element, options: Record<string, unknown>) => [string, number]

function createElementFromMarkup(markup: string, ownerDocument: Document): Element {
  const match = markup.match(/^<([A-Za-z][\w:-]*)[\s>]/)
  if (match === null) throw new Error(`Ungültiges MusicXML-Element: ${markup}`)
  const tagName = match[1]
  if (typeof tagName !== 'string') throw new Error(`Ungültiges MusicXML-Element: ${markup}`)
  const element = ownerDocument.createElement(tagName)
  const parsed = new DOMParser().parseFromString(markup, 'application/xml').documentElement
  if (parsed !== null && parsed.tagName === tagName) {
    for (const attribute of Array.from(parsed.attributes)) element.setAttribute(attribute.name, attribute.value)
    element.textContent = parsed.textContent
  }
  return element
}

function loadLegacyConverter(): LegacyConverter {
  const factory = new Function('$', `${xml2abcSource}\nreturn vertaal;`) as (
    api: (value: Element | XmlNodes | Element[], ownerDocument?: Document) => XmlNodes,
  ) => LegacyConverter
  return factory((value, ownerDocument = document) => {
    if (value instanceof XmlNodeList) return value
    if (Array.isArray(value)) return new XmlNodeList(value)
    if (typeof value === 'string') return new XmlNodeList([createElementFromMarkup(value, ownerDocument)])
    if ('get' in value) return new XmlNodeList(value.get())
    return new XmlNodeList([value])
  })
}

const convertWithLegacy = loadLegacyConverter()

/** Converts MusicXML to ABC using the unchanged Legacy xml2abc implementation. */
export function convertMusicXmlToAbc(xml: string): string {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const parserError = document.querySelector('parsererror')
  if (parserError !== null) throw new Error(`MusicXML ist ungültig: ${parserError.textContent ?? 'Parserfehler'}`)
  const result = convertWithLegacy(document.documentElement, { u: 0, b: 0, n: 0, c: 0, v: 0, d: 0, m: 0, x: 0, p: 'f' })
  if (result[0] === '') throw new Error('MusicXML enthält keine konvertierbaren Noten')
  return result[0]
}
