import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref, watch } from 'vue'

interface SvgSize {
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

interface FrameMetrics {
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  paddingBottom: number
  viewportWidth: number
  viewportHeight: number
}

interface PanState {
  pointerId: number
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
}

export function computeWheelZoomDelta(deltaY: number): number {
  const magnitude = Math.abs(deltaY)
  const curved = Math.pow(magnitude / 120, 0.7) * 5
  return Math.min(12, Math.max(1, Math.round(curved)))
}

export function useZoomableSvgPreview(svgSource: Ref<string>, zoom: Ref<number>) {
  const frameRef = ref<HTMLElement | null>(null)
  const canvasRef = ref<HTMLElement | null>(null)
  const frameMetrics = ref<FrameMetrics | null>(null)
  const contentSize = ref<SvgSize | null>(null)
  const lastPointer = ref<Point | null>(null)
  const panState = ref<PanState | null>(null)

  let resizeObserver: ResizeObserver | undefined

  function readFrameMetrics(frame: HTMLElement): FrameMetrics {
    const style = getComputedStyle(frame)
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
    const paddingRight = Number.parseFloat(style.paddingRight) || 0
    const paddingTop = Number.parseFloat(style.paddingTop) || 0
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0

    return {
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      viewportWidth: Math.max(0, frame.clientWidth - paddingLeft - paddingRight),
      viewportHeight: Math.max(0, frame.clientHeight - paddingTop - paddingBottom),
    }
  }

  function syncFrameSize(): void {
    const frame = frameRef.value
    if (frame === null) {
      frameMetrics.value = null
      return
    }

    frameMetrics.value = readFrameMetrics(frame)
  }

  function syncSvgSize(): void {
    const source = canvasRef.value
    if (source === null) {
      contentSize.value = null
      return
    }

    const measurement = source.cloneNode(true)
    if (!(measurement instanceof HTMLElement)) {
      contentSize.value = null
      return
    }

    measurement.style.position = 'absolute'
    measurement.style.left = '-10000px'
    measurement.style.top = '0'
    measurement.style.visibility = 'hidden'
    measurement.style.pointerEvents = 'none'
    measurement.style.width = 'max-content'
    measurement.style.height = 'max-content'
    measurement.style.display = 'inline-block'
    measurement.style.overflow = 'visible'

    document.body.appendChild(measurement)
    try {
      const rect = measurement.getBoundingClientRect()
      contentSize.value = rect.width > 0 && rect.height > 0
        ? { width: rect.width, height: rect.height }
        : null
    } finally {
      measurement.remove()
    }
  }

  async function measure(): Promise<void> {
    await nextTick()
    syncFrameSize()
    syncSvgSize()
  }

  const fitScale = computed(() => {
    const metrics = frameMetrics.value
    const content = contentSize.value
    if (metrics === null || content === null || metrics.viewportWidth <= 0 || content.width <= 0) {
      return 1
    }

    return metrics.viewportWidth / content.width
  })

  const displayScale = computed(() => fitScale.value * (zoom.value / 100))

  const canvasStyle = computed(() => {
    const content = contentSize.value
    if (content === null) {
      return undefined
    }

    return {
      width: `${content.width * displayScale.value}px`,
      height: `${content.height * displayScale.value}px`,
    }
  })

  function getFocusPoint(): Point | null {
    const frame = frameRef.value
    const metrics = frameMetrics.value
    if (frame === null) {
      return null
    }

    const rect = frame.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0 || metrics === null || metrics.viewportWidth <= 0 || metrics.viewportHeight <= 0) {
      return null
    }

    return lastPointer.value ?? {
      x: metrics.paddingLeft + metrics.viewportWidth / 2,
      y: metrics.paddingTop + metrics.viewportHeight / 2,
    }
  }

