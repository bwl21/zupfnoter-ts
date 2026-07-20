import QRCode from 'qrcode'
import jpeg from 'jpeg-js'

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function decodeBase64(value: string): Uint8Array {
  const bytes: number[] = []
  const normalized = value.replace(/[^A-Za-z0-9+/=]/g, '')
  for (let index = 0; index < normalized.length; index += 4) {
    const first = BASE64_ALPHABET.indexOf(normalized[index] ?? '=')
    const second = BASE64_ALPHABET.indexOf(normalized[index + 1] ?? '=')
    const thirdValue = normalized[index + 2] ?? '='
    const fourthValue = normalized[index + 3] ?? '='
    const third = thirdValue === '=' ? 0 : BASE64_ALPHABET.indexOf(thirdValue)
    const fourth = fourthValue === '=' ? 0 : BASE64_ALPHABET.indexOf(fourthValue)
    bytes.push((first << 2) | (second >> 4))
    if (thirdValue !== '=') bytes.push(((second & 15) << 4) | (third >> 2))
    if (fourthValue !== '=') bytes.push(((third & 3) << 6) | fourth)
  }
  return new Uint8Array(bytes)
}

function createCanvasJpeg(
  qr: ReturnType<typeof QRCode.create>,
  moduleCount: number,
  scale: number,
): Uint8Array | undefined {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  const size = moduleCount * scale
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context === null) return undefined

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size, size)
  context.fillStyle = '#000000'
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      const moduleRow = row - 4
      const moduleColumn = column - 4
      if (moduleRow >= 0 && moduleRow < qr.modules.size
        && moduleColumn >= 0 && moduleColumn < qr.modules.size
        && qr.modules.get(moduleRow, moduleColumn)) {
        context.fillRect(column * scale, row * scale, scale, scale)
      }
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const separator = dataUrl.indexOf(',')
  return separator < 0 ? undefined : decodeBase64(dataUrl.slice(separator + 1))
}

/** Erzeugt die QR-Pixel für einen Player-Link mit ausreichender Quiet Zone. */
export function createPlayerQrJpeg(playbackUrl: string): Uint8Array {
  const qr = QRCode.create(playbackUrl, { errorCorrectionLevel: 'L' })
  const marginModules = 4
  const scale = 8
  const moduleCount = qr.modules.size + marginModules * 2
  const canvasJpeg = createCanvasJpeg(qr, moduleCount, scale)
  if (canvasJpeg !== undefined) return canvasJpeg
  const pixels = new Uint8Array(moduleCount * scale * moduleCount * scale * 4)

  for (let row = 0; row < moduleCount * scale; row += 1) {
    for (let column = 0; column < moduleCount * scale; column += 1) {
      const moduleRow = Math.floor(row / scale) - marginModules
      const moduleColumn = Math.floor(column / scale) - marginModules
      const dark = moduleRow >= 0 && moduleRow < qr.modules.size
        && moduleColumn >= 0 && moduleColumn < qr.modules.size
        && qr.modules.get(moduleRow, moduleColumn)
      const color = dark ? 0 : 255
      const offset = (row * moduleCount * scale + column) * 4
      pixels[offset] = color
      pixels[offset + 1] = color
      pixels[offset + 2] = color
      pixels[offset + 3] = 255
    }
  }

  return new Uint8Array(jpeg.encode({
    data: pixels,
    width: moduleCount * scale,
    height: moduleCount * scale,
  }, 92).data)
}

/** Wandelt einen erzeugten Player-QR in die für SVG/PDF benötigte Daten-URL um. */
export function playerQrJpegDataUrl(playbackUrl: string): string {
  const bytes = createPlayerQrJpeg(playbackUrl)
  let base64 = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    base64 += BASE64_ALPHABET[first >> 2]
    base64 += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)]
    base64 += second === undefined ? '=' : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)]
    base64 += third === undefined ? '=' : BASE64_ALPHABET[third & 63]
  }
  return `data:image/jpeg;base64,${base64}`
}
