<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ComparisonLayout, { type ComparisonCase, type ComparisonViewMode } from '@/components/ComparisonLayout.vue'
import {
  fetchViewSvg,
  fetchViewSvgCases,
  getCaseLabel,
  type SvgSource,
  type ViewSvgCaseDetails,
} from '@/lib/viewSvgApi'

type DeviationKind = 'position' | 'size' | 'style' | 'visibility' | 'order' | 'wrong-element' | 'other'

const BLINK_INTERVAL_MS = 500

interface LoadedSvg {
  svg: string
  source: SvgSource
  extractNr: number
  caseId: string
}

interface SvgSelectionInfo {
  source: SvgSource
  tagName: string
  role: string
  type: string
  anchor: string
  anchorKey: string
  index: number
  elementId: string | null
  className: string | null
  confKey: string | null
  znId: string | null
  selectorCandidates: string[]
}

interface SvgAttributeInfo {
  name: string
  value: string
}

interface SvgElementInfo {
  source: SvgSource
  tagName: string
  elementId: string | null
  className: string | null
  attributes: SvgAttributeInfo[]
  dataAttributes: SvgAttributeInfo[]
  semantic: SvgSelectionInfo | null
}

interface SelectionHighlight {
  source: SvgSource
  left: number
  top: number
  width: number
  height: number
  label: string
}

const deviationOptions: Array<{ kind: DeviationKind; label: string }> = [
  { kind: 'position', label: 'Position' },
  { kind: 'size', label: 'Größe' },
  { kind: 'style', label: 'Stil / Linienstärke' },
  { kind: 'visibility', label: 'Sichtbarkeit' },
  { kind: 'order', label: 'Reihenfolge / Layering' },
  { kind: 'wrong-element', label: 'Falsches Element' },
  { kind: 'other', label: 'Sonstiges' },
]

const cases = ref<ViewSvgCaseDetails[]>([])
const selectedCaseId = ref('')
const selectedExtract = ref(0)
const selectedMode = ref<ComparisonViewMode>('blink')
const swipePosition = ref(50)
const loading = ref(false)
const error = ref<string | null>(null)
const legacySvg = ref<LoadedSvg | null>(null)
const tsSvg = ref<LoadedSvg | null>(null)
const blinkVisible = ref<'legacy' | 'ts'>('legacy')
const selectedDeviation = ref<DeviationKind>('position')
const promptNote = ref('')
const selectedElement = ref<SvgElementInfo | null>(null)
const hoveredElement = ref<SvgElementInfo | null>(null)
const selectedHighlight = ref<SelectionHighlight | null>(null)
const promptFeedback = ref<string | null>(null)
const hoverInspectorEnabled = ref(true)
const hoveredDomClassName = 'viewsvg-hovered-element'
const legacySurfaceRef = ref<HTMLElement | null>(null)
const tsSurfaceRef = ref<HTMLElement | null>(null)
const selectedDomElement = ref<Element | null>(null)
const hoveredDomElement = ref<Element | null>(null)
let blinkTimer: number | undefined

const selectedCase = computed(() => cases.value.find((caseItem) => caseItem.id === selectedCaseId.value) ?? null)

const availableExtracts = computed(() => {
  const caseItem = selectedCase.value
  if (caseItem === null) return [] as number[]
  return [...new Set([...caseItem.legacyExtracts, ...caseItem.tsExtracts])].sort((a, b) => a - b)
})

const legacySvgMarkup = computed(() => decorateSvg(legacySvg.value?.svg ?? '', 'legacy'))
const tsSvgMarkup = computed(() => decorateSvg(tsSvg.value?.svg ?? '', 'ts'))

const hasLegacy = computed(() => legacySvg.value !== null)
const hasTs = computed(() => tsSvg.value !== null)
const visibleBlinkLabel = computed(() => (blinkVisible.value === 'legacy' ? 'Legacy' : 'TS'))
const selectedElementCounterpart = computed(() => findCounterpartSelection(selectedElement.value?.semantic ?? null))
const hoveredElementCounterpart = computed(() => findCounterpartSelection(hoveredElement.value?.semantic ?? null))
const generatedPrompt = computed(() => buildPrompt(selectedElement.value, selectedElementCounterpart.value, selectedDeviation.value, promptNote.value))
const sidebarCases = computed<ComparisonCase[]>(() => cases.value.map((caseItem) => ({
  id: caseItem.id,
  label: getCaseLabel(caseItem),
})))
const hoverTooltipContent = computed(() => {
  if (hoverInspectorEnabled.value === false) return 'Hover-Inspector aktivieren'

  const element = hoveredElement.value
  if (element === null) return 'Über ein SVG-Element fahren, um Details zu sehen.'

  const metadata = formatMetadataList(element)
    .slice(0, 4)
    .map((entry) => `${entry.label}: ${entry.value}`)
  const counterpart = hoveredElementCounterpart.value
  const counterpartText = counterpart === null
    ? []
    : [`Gegenstück: ${counterpart.source === 'legacy' ? 'Legacy' : 'TS'} · ${counterpart.role} · ${counterpart.type}`]

  return [
    `Quelle: ${element.source === 'legacy' ? 'Legacy' : 'TS'}`,
    `Tag: ${element.tagName}`,
    ...metadata,
    ...counterpartText,
  ].join('\n')
})
const selectedHighlightStyle = computed(() => {
  const highlight = selectedHighlight.value
  if (highlight === null) return {}
  return {
    left: `${highlight.left}px`,
    top: `${highlight.top}px`,
    width: `${highlight.width}px`,
    height: `${highlight.height}px`,
  }
})

