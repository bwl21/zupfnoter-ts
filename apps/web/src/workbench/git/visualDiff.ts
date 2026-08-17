export type VisualDiffMode = 'side-by-side' | 'overlay' | 'difference'

export interface SvgVisualDiff {
  width: number
  height: number
  differingPixels: number
  diffRatio: number
  diffDataUrl: string
}

interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** Browser-only SVG raster comparison used by the version dialog. */
export async function compareSvgVisuals(leftSvg: string, rightSvg: string): Promise<SvgVisualDiff> {
  const left = await rasterizeSvg(leftSvg)
  const right = await rasterizeSvg(rightSvg)
  const width = Math.max(left.width, right.width)
  const height = Math.max(left.height, right.height)
  const diffCanvas = document.createElement('canvas')
  diffCanvas.width = width
  diffCanvas.height = height
  const context = diffCanvas.getContext('2d')
  if (context === null) throw new Error('Der Browser kann keinen Pixelvergleich für SVG erzeugen')
  const diff = context.createImageData(width, height)
  let differingPixels = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const leftPixel = pixelAt(left, x, y)
      const rightPixel = pixelAt(right, x, y)
      const offset = (y * width + x) * 4
      const differs = leftPixel[0] !== rightPixel[0]
        || leftPixel[1] !== rightPixel[1]
        || leftPixel[2] !== rightPixel[2]
        || leftPixel[3] !== rightPixel[3]
      if (differs) {
        differingPixels += 1
        diff.data[offset] = 220
        diff.data[offset + 1] = 38
        diff.data[offset + 2] = 38
        diff.data[offset + 3] = 255
      } else {
        diff.data[offset + 3] = 0
      }
    }
  }
  context.putImageData(diff, 0, 0)
  return {
    width,
    height,
    differingPixels,
    diffRatio: width * height === 0 ? 0 : differingPixels / (width * height),
    diffDataUrl: diffCanvas.toDataURL('image/png'),
  }
}

export function svgViewportSize(svg: string): { width: number; height: number } {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const width = parseSvgDimension(root, 'width')
  const height = parseSvgDimension(root, 'height')
  const viewBox = root.match(/\bviewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i)
  return {
    width: Math.max(1, Math.round(width ?? Number(viewBox?.[1] ?? 800))),
    height: Math.max(1, Math.round(height ?? Number(viewBox?.[2] ?? 600))),
  }
}

async function rasterizeSvg(svg: string): Promise<RasterImage> {
  const size = svgViewportSize(svg)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('Der Browser kann kein SVG rendern')
  const image = new Image()
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('SVG konnte für den Vergleich nicht gerendert werden'))
    image.src = source
  })
  context.drawImage(image, 0, 0, size.width, size.height)
  return { width: size.width, height: size.height, data: context.getImageData(0, 0, size.width, size.height).data }
}

function parseSvgDimension(root: string, attribute: string): number | undefined {
  const match = root.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([\\d.]+)`,'i'))
  const value = Number(match?.[1])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function pixelAt(image: RasterImage, x: number, y: number): [number, number, number, number] {
  if (x >= image.width || y >= image.height) return [0, 0, 0, 0]
  const offset = (y * image.width + x) * 4
  return [image.data[offset] ?? 0, image.data[offset + 1] ?? 0, image.data[offset + 2] ?? 0, image.data[offset + 3] ?? 0]
}