  async function applyZoom(nextZoom: number, focusPoint?: Point | null): Promise<void> {
    const frame = frameRef.value
    const previousZoom = zoom.value

    zoom.value = Math.min(400, Math.max(25, nextZoom))

    await nextTick()

    if (frame === null) {
      return
    }

    const content = contentSize.value
    const frameContentMetrics = frameMetrics.value
    const focus = focusPoint ?? getFocusPoint()
    if (content === null || frameContentMetrics === null || focus === null || previousZoom <= 0) {
      return
    }

    const ratio = zoom.value / previousZoom
    if (!Number.isFinite(ratio) || ratio === 1) {
      return
    }

    const nextScrollLeft = (frame.scrollLeft + focus.x) * ratio - focus.x
    const nextScrollTop = (frame.scrollTop + focus.y) * ratio - focus.y

    const maxScrollLeft = Math.max(0, (content.width * displayScale.value) - frameContentMetrics.viewportWidth)
    const maxScrollTop = Math.max(0, (content.height * displayScale.value) - frameContentMetrics.viewportHeight)

    frame.scrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft))
    frame.scrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop))
  }

  function onPointerMove(event: PointerEvent): void {
    const frame = frameRef.value
    const metrics = frameMetrics.value
    if (frame === null) {
      return
    }

    const rect = frame.getBoundingClientRect()
    const borderLeft = frame.clientLeft
    const borderTop = frame.clientTop
    const paddingLeft = metrics?.paddingLeft ?? 0
    const paddingTop = metrics?.paddingTop ?? 0

    if (panState.value !== null && panState.value.pointerId === event.pointerId) {
      const nextScrollLeft = panState.value.startScrollLeft - (event.clientX - panState.value.startX)
      const nextScrollTop = panState.value.startScrollTop - (event.clientY - panState.value.startY)
      frame.scrollLeft = Math.max(0, nextScrollLeft)
      frame.scrollTop = Math.max(0, nextScrollTop)
      return
    }

    lastPointer.value = {
      x: event.clientX - rect.left - borderLeft - paddingLeft,
      y: event.clientY - rect.top - borderTop - paddingTop,
    }
  }

  function onPointerDown(event: PointerEvent): void {
    const frame = frameRef.value
    if (frame === null || event.button !== 0) {
      return
    }

    event.preventDefault()
    panState.value = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: frame.scrollLeft,
      startScrollTop: frame.scrollTop,
    }

    if (typeof frame.setPointerCapture === 'function') {
      try {
        frame.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors in test environments.
      }
    }
  }

  function finishPan(event: PointerEvent): void {
    if (panState.value === null || panState.value.pointerId !== event.pointerId) {
      return
    }

    panState.value = null

    const frame = frameRef.value
    if (frame !== null && typeof frame.releasePointerCapture === 'function') {
      try {
        frame.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors in test environments.
      }
    }
  }

  function onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) {
      return
    }

    event.preventDefault()

    const direction = event.deltaY < 0 ? 1 : -1
    const delta = computeWheelZoomDelta(event.deltaY)
    const frame = frameRef.value
    const metrics = frameMetrics.value
    if (frame === null) {
      return
    }

    const rect = frame.getBoundingClientRect()
    const borderLeft = frame.clientLeft
    const borderTop = frame.clientTop
    const paddingLeft = metrics?.paddingLeft ?? 0
    const paddingTop = metrics?.paddingTop ?? 0
    const focus = {
      x: event.clientX - rect.left - borderLeft - paddingLeft,
      y: event.clientY - rect.top - borderTop - paddingTop,
    }
    void applyZoom(zoom.value + direction * delta, focus)
  }

  function setZoom(nextZoom: number): Promise<void> {
    return applyZoom(nextZoom)
  }

  watch(svgSource, () => {
    void measure()
  }, { immediate: true })

  onMounted(() => {
    void measure()

    if (typeof ResizeObserver !== 'undefined' && frameRef.value !== null) {
      resizeObserver = new ResizeObserver(() => {
        syncFrameSize()
        syncSvgSize()
      })
      resizeObserver.observe(frameRef.value)
    }
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
  })

  return {
    canvasRef,
    canvasStyle,
    frameRef,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishPan,
    onPointerCancel: finishPan,
    onWheel,
    setZoom,
  }
}