async function loadCases(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const loadedCases = await fetchViewSvgCases()
    cases.value = loadedCases
    if (selectedCaseId.value === '' && loadedCases.length > 0) {
      selectedCaseId.value = loadedCases[0]?.id ?? ''
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function loadSelectedSvgs(caseId: string, extractNr: number): Promise<void> {
  const caseItem = cases.value.find((entry) => entry.id === caseId) ?? null
  if (caseItem === null) {
    legacySvg.value = null
    tsSvg.value = null
    selectedElement.value = null
    hoveredElement.value = null
    selectedHighlight.value = null
    selectedDomElement.value = null
    hoveredDomElement.value = null
    return
  }

  loading.value = true
  error.value = null
  selectedElement.value = null
  hoveredElement.value = null
  selectedHighlight.value = null
  selectedDomElement.value = null
  hoveredDomElement.value = null
  promptFeedback.value = null

  const legacyPromise = caseItem.legacyExtracts.includes(extractNr)
    ? fetchViewSvg(caseItem.id, 'legacy', extractNr)
    : Promise.resolve(null)
  const tsPromise = caseItem.tsExtracts.includes(extractNr)
    ? fetchViewSvg(caseItem.id, 'ts', extractNr)
    : Promise.resolve(null)

  try {
    const [legacyResult, tsResult] = await Promise.all([legacyPromise, tsPromise])
    legacySvg.value = legacyResult
    tsSvg.value = tsResult
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    legacySvg.value = null
    tsSvg.value = null
  } finally {
    loading.value = false
  }
}

function ensureBlinkTimer(): void {
  if (blinkTimer !== undefined) {
    window.clearInterval(blinkTimer)
    blinkTimer = undefined
  }

  if (selectedMode.value !== 'blink') {
    blinkVisible.value = 'legacy'
    return
  }

  blinkVisible.value = hasLegacy.value ? 'legacy' : 'ts'
  if (!hasLegacy.value || !hasTs.value) return

  blinkTimer = window.setInterval(() => {
    toggleBlinkVisible()
  }, BLINK_INTERVAL_MS)
}

function selectCase(caseId: string): void {
  selectedCaseId.value = caseId
}

function clearPromptSelection(): void {
  selectedElement.value = null
  hoveredElement.value = null
  selectedHighlight.value = null
  selectedDomElement.value = null
  hoveredDomElement.value = null
  promptNote.value = ''
  promptFeedback.value = null
}

function toggleHoverInspector(): void {
  hoverInspectorEnabled.value = !hoverInspectorEnabled.value
  if (!hoverInspectorEnabled.value) {
    hoveredElement.value = null
  }
}

function toggleBlinkVisible(): void {
  if (selectedMode.value !== 'blink') return
  const nextSource = blinkVisible.value === 'legacy' ? 'ts' : 'legacy'
  if (nextSource === 'legacy' && !hasLegacy.value) return
  if (nextSource === 'ts' && !hasTs.value) return
  blinkVisible.value = nextSource
}

async function selectSvgElement(source: SvgSource, event: MouseEvent): Promise<void> {
  const surface = event.currentTarget instanceof Element ? event.currentTarget : null
  const selectedTarget = findSvgElementAtPoint(surface, event)
  if (selectedTarget === null) return

  const selection = buildElementInfo(source, selectedTarget)
  if (selection === null) return

  selectedElement.value = selection
  selectedDomElement.value = selectedTarget
  promptNote.value = ''
  promptFeedback.value = null
  await nextTick()
  refreshSelectionHighlight()
}

async function updateHoveredElement(source: SvgSource, event: MouseEvent): Promise<void> {
  if (hoverInspectorEnabled.value === false) return

  const surface = event.currentTarget instanceof Element ? event.currentTarget : null
  const hoveredTarget = findSvgElementAtPoint(surface, event)
  if (hoveredTarget === null) {
    hoveredElement.value = null
    hoveredDomElement.value = null
    return
  }

  const selection = buildElementInfo(source, hoveredTarget)
  if (selection === null) return

  hoveredElement.value = selection
  hoveredDomElement.value = hoveredTarget
  await nextTick()
}

function clearHoveredElement(): void {
  if (hoverInspectorEnabled.value === false) return
  hoveredElement.value = null
  hoveredDomElement.value = null
}

function findSvgElementAtPoint(surface: Element | null, event: MouseEvent): SVGElement | null {
  const directTarget = event.target
  if (directTarget instanceof SVGElement && directTarget.tagName.toLowerCase() !== 'svg') {
    if (surface === null || surface.contains(directTarget)) return directTarget
  }

  if (surface !== null) {
    const elements = document.elementsFromPoint(event.clientX, event.clientY)
    for (const entry of elements) {
      if (!(entry instanceof SVGElement)) continue
      if (surface !== entry && surface.contains(entry) === false) continue
      if (entry.tagName.toLowerCase() === 'svg') continue
      return entry
    }
  }

  const path = event.composedPath()
  for (const entry of path) {
    if (!(entry instanceof SVGElement)) continue
    if (surface !== null && surface.contains(entry) === false) continue
    if (entry.tagName.toLowerCase() === 'svg') continue
    return entry
  }

  for (const entry of path) {
    if (!(entry instanceof SVGElement)) continue
    if (surface !== null && surface.contains(entry) === false) continue
    return entry
  }

  const geometryTarget = findSvgGeometryElementAtPoint(surface, event)
  if (geometryTarget !== null) return geometryTarget

  return null
}

function findSvgGeometryElementAtPoint(surface: Element | null, event: MouseEvent): SVGElement | null {
  const rootSvg = getRootSvgElement(surface)
  if (rootSvg === null) return null

  const candidates = Array.from(surface?.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse') ?? [])
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index]
    if (!(candidate instanceof SVGGraphicsElement)) continue
    if (isVisibleSvgElement(candidate) === false) continue

    const screenCtm = candidate.getScreenCTM()
    if (screenCtm === null) continue

    const localPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(screenCtm.inverse())
    const geometryCandidate = candidate as unknown as SVGGeometryElement

    if (typeof geometryCandidate.isPointInStroke === 'function' && geometryCandidate.isPointInStroke(localPoint)) {
      return candidate
    }

    if (typeof geometryCandidate.isPointInFill === 'function' && geometryCandidate.isPointInFill(localPoint)) {
      return candidate
    }
  }

  return null
}

function getRootSvgElement(surface: Element | null): SVGSVGElement | null {
  if (surface instanceof SVGSVGElement) return surface
  const svg = surface?.querySelector('svg') ?? null
  return svg instanceof SVGSVGElement ? svg : null
}

function isVisibleSvgElement(element: SVGGraphicsElement): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
  if (style.opacity === '0') return false
  return true
}

