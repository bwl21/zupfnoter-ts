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

if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>()
  const localStorageMock: Storage = {
    get length() {
      return storage.size
    },
    clear() {
      storage.clear()
    },
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value))
    },
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  })
}

if (typeof globalThis.__ZUPFNOTER_BUILD_INFO__ === 'undefined') {
  Object.defineProperty(globalThis, '__ZUPFNOTER_BUILD_INFO__', {
    value: {
      appVersion: '0.1.0-test',
      commitHash: 'test-build',
      buildTime: new Date('2026-06-17T00:00:00.000Z').toISOString(),
    },
    configurable: true,
  })
}
