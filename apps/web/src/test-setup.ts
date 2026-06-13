const zeroRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON() {
    return this
  },
} satisfies DOMRect

if (typeof Range !== 'undefined') {
  const rangeProto = Range.prototype as typeof Range.prototype & {
    getClientRects?: () => DOMRectList
    getBoundingClientRect?: () => DOMRect
  }

  if (typeof rangeProto.getClientRects !== 'function') {
    rangeProto.getClientRects = () => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as DOMRectList)
  }

  if (typeof rangeProto.getBoundingClientRect !== 'function') {
    rangeProto.getBoundingClientRect = () => zeroRect
  }
}