function getSurfaceElement(source: SvgSource): HTMLElement | null {
  return source === 'legacy' ? legacySurfaceRef.value : tsSurfaceRef.value
}

function refreshSelectionHighlight(): void {
  const selection = selectedElement.value
  if (selection === null) {
    selectedHighlight.value = null
    return
  }

  const surface = getSurfaceElement(selection.source)
  if (surface === null) {
    selectedHighlight.value = null
    return
  }

  const target = selectedDomElement.value !== null && selectedDomElement.value.isConnected && surface.contains(selectedDomElement.value)
    ? selectedDomElement.value
    : findElementForSelection(surface, selection.semantic)
  if (target === null) {
    selectedHighlight.value = null
    return
  }

  const surfaceRect = surface.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  selectedHighlight.value = {
    source: selection.source,
    left: targetRect.left - surfaceRect.left + surface.scrollLeft,
    top: targetRect.top - surfaceRect.top + surface.scrollTop,
    width: targetRect.width,
    height: targetRect.height,
    label: selection.semantic !== null ? `${selection.semantic.role} · ${selection.semantic.type}` : selection.tagName,
  }
}

function formatMetadataList(selection: SvgElementInfo | null): Array<{ label: string; value: string }> {
  if (selection === null) return []
  const rows = [
    { label: 'source', value: sourceLabel(selection.source) },
    { label: 'tag', value: selection.tagName },
    { label: 'id', value: selection.elementId ?? '—' },
    { label: 'class', value: selection.className ?? '—' },
  ]

  if (selection.dataAttributes.length === 0) {
    rows.push({ label: 'data-*', value: 'keine' })
    return rows
  }

  rows.push(...selection.dataAttributes.map((attribute) => ({ label: attribute.name, value: attribute.value })))
  return rows
}

function findElementForSelection(surface: HTMLElement, selection: SvgSelectionInfo | null): Element | null {
  if (selection === null) return null
  for (const selector of selection.selectorCandidates) {
    const match = surface.querySelector(selector)
    if (match !== null) return match
  }
  return null
}

