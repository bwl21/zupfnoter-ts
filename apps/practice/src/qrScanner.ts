import {
  BrowserQRCodeReader,
  type IBrowserCodeReaderOptions,
} from '@zxing/browser'
import { DecodeHintType, type Result } from '@zxing/library'
import {
  prepareZXingModule,
  readBarcodes,
} from 'zxing-wasm/reader'
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

prepareZXingModule({
  overrides: {
    locateFile: () => zxingReaderWasmUrl,
  },
})

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

interface CaptureSize {
  width: number
  height: number
}

/** Erweitert einen Suchrahmen gleichmäßig, damit die QR-Ruhezone sicher im Bild bleibt. */
export function expandRectangle(rectangle: Rectangle, paddingRatio: number): Rectangle {
  const paddingX = rectangle.width * Math.max(0, paddingRatio)
  const paddingY = rectangle.height * Math.max(0, paddingRatio)
  return {
    x: rectangle.x - paddingX,
    y: rectangle.y - paddingY,
    width: rectangle.width + paddingX * 2,
    height: rectangle.height + paddingY * 2,
  }
}

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  focusMode?: string[]
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string
}

/** Hält die robuste Auswertung nach einem erkannten Muster über mehrere frische Frames aktiv. */
export function isQrPatternRecent(lastDetectedAt: number, now: number, retentionMs: number): boolean {
  return Number.isFinite(lastDetectedAt) && now >= lastDetectedAt && now - lastDetectedAt < retentionMs
}

/** Berechnet den im sichtbaren Suchrahmen liegenden Ausschnitt eines per `cover` dargestellten Videos. */
export function calculateCoverCrop(
  source: CaptureSize,
  viewport: CaptureSize,
  frame: Rectangle,
): Rectangle | undefined {
  if (source.width <= 0 || source.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return undefined
  }

  const scale = Math.max(viewport.width / source.width, viewport.height / source.height)
  const overflowX = (source.width * scale - viewport.width) / 2
  const overflowY = (source.height * scale - viewport.height) / 2
  const left = Math.max(0, (frame.x + overflowX) / scale)
  const top = Math.max(0, (frame.y + overflowY) / scale)
  const right = Math.min(source.width, (frame.x + frame.width + overflowX) / scale)
  const bottom = Math.min(source.height, (frame.y + frame.height + overflowY) / scale)
  const width = Math.floor(right) - Math.floor(left)
  const height = Math.floor(bottom) - Math.floor(top)
  if (width <= 0 || height <= 0) return undefined

  return {
    x: Math.floor(left),
    y: Math.floor(top),
    width,
    height,
  }
}

export class ViewfinderQRCodeReader extends BrowserQRCodeReader {
  private readonly captureCanvas = document.createElement('canvas')
  private video: HTMLVideoElement | undefined

  constructor(
    private readonly frame: HTMLElement,
    hints?: Map<DecodeHintType, unknown>,
    options?: IBrowserCodeReaderOptions,
    private readonly onDecodeAttempt?: () => void,
  ) {
    super(hints, options)
  }

  override decode(element: HTMLVideoElement | HTMLImageElement): Result {
    this.onDecodeAttempt?.()
    if (!(element instanceof HTMLVideoElement)) return super.decode(element)

    this.video = element
    if (!this.captureVideoFrame(element, 0)) return super.decode(element)
    return this.decodeFromCanvas(this.captureCanvas)
  }

  private captureVideoFrame(element: HTMLVideoElement, paddingRatio: number): boolean {
    const videoRect = element.getBoundingClientRect()
    const frameRect = this.frame.getBoundingClientRect()
    const crop = calculateCoverCrop(
      { width: element.videoWidth, height: element.videoHeight },
      { width: videoRect.width, height: videoRect.height },
      expandRectangle({
        x: frameRect.left - videoRect.left,
        y: frameRect.top - videoRect.top,
        width: frameRect.width,
        height: frameRect.height,
      }, paddingRatio),
    )
    if (crop === undefined) return false

    if (this.captureCanvas.width !== crop.width) this.captureCanvas.width = crop.width
    if (this.captureCanvas.height !== crop.height) this.captureCanvas.height = crop.height
    const context = this.captureCanvas.getContext('2d')
    if (context === null) return false
    context.drawImage(
      element,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    )
    return true
  }

  captureImageData(paddingRatio = 0): ImageData | undefined {
    if (this.video === undefined || !this.captureVideoFrame(this.video, paddingRatio)) return undefined
    const context = this.captureCanvas.getContext('2d')
    return context?.getImageData(0, 0, this.captureCanvas.width, this.captureCanvas.height)
  }
}

/** Dekodiert einen festgehaltenen QR-Frame mit ZXing-C++. */
export async function decodeQrWithWasm(imageData: ImageData): Promise<string | undefined> {
  const results = await readBarcodes(imageData, {
    formats: ['QRCode'],
    maxNumberOfSymbols: 1,
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
    tryDenoise: true,
  })
  return results.find((result) => result.isValid && result.text !== '')?.text
}

/** Aktiviert kontinuierlichen Autofokus, sofern Browser und Kamera ihn anbieten. */
export async function enableContinuousFocus(video: HTMLVideoElement): Promise<void> {
  const stream = video.srcObject
  if (!(stream instanceof MediaStream)) return
  const track = stream.getVideoTracks()[0]
  if (track === undefined) return
  const capabilities = track.getCapabilities() as ExtendedMediaTrackCapabilities
  if (!capabilities.focusMode?.includes('continuous')) return
  const advanced: ExtendedMediaTrackConstraintSet[] = [{ focusMode: 'continuous' }]
  await track.applyConstraints({ advanced })
}
