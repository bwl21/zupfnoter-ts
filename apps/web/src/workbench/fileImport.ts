import { unzipSync } from 'fflate'
import { convertMusicXmlToAbc } from './xml2abc'

export type LocalImport =
  | { kind: 'abc'; text: string }
  | { kind: 'resource'; name: string; dataUri: string }

export class UnsupportedImportError extends Error {
  constructor(fileName: string) {
    super(`Dateiformat von „${fileName}“ wird noch nicht unterstützt`)
    this.name = 'UnsupportedImportError'
  }
}

function fileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot < 0 ? '' : fileName.slice(lastDot + 1).toLowerCase()
}

function isImage(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true
  return ['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(fileExtension(file.name))
}

function isJpeg(file: File): boolean {
  return file.type.toLowerCase() === 'image/jpeg'
    || fileExtension(file.name) === 'jpg'
    || fileExtension(file.name) === 'jpeg'
}

async function normalizeJpegOrientation(file: File, dataUri: string): Promise<string> {
  if (!isJpeg(file) || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return dataUri

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (context === null) return dataUri
      context.drawImage(bitmap, 0, 0)
      return canvas.toDataURL('image/jpeg', 0.92)
    } finally {
      bitmap.close()
    }
  } catch {
    return dataUri
  }
}

function isMxl(file: File): boolean {
  return fileExtension(file.name) === 'mxl'
}

function isXml(file: File, text: string): boolean {
  return fileExtension(file.name) === 'xml' || text.trimStart().startsWith('<')
}

function findMusicXmlEntry(entries: Record<string, Uint8Array>): Uint8Array | undefined {
  // Legacy's JSZip expression is /^[^/]*\.xml$/: prefer a score XML directly
  // at the archive root, so META-INF/container.xml is never selected first.
  const rootXml = Object.entries(entries).find(([name]) => !name.includes('/') && name.toLowerCase().endsWith('.xml'))
  if (rootXml !== undefined) return rootXml[1]

  const container = entries['META-INF/container.xml'] ?? entries['meta-inf/container.xml']
  if (container === undefined) return undefined
  const containerXml = new TextDecoder().decode(container)
  const rootFilePath = containerXml.match(/<rootfile\b[^>]*full-path=["']([^"']+)["']/i)?.[1]
  return rootFilePath === undefined ? undefined : entries[rootFilePath]
}

/** Reads one local file according to the legacy import type detection. */
export async function readLocalImport(file: File): Promise<LocalImport> {
  if (isImage(file)) {
    const data = await file.arrayBuffer()
    const bytes = new Uint8Array(data)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const mimeType = file.type === '' ? 'image/jpeg' : file.type
    const dataUri = `data:${mimeType};base64,${btoa(binary)}`
    return { kind: 'resource', name: file.name, dataUri: await normalizeJpegOrientation(file, dataUri) }
  }

  if (isMxl(file)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const entries = unzipSync(bytes)
    const xmlEntry = findMusicXmlEntry(entries)
    if (xmlEntry !== undefined) {
      const xml = new TextDecoder().decode(xmlEntry)
      return { kind: 'abc', text: convertMusicXmlToAbc(xml) }
    }
    throw new UnsupportedImportError(file.name)
  }

  const text = await file.text()
  if (isXml(file, text)) return { kind: 'abc', text: convertMusicXmlToAbc(text) }
  if (fileExtension(file.name) !== 'abc') throw new UnsupportedImportError(file.name)
  return { kind: 'abc', text }
}

/** Keeps the resource key compatible with the legacy pasteDatauri command. */
export function resourceKeyFromFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_]/g, '_')
}
