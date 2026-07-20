export interface JumplinePathInfo {
  from: { center: [number, number]; size: [number, number]; anchor: 'before' | 'after' }
  to: { center: [number, number]; size: [number, number]; anchor: 'before' | 'after' }
  vertical: number
  vertical_anchor: 'from' | 'to'
  jumpline_anchor: [number, number]
  verticalcut: number
}

export interface JumplinePathData {
  outlinePathData: string
}

function addPoint(point: [number, number], offset: [number, number]): [number, number] {
  return [point[0] + offset[0], point[1] + offset[1]]
}

function orientationX(delta: number): -1 | 0 | 1 {
  if (delta < 0) return -1
  if (delta > 0) return 1
  return 0
}

function orientationY(delta: number): -1 | 0 | 1 {
  if (delta < 0) return -1
  if (delta > 0) return 1
  return 0
}

/** Rebuilds the legacy jumpline outline for a changed vertical passage. */
export function makeJumplinePathData(info: JumplinePathInfo): JumplinePathData {
  const [anchorX, anchorY] = info.jumpline_anchor
  const from = info.from.center
  const to = info.to.center
  const fromAnchor = info.from.anchor === 'before' ? -1 : 1
  const toAnchor = info.to.anchor === 'before' ? -1 : 1
  const verticalAnchor = info.vertical_anchor === 'to' ? to : from
  const verticalX = verticalAnchor[0] + info.vertical
  const startOrientation = orientationX(verticalX - from[0])
  const endOrientation = orientationX(verticalX - to[0])
  const startOffset: [number, number] = [
    (info.from.size[0] + anchorX) * startOrientation,
    (info.from.size[1] + anchorY) * fromAnchor,
  ]
  const endOffset: [number, number] = [
    (info.to.size[0] + anchorX) * endOrientation,
    (info.to.size[1] + anchorY) * toAnchor,
  ]
  const p1 = addPoint(from, startOffset)
  const p2: [number, number] = [verticalX, from[1] + startOffset[1]]
  const p3: [number, number] = [verticalX, to[1] + endOffset[1]]
  const p4 = addPoint(to, endOffset)
  const p4Line = addPoint(p4, [2 * endOrientation, 0])
  const verticalCutY = info.verticalcut === 0
    ? p3[1] - p2[1]
    : (p3[1] > p2[1] ? info.verticalcut : -info.verticalcut)
  const vcp2 = addPoint(p2, [0, verticalCutY])
  const vcp3 = addPoint(p3, [0, -verticalCutY])
  const verticalOrientation = orientationY(p2[1] - p3[1])
  const lineCutEnd = addPoint(vcp2, [0, verticalOrientation])

  return {
    outlinePathData: [
      `M${p1[0]} ${p1[1]}`,
      `l${p2[0] - p1[0]} ${p2[1] - p1[1]}`,
      `l${lineCutEnd[0] - p2[0]} ${lineCutEnd[1] - p2[1]}`,
      `M${vcp3[0]} ${vcp3[1]}`,
      `L${p3[0]} ${p3[1]}`,
      `L${p4Line[0]} ${p4Line[1]}`,
    ].join(''),
  }
}