function decorateSvg(svg: string, source: SvgSource): string {
  if (svg.trim() === '') return ''
  const className = source === 'legacy' ? 'viewsvg-surface viewsvg-surface--legacy' : 'viewsvg-surface viewsvg-surface--ts'
  const style = '<style type="text/css">rect.abcref, rect.zupfnoter-hitbox { fill: none !important; stroke: none !important; opacity: 0 !important; }</style>'
  const withClass = svg.replace('<svg ', `<svg class="${className}" `)
  const openTagEnd = withClass.indexOf('>')
  if (openTagEnd < 0) return withClass
  return `${withClass.slice(0, openTagEnd + 1)}${style}${withClass.slice(openTagEnd + 1)}`
}

function buildElementInfo(source: SvgSource, element: Element): SvgElementInfo | null {
  const attributes = readAttributes(element)
  const dataAttributes = attributes.filter((attribute) => attribute.name.startsWith('data-'))
  return {
    source,
    tagName: element.tagName.toLowerCase(),
    elementId: getTrimmedAttributeUpTree(element, 'id'),
    className: getTrimmedAttributeUpTree(element, 'class'),
    attributes,
    dataAttributes,
    semantic: buildSelectionInfo(source, element),
  }
}

function syncHoveredDomClass(previous: Element | null, next: Element | null): void {
  if (previous !== null) previous.classList.remove(hoveredDomClassName)
  if (next !== null) next.classList.add(hoveredDomClassName)
}

function readAttributes(element: Element): SvgAttributeInfo[] {
  return Array.from(element.attributes).map((attribute) => ({
    name: attribute.name,
    value: attribute.value,
  }))
}

function getTrimmedAttribute(element: Element, attributeName: string): string | null {
  const value = element.getAttribute(attributeName)?.trim() ?? ''
  return value.length > 0 ? value : null
}

function buildSelectionInfo(source: SvgSource, element: Element): SvgSelectionInfo | null {
  const semanticSourceElement = findSemanticSourceElement(element)
  const semanticElement = semanticSourceElement ?? element

  const role = getTrimmedAttributeUpTree(element, 'data-role') ?? ''
  const type = getTrimmedAttributeUpTree(element, 'data-type') ?? ''
  const anchor = getTrimmedAttributeUpTree(element, 'data-anchor') ?? ''
  const anchorKey = getTrimmedAttributeUpTree(element, 'data-anchor-key') ?? ''
  const indexValue = getTrimmedAttributeUpTree(element, 'data-index') ?? ''
  const index = Number.parseInt(indexValue, 10)
  if (role === '' || type === '' || anchor === '' || anchorKey === '' || !Number.isInteger(index)) return null

  const elementId = getTrimmedAttribute(element, 'id')
  const className = getTrimmedAttribute(element, 'class')
  const confKey = getTrimmedAttributeUpTree(element, 'data-conf-key')
  const znId = getTrimmedAttributeUpTree(element, 'data-zn-id')

  return {
    source,
    tagName: element.tagName.toLowerCase(),
    role,
    type,
    anchor,
    anchorKey,
    index,
    elementId,
    className,
    confKey,
    znId,
    selectorCandidates: buildSelectionSelectors({
      source,
      tagName: semanticElement.tagName.toLowerCase(),
      role,
      type,
      anchor,
      anchorKey,
      index,
      elementId: elementId !== null && elementId.trim().length > 0 ? elementId : null,
      className: className !== null && className.trim().length > 0 ? className : null,
      confKey: confKey !== null && confKey.trim().length > 0 ? confKey : null,
      znId: znId !== null && znId.trim().length > 0 ? znId : null,
      selectorCandidates: [],
    }),
  }
}

function getTrimmedAttributeUpTree(element: Element, attributeName: string): string | null {
  let current: Element | null = element
  while (current !== null) {
    const value = current.getAttribute(attributeName)?.trim() ?? ''
    if (value.length > 0) return value
    current = current.parentElement
  }
  return null
}

