export interface BezierPathInfo {
  from: [number, number]
  to: [number, number]
  cp1: [number, number]
  cp2: [number, number]
}

export function makeBezierPathData(info: BezierPathInfo): string {
  const [fromX, fromY] = info.from
  const cp1 = relativePoint(info.cp1, info.from)
  const cp2 = relativePoint(info.cp2, info.from)
  const to = relativePoint(info.to, info.from)
  return `M${fromX} ${fromY}c${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${to[0]} ${to[1]}`
}

/** Converts an absolute control point back to Legacy's local flowline value. */
export function bezierControlToLegacyValue(
  from: [number, number],
  to: [number, number],
  control: [number, number],
  anchor: 'from' | 'to' = 'from',
): [number, number] {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
  const translated = relativePoint(control, anchor === 'from' ? from : to)
  const value = rotate(rotate(translated, Math.PI * 0.5), -angle)
  return value.map((coordinate) => Math.round(coordinate * 100) / 100) as [number, number]
}

function relativePoint(point: [number, number], origin: [number, number]): [number, number] {
  return [point[0] - origin[0], point[1] - origin[1]]
}

function rotate(point: [number, number], angle: number): [number, number] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos]
}
