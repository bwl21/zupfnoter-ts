import { ref } from 'vue'

export interface PreviewSelectionGestureHandlers {
  pointerDown(event: PointerEvent): void
  pointerUp(event: PointerEvent): void
  pointerCancel(): void
}

export interface PreviewSelectionRequest {
  startpos: number
  endpos: number
  extend: boolean
  startNewSegment: boolean
}

export function usePreviewSelectionGesture(
  hitboxSelector: string,
  onChange: (active: boolean) => void,
  onRequest: (request: PreviewSelectionRequest, element: Element) => void,
  onBackgroundClick: () => void,
): PreviewSelectionGestureHandlers {
  const gesture = ref<{
    x: number
    y: number
    target: Element | null
    shiftKey: boolean
    altKey: boolean
  } | null>(null)

  function pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !(event.target instanceof Element)) return
    // CodeMirror is deliberately focused after a projected score selection so
    // that typing can replace it immediately. A subsequent Shift-click in a
    // preview must therefore not reach the browser's native text-selection
    // handling; only the SelectionManager may extend the musical selection.
    event.preventDefault()
    const target = event.target.closest(hitboxSelector)
    if (gesture.value !== null) return
    gesture.value = {
      x: event.clientX,
      y: event.clientY,
      target,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    }
    onChange(true)
  }

  function pointerUp(event: PointerEvent): void {
    const currentGesture = gesture.value
    gesture.value = null
    onChange(false)
    if (currentGesture === null) return
    const distance = Math.hypot(
      event.clientX - currentGesture.x,
      event.clientY - currentGesture.y,
    )
    if (distance > 4) return
    if (currentGesture.target === null) {
      onBackgroundClick()
      return
    }
    const startpos = Number(currentGesture.target.getAttribute('data-start-char'))
    const endpos = Number(currentGesture.target.getAttribute('data-end-char'))
    if (Number.isNaN(startpos) || Number.isNaN(endpos)) return
    onRequest({
      startpos,
      endpos,
      extend: currentGesture.shiftKey && !currentGesture.altKey,
      startNewSegment: currentGesture.shiftKey && currentGesture.altKey,
    }, currentGesture.target)
  }

  function pointerCancel(): void {
    if (gesture.value === null) return
    gesture.value = null
    onChange(false)
  }

  return {
    pointerDown,
    pointerUp,
    pointerCancel,
  }
}