function findSemanticSourceElement(element: Element): Element | null {
  let current: Element | null = element
  while (current !== null) {
    if (
      getTrimmedAttribute(current, 'data-role') !== null ||
      getTrimmedAttribute(current, 'data-type') !== null ||
      getTrimmedAttribute(current, 'data-anchor') !== null ||
      getTrimmedAttribute(current, 'data-anchor-key') !== null ||
      getTrimmedAttribute(current, 'data-index') !== null ||
      getTrimmedAttribute(current, 'data-conf-key') !== null ||
      getTrimmedAttribute(current, 'data-zn-id') !== null
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function buildSelectionSelectors(selection: SvgSelectionInfo): string[] {
  const selectors: string[] = []
  if (selection.confKey !== null) selectors.push(attributeSelector('data-conf-key', selection.confKey))
  if (selection.znId !== null) selectors.push(attributeSelector('data-zn-id', selection.znId))
  selectors.push(attributeSelector('data-anchor-key', selection.anchorKey))
  selectors.push(attributeSelector('data-anchor', selection.anchor))
  selectors.push(
    `${attributeSelector('data-role', selection.role)}${attributeSelector('data-type', selection.type)}${attributeSelector('data-index', `${selection.index}`)}`,
  )
  return [...new Set(selectors)]
}

function attributeSelector(attributeName: string, value: string): string {
  const escapedValue = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `[${attributeName}="${escapedValue}"]`
}

function findCounterpartSelection(selection: SvgSelectionInfo | null): SvgSelectionInfo | null {
  if (selection === null) return null

  const otherSource: SvgSource = selection.source === 'legacy' ? 'ts' : 'legacy'
  const otherSvg = otherSource === 'legacy' ? legacySvg.value?.svg : tsSvg.value?.svg
  if (otherSvg === undefined || otherSvg === null || otherSvg.trim() === '') return null

  const parsed = new DOMParser().parseFromString(otherSvg, 'image/svg+xml')
  const root = parsed.documentElement
  if (root.tagName.toLowerCase() === 'parsererror') return null

  for (const selector of selection.selectorCandidates) {
    const match = root.querySelector(selector)
    if (match !== null) {
      return buildSelectionInfo(otherSource, match)
    }
  }

  return null
}

function sourceLabel(source: SvgSource): string {
  return source === 'legacy' ? 'Legacy' : 'TS'
}

function nodeCategoryLabel(selection: SvgElementInfo | null): string {
  if (selection === null) return '—'

  const className = selection.className ?? ''
  const role = selection.semantic?.role ?? ''
  const type = selection.semantic?.type ?? ''

  if (className.includes('zupfnoter-hitbox') || role === 'hitbox') return 'Hitbox'
  if (className.includes('zupfnoter-role--barover') || role === 'barover') return 'Barover'
  if (className.includes('zupfnoter-shape--glyph') || type === 'Glyph' || role === 'rest') return 'Glyph'
  if (type.length > 0) return type
  return selection.tagName
}

watch(hoveredDomElement, (next, previous) => {
  syncHoveredDomClass(previous, next)
})

function deviationLabel(kind: DeviationKind): string {
  return deviationOptions.find((entry) => entry.kind === kind)?.label ?? 'Sonstiges'
}

function describeSelection(selection: SvgElementInfo | SvgSelectionInfo): string[] {
  const semantic = 'semantic' in selection ? selection.semantic : selection
  const lines = [
    `- Quelle: ${sourceLabel(selection.source)}`,
    `- Element: <${selection.tagName}>`,
    selection.elementId !== null ? `- id: ${selection.elementId}` : null,
    selection.className !== null ? `- class: ${selection.className}` : null,
  ].filter((entry): entry is string => entry !== null)

  if (semantic === null) {
    lines.push('- semantische Metadaten: keine')
    return lines
  }

  lines.push(
    `- data-role: ${semantic.role}`,
    `- data-type: ${semantic.type}`,
    `- data-anchor: ${semantic.anchor}`,
    `- data-anchor-key: ${semantic.anchorKey}`,
    `- data-index: ${semantic.index}`,
  )

  if (semantic.confKey !== null) {
    lines.push(`- data-conf-key: ${semantic.confKey}`)
  }

  if (semantic.znId !== null) {
    lines.push(`- data-zn-id: ${semantic.znId}`)
  }

  return lines
}

function buildPrompt(
  selection: SvgElementInfo | null,
  counterpart: SvgSelectionInfo | SvgElementInfo | null,
  deviationKind: DeviationKind,
  note: string,
): string {
  if (selectedCase.value === null || selection === null) {
    return 'Wähle zuerst ein SVG-Element aus.'
  }

  const lines: string[] = [
    `Bitte untersuche und korrigiere die Abweichung im Case \`${selectedCase.value.id}\`, Extract \`${selectedExtract.value}\`.`,
    '',
    `Abweichung: ${deviationLabel(deviationKind)}`,
    '',
    'Ausgewähltes Element:',
    ...describeSelection(selection),
    '',
    ...(counterpart === null
      ? [`Gegenstück in ${sourceLabel(selection.source === 'legacy' ? 'ts' : 'legacy')} wurde nicht eindeutig gefunden.`]
      : [
          `Gegenstück in ${sourceLabel(counterpart.source)}:`,
          ...describeSelection(counterpart),
        ]),
    '',
    'Aufgabe:',
    '- Ursache der Abweichung im Layout- oder Renderpfad identifizieren.',
    '- Nur die betroffene Logik korrigieren.',
    '- Keine Änderungen an nicht betroffenen Elementen, Hitboxes oder Exportformaten.',
  ]

  if (note.trim().length > 0) {
    lines.push('', 'Hinweis:', note.trim())
  }

  return lines.join('\n')
}

async function copyPromptToClipboard(): Promise<void> {
  const text = generatedPrompt.value.trim()
  if (text.length === 0 || text === 'Wähle zuerst ein SVG-Element aus.') return

  try {
    await navigator.clipboard.writeText(text)
    promptFeedback.value = 'Prompt kopiert.'
  } catch {
    promptFeedback.value = 'Kopieren fehlgeschlagen.'
  }
}

watch([selectedCaseId, selectedExtract], async ([caseId, extractNr]) => {
  if (caseId === '') return
  await loadSelectedSvgs(caseId, extractNr)
})

watch(selectedCaseId, () => {
  const caseItem = selectedCase.value
  if (caseItem === null) return
  const fallbackExtract = caseItem.legacyExtracts[0] ?? caseItem.tsExtracts[0] ?? 0
  selectedExtract.value = fallbackExtract
})

watch([selectedMode, hasLegacy, hasTs], () => {
  ensureBlinkTimer()
  void nextTick().then(() => {
    refreshSelectionHighlight()
  })
})

watch(selectedElement, () => {
  refreshSelectionHighlight()
})

onMounted(async () => {
  await loadCases()
  ensureBlinkTimer()
  window.addEventListener('resize', refreshSelectionHighlight)
})

onBeforeUnmount(() => {
  if (blinkTimer !== undefined) window.clearInterval(blinkTimer)
  window.removeEventListener('resize', refreshSelectionHighlight)
})
</script>

<template>
  <ComparisonLayout
    format="SVG"
    :case-items="sidebarCases"
    :selected-case-id="selectedCaseId"
    :selected-extract="selectedExtract"
    :available-extracts="availableExtracts"
    :selected-mode="selectedMode"
    :swipe-position="swipePosition"
    :has-legacy="hasLegacy"
    :has-ts="hasTs"
    :hover-available="true"
    :hover-active="hoverInspectorEnabled"
    :hover-tooltip="hoverTooltipContent"
    :prompt-active="selectedElement !== null"
    :loading="loading"
    :error="error"
    @select-case="selectCase"
    @update:selected-extract="selectedExtract = $event"
    @update:selected-mode="selectedMode = $event"
    @update:swipe-position="swipePosition = $event"
    @toggle-hover="toggleHoverInspector"
  >
    <template #prompt>

      <p v-if="selectedElement === null" class="viewsvg-hint">SVG-Element übernehmen, um einen Korrektur-Prompt zu erzeugen.</p>

      <template v-else>
        <div class="viewsvg-prompt-meta">
          <div><strong>Quelle:</strong> {{ selectedElement.source === 'legacy' ? 'Legacy' : 'TS' }}</div>
          <div><strong>Tag:</strong> {{ selectedElement.tagName }}</div>
          <div><strong>Knoten:</strong> {{ nodeCategoryLabel(selectedElement) }}</div>
          <div><strong>ID:</strong> {{ selectedElement.elementId ?? '—' }}</div>
          <div><strong>Klasse:</strong> {{ selectedElement.className ?? '—' }}</div>
        </div>

          <div v-if="selectedElement.semantic !== null" class="viewsvg-prompt-meta">
            <div><strong>Role:</strong> {{ selectedElement.semantic.role }}</div>
            <div><strong>Typ:</strong> {{ selectedElement.semantic.type }}</div>
            <div><strong>Anchor:</strong> {{ selectedElement.semantic.anchorKey }}</div>
          </div>

          <label class="viewsvg-field">
            <span>Abweichung</span>
            <select v-model="selectedDeviation">
              <option v-for="option in deviationOptions" :key="option.kind" :value="option.kind">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="viewsvg-field">
            <span>Notiz</span>
            <textarea
              v-model="promptNote"
              rows="3"
              placeholder="z. B. etwa 1.5 mm zu tief, nur in TS sichtbar"
            ></textarea>
          </label>

          <label class="viewsvg-field">
            <span>Prompt</span>
            <textarea :value="generatedPrompt" rows="12" readonly></textarea>
          </label>

          <div class="viewsvg-prompt-actions">
            <button type="button" class="viewsvg-prompt-button" @click="copyPromptToClipboard">
              Copy
            </button>
            <button type="button" class="viewsvg-prompt-button viewsvg-prompt-button--ghost" @click="clearPromptSelection">
              Clear
            </button>
          </div>

        <p v-if="promptFeedback !== null" class="viewsvg-hint">{{ promptFeedback }}</p>
      </template>
    </template>

    <section class="viewsvg-stage">
      <div class="viewsvg-stage__shell" :class="`viewsvg-stage__shell--${selectedMode}`">
        <template v-if="selectedMode === 'side-by-side'">
          <article class="viewsvg-pane">
            <div class="viewsvg-pane__title">Legacy</div>
            <div class="viewsvg-surface-host">
              <div
                ref="legacySurfaceRef"
                class="viewsvg-pane__body viewsvg-surface-host__content"
                v-html="legacySvgMarkup"
                @click="selectSvgElement('legacy', $event)"
                @mousemove="updateHoveredElement('legacy', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'legacy'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
          </article>
          <article class="viewsvg-pane">
            <div class="viewsvg-pane__title">TS</div>
            <div class="viewsvg-surface-host">
              <div
                ref="tsSurfaceRef"
                class="viewsvg-pane__body viewsvg-surface-host__content"
                v-html="tsSvgMarkup"
                @click="selectSvgElement('ts', $event)"
                @mousemove="updateHoveredElement('ts', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'ts'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
          </article>
        </template>

        <template v-else-if="selectedMode === 'swipe'">
          <div class="viewsvg-swipe">
            <div class="viewsvg-surface-host">
              <div
                ref="legacySurfaceRef"
                class="viewsvg-swipe__layer viewsvg-swipe__layer--legacy viewsvg-surface-host__content"
                v-html="legacySvgMarkup"
                @click="selectSvgElement('legacy', $event)"
                @mousemove="updateHoveredElement('legacy', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'legacy'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
            <div class="viewsvg-surface-host">
              <div
                ref="tsSurfaceRef"
                class="viewsvg-swipe__layer viewsvg-swipe__layer--ts viewsvg-surface-host__content"
                :style="{ clipPath: `inset(0 ${100 - swipePosition}% 0 0)` }"
                v-html="tsSvgMarkup"
                @click="selectSvgElement('ts', $event)"
                @mousemove="updateHoveredElement('ts', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'ts'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
            <div class="viewsvg-swipe__handle" :style="{ left: `${swipePosition}%` }" />
          </div>
        </template>

        <template v-else>
          <div class="viewsvg-blink">
            <div class="viewsvg-surface-host">
              <div
                ref="legacySurfaceRef"
                class="viewsvg-blink__layer viewsvg-blink__layer--legacy viewsvg-surface-host__content"
                :class="{ 'is-visible': blinkVisible === 'legacy' }"
                v-html="legacySvgMarkup"
                @click="selectSvgElement('legacy', $event)"
                @mousemove="updateHoveredElement('legacy', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'legacy'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
            <div class="viewsvg-surface-host">
              <div
                ref="tsSurfaceRef"
                class="viewsvg-blink__layer viewsvg-blink__layer--ts viewsvg-surface-host__content"
                :class="{ 'is-visible': blinkVisible === 'ts' }"
                v-html="tsSvgMarkup"
                @click="selectSvgElement('ts', $event)"
                @mousemove="updateHoveredElement('ts', $event)"
                @mouseleave="clearHoveredElement"
                @scroll.passive="refreshSelectionHighlight"
              />
              <div
                v-if="selectedHighlight !== null && selectedHighlight.source === 'ts'"
                class="viewsvg-selection-overlay"
                :style="selectedHighlightStyle"
              >
                <span class="viewsvg-selection-overlay__label">{{ selectedHighlight.label }}</span>
              </div>
            </div>
          </div>
          <div class="viewsvg-blink__legend" role="note" aria-label="Blink mode guide">
            <button
              type="button"
              class="viewsvg-blink__toggle"
              :class="{ 'is-legacy': blinkVisible === 'legacy', 'is-ts': blinkVisible === 'ts' }"
              @click="toggleBlinkVisible"
            >
              {{ visibleBlinkLabel }}
            </button>
          </div>
        </template>
      </div>
    </section>
  </ComparisonLayout>
</template>

<style scoped>
.viewsvg-field {
  display: grid;
  gap: 0.45rem;
}

.viewsvg-field span {
  color: var(--viewsvg-subtext);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.viewsvg-field select {
  width: 100%;
  accent-color: var(--viewsvg-accent-strong);
}

.viewsvg-field select {
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--viewsvg-text);
}

.viewsvg-hint {
  margin: 0;
  padding: 0 0.25rem;
  font-size: 0.9rem;
  color: var(--viewsvg-accent);
}

.viewsvg-stage {
  min-width: 0;
  min-height: 0;
  padding: 1rem;
}

.viewsvg-stage__shell {
  position: relative;
  display: grid;
  min-height: calc(100vh - 2rem);
  overflow: hidden;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 28px;
  background: #ffffff;
  box-shadow: var(--viewsvg-shadow);
}

.viewsvg-stage__shell--side-by-side {
  grid-template-columns: 1fr 1fr;
}

.viewsvg-stage__shell--swipe,
.viewsvg-stage__shell--blink {
  grid-template-columns: 1fr;
}

.viewsvg-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid rgba(15, 23, 42, 0.14);
}

.viewsvg-pane:last-child {
  border-right: 0;
}

.viewsvg-pane__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.14);
  background: #ffffff;
  font-size: 0.82rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewsvg-pane__body {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 1rem;
}

.viewsvg-surface-host {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.viewsvg-surface-host__content {
  height: 100%;
}

.viewsvg-pane .viewsvg-surface-host {
  display: flex;
  flex-direction: column;
}

.viewsvg-swipe .viewsvg-surface-host,
.viewsvg-blink .viewsvg-surface-host {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.viewsvg-swipe,
.viewsvg-blink {
  position: relative;
  min-height: calc(100vh - 2rem);
  overflow: hidden;
}

.viewsvg-swipe__layer,
.viewsvg-blink__layer {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 1rem;
  pointer-events: auto;
}

.viewsvg-swipe__layer--legacy {
  pointer-events: auto;
}

.viewsvg-swipe__layer--ts {
  pointer-events: auto;
}

.viewsvg-swipe__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #000000;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.95),
    0 0 24px rgba(0, 0, 0, 0.16);
  transform: translateX(-1px);
  pointer-events: none;
}

.viewsvg-blink__layer {
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}

.viewsvg-blink__layer.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.viewsvg-blink__legend {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.65rem;
  background: rgba(255, 255, 255, 0.94);
  color: var(--viewsvg-text);
  font-size: 0.76rem;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 999px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  pointer-events: auto;
}

.viewsvg-blink__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.65rem;
  border: 1px solid rgba(15, 23, 42, 0.24);
  border-radius: 999px;
  background: #ffffff;
  color: #000000;
  font-size: 0.76rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
}

.viewsvg-blink__toggle:hover {
  border-color: rgba(15, 23, 42, 0.5);
  background: rgba(255, 255, 255, 1);
}

.viewsvg-blink__toggle.is-legacy,
.viewsvg-blink__toggle.is-ts {
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.viewsvg-selection-overlay {
  position: absolute;
  z-index: 4;
  box-sizing: border-box;
  border: 1px solid #1d4ed8;
  border-radius: 10px;
  background: rgba(29, 78, 216, 0.04);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.9),
    0 0 0 2px rgba(29, 78, 216, 0.12);
  pointer-events: none;
}

.viewsvg-selection-overlay__label {
  position: absolute;
  top: -1.5rem;
  left: 0;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.viewsvg-prompt-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.75rem;
  padding: 0.1rem 0 0.25rem;
  color: var(--viewsvg-subtext);
  font-size: 0.82rem;
}

.viewsvg-field textarea {
  width: 100%;
  min-height: 5rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--viewsvg-panel-border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--viewsvg-text);
  resize: vertical;
}

.viewsvg-prompt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.viewsvg-prompt-button {
  padding: 0.65rem 0.9rem;
  border: 1px solid rgba(15, 23, 42, 0.24);
  border-radius: 12px;
  background: #ffffff;
  color: #000000;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
}

.viewsvg-prompt-button:hover {
  border-color: rgba(15, 23, 42, 0.5);
}

.viewsvg-prompt-button--ghost {
  background: rgba(15, 23, 42, 0.04);
}

.viewsvg-prompt-button--ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

:deep(.viewsvg-surface) {
  width: 100%;
  height: auto;
  background: #ffffff;
}

:deep(.viewsvg-surface rect.abcref),
:deep(.viewsvg-surface rect.zupfnoter-hitbox) {
  fill-opacity: 0.0;
}

:deep(.viewsvg-surface .zupfnoter-hitbox) {
  cursor: crosshair;
}

:deep(.viewsvg-surface .viewsvg-hovered-element path),
:deep(.viewsvg-surface .viewsvg-hovered-element line),
:deep(.viewsvg-surface .viewsvg-hovered-element polyline),
:deep(.viewsvg-surface .viewsvg-hovered-element polygon) {
  stroke: #d97706 !important;
  filter: drop-shadow(0 0 0.25rem rgba(217, 119, 6, 0.25));
}

:deep(.viewsvg-surface .viewsvg-hovered-element rect),
:deep(.viewsvg-surface .viewsvg-hovered-element ellipse),
:deep(.viewsvg-surface .viewsvg-hovered-element circle) {
  stroke: #d97706 !important;
  fill: rgba(217, 119, 6, 0.16) !important;
  filter: drop-shadow(0 0 0.25rem rgba(217, 119, 6, 0.25));
}

:deep(.viewsvg-surface .viewsvg-hovered-element text),
:deep(.viewsvg-surface .viewsvg-hovered-element tspan) {
  fill: #d97706 !important;
  filter: drop-shadow(0 0 0.2rem rgba(217, 119, 6, 0.25));
}

</style>
