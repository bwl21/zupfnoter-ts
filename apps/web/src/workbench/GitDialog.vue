<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import { ZnButton, ZnIconButton } from '@zupfnoter/design-system'
import { useGitStore } from '../stores/git'
import type { GitCommit, GitCommitFile, GitFileState } from './git/gitService'
import {
  VERSION_COMPARE_WINDOW_NAME,
  storeVersionCompareRequest,
} from './versionComparison'

const props = defineProps<{
  open: boolean
  currentPath: string
  currentDocumentText: string
  savedDocumentText: string
  workingTimestamp: number
  savedTimestamp?: number
  currentExtract: number
}>()
const emit = defineEmits<{ close: [] }>()
const gitStore = useGitStore()
const commitMessage = ref('')
const actionError = ref('')
const referenceCandidate = ref('')
const comparisonCandidate = ref('')
const selectedCommit = ref<GitCommit>()
const selectedCommitFiles = ref<GitCommitFile[]>([])
const selectedCommitBusy = ref(false)
const gitDataLoading = ref(false)
const historyElement = ref<HTMLElement | null>(null)
const historyTooltips = new Map<HTMLElement, TippyInstance>()
const selectedCommitAbcFiles = computed(() => selectedCommitFiles.value.filter((file) => file.path.toLowerCase().endsWith('.abc')))

const STORAGE_VERSION_ID = 'workspace:saved'
const WORKING_VERSION_ID = 'workspace:working'

interface VersionCandidate {
  id: string
  label: string
  timestamp?: number
  commit?: GitCommit
}

const versionCandidates = computed<VersionCandidate[]>(() => [
  { id: WORKING_VERSION_ID, label: 'Arbeitsstand', timestamp: props.workingTimestamp },
  { id: STORAGE_VERSION_ID, label: 'Gespeichert', timestamp: props.savedTimestamp },
  ...(gitStore.repository ? gitStore.pieceHistory : []).map((commit) => ({
    id: commit.oid,
    label: commit.message,
    timestamp: commitTimestamp(commit),
    commit,
  })),
])

const workingDirty = computed(() => props.currentDocumentText !== props.savedDocumentText)

const pieceTitle = computed(() => {
  const titleLine = props.currentDocumentText.split(/\r?\n/).find((line) => line.startsWith('T:'))
  return titleLine?.slice(2).trim() || props.currentPath
})

const statusLabel = computed(() => `${gitStore.changeCount} ${gitStore.changeCount === 1 ? 'Änderung' : 'Änderungen'}`)

watch([() => props.open, () => props.currentPath], ([open]) => {
  if (open) {
    actionError.value = ''
    referenceCandidate.value = ''
    comparisonCandidate.value = ''
    selectedCommit.value = undefined
    selectedCommitFiles.value = []
    void refresh()
  }
})

async function refresh(): Promise<void> {
  if (!gitStore.available) {
    gitDataLoading.value = false
    return
  }
  gitDataLoading.value = true
  try {
    await gitStore.refresh({ loadRepositoryHistory: false, loadBranchInfo: false })
    await gitStore.loadPieceHistory(props.currentPath)
    const firstCommit = gitStore.pieceHistory[0]
    if (firstCommit !== undefined) void selectCommit(firstCommit)
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    gitDataLoading.value = false
  }
}

async function selectCommit(commit: GitCommit): Promise<void> {
  selectedCommit.value = commit
  selectedCommitBusy.value = true
  try {
    selectedCommitFiles.value = await gitStore.filesChangedInCommit(commit.oid)
  } catch (error) {
    actionError.value = errorMessage(error)
    selectedCommitFiles.value = []
  } finally {
    selectedCommitBusy.value = false
  }
}

async function selectCandidate(candidate: VersionCandidate): Promise<void> {
  if (candidate.commit !== undefined) {
    await selectCommit(candidate.commit)
    return
  }
  selectedCommit.value = undefined
  selectedCommitFiles.value = []
  selectedCommitBusy.value = false
}

async function initRepository(): Promise<void> {
  try {
    await gitStore.initRepository()
    await refresh()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function commit(): Promise<void> {
  try {
    const oid = await gitStore.commitAll(commitMessage.value)
    commitMessage.value = ''
    await gitStore.loadPieceHistory(props.currentPath)
    const committed = gitStore.pieceHistory.find((entry) => entry.oid === oid)
    if (committed !== undefined) await selectCommit(committed)
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function openComparisonTab(): Promise<void> {
  if (referenceCandidate.value === '' || comparisonCandidate.value === '') {
    actionError.value = 'Bitte eine Referenz- und eine Vergleichsversion auswählen.'
    return
  }

  const compareWindow = window.open('about:blank', VERSION_COMPARE_WINDOW_NAME)
  if (compareWindow === null) {
    actionError.value = 'Der Vergleichs-Tab konnte nicht geöffnet werden. Bitte erlaube Pop-ups für Zupfnoter.'
    return
  }

  actionError.value = ''
  try {
    const decoder = new TextDecoder()
    const referenceText = await readCandidateText(referenceCandidate.value, props.currentPath, decoder)
    const comparisonText = await readCandidateText(comparisonCandidate.value, props.currentPath, decoder)
    const reference = versionCandidates.value.find((entry) => entry.id === referenceCandidate.value)
    const comparison = versionCandidates.value.find((entry) => entry.id === comparisonCandidate.value)
    storeVersionCompareRequest({
      path: props.currentPath,
      extract: props.currentExtract,
      referenceLabel: reference?.label ?? 'Referenz',
      comparisonLabel: comparison?.label ?? 'Vergleich',
      referenceText,
      comparisonText,
    })
    compareWindow.location.href = new URL(`${import.meta.env.BASE_URL}compare`, window.location.origin).toString()
    compareWindow.focus()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function readCandidateText(candidateId: string, path: string, decoder: TextDecoder): Promise<string> {
  if (candidateId === STORAGE_VERSION_ID) return props.savedDocumentText
  if (candidateId === WORKING_VERSION_ID) return props.currentDocumentText
  const bytes = await gitStore.readFileAtRevision(candidateId, path)
  if (bytes === undefined) throw new Error(`Die Datei „${path}“ ist in der ausgewählten Version nicht vorhanden.`)
  return decoder.decode(bytes)
}

function toggleReference(candidate: VersionCandidate, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  referenceCandidate.value = target.checked ? candidate.id : ''
  actionError.value = ''
}

function toggleComparison(candidate: VersionCandidate, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  comparisonCandidate.value = target.checked ? candidate.id : ''
  actionError.value = ''
}

function stateLabel(state: GitFileState): string {
  return state === 'untracked' ? 'Unbekannt' : state === 'added' ? 'Neu' : state === 'deleted' ? 'Gelöscht' : state === 'conflicted' ? 'Konflikt' : 'Geändert'
}

function stateLetter(state: GitFileState): string {
  return state === 'untracked' ? '?' : state === 'added' ? 'A' : state === 'deleted' ? 'D' : state === 'conflicted' ? '!' : 'M'
}

function commitDate(timestamp: number | undefined): string {
  if (timestamp === undefined) return ''
  const date = new Date(timestamp * 1000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function versionDate(timestamp: number | undefined): string {
  if (timestamp === undefined) return ''
  const date = new Date(timestamp * 1000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function versionDatetime(timestamp: number | undefined): string | undefined {
  return timestamp === undefined ? undefined : new Date(timestamp * 1000).toISOString()
}

function commitDateFull(timestamp: number | undefined): string {
  return timestamp === undefined
    ? ''
    : new Date(timestamp * 1000).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
}

function commitDay(timestamp: number | undefined): string {
  if (timestamp === undefined) return ''
  const date = new Date(timestamp * 1000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.`
}

function commitTimestamp(entry: GitCommit): number | undefined {
  return entry.author?.timestamp ?? entry.committer?.timestamp
}

function commitDatetime(entry: GitCommit): string | undefined {
  const timestamp = commitTimestamp(entry)
  return timestamp === undefined ? undefined : new Date(timestamp * 1000).toISOString()
}

function commitTooltip(entry: GitCommit): string {
  const author = entry.author === undefined ? undefined : `${entry.author.name} (${entry.author.email})`
  const timestamp = commitTimestamp(entry)
  return [`Commit: ${entry.oid}`, author === undefined ? undefined : `Autor: ${author}`, timestamp === undefined ? undefined : `Zeit: ${commitDateFull(timestamp)}`]
    .filter((line): line is string => line !== undefined)
    .join('\n')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !props.open) return
  event.preventDefault()
  emit('close')
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}

function syncHistoryTooltips(): void {
  const root = historyElement.value
  if (root === null) {
    destroyHistoryTooltips()
    return
  }
  for (const element of root.querySelectorAll<HTMLElement>('.git-dialog__history-entry')) {
    if (!element.hasAttribute('data-commit-tooltip')) tooltipInstanceOn(element)?.destroy()
  }
  const elements = root.querySelectorAll<HTMLElement>('[data-commit-tooltip]')
  for (const element of elements) {
    const content = element.dataset.commitTooltip
    if (content === undefined) continue
    const existing = historyTooltips.get(element)
    if (existing !== undefined) {
      existing.setContent(content)
      continue
    }
    tooltipInstanceOn(element)?.destroy()
    historyTooltips.set(element, tippy(element, {
      content,
      animation: 'shift-away',
      delay: [180, 0],
      duration: [90, 60],
      placement: 'top-start',
    }))
  }
  for (const [element, instance] of historyTooltips) {
    if (root.contains(element)) continue
    instance.destroy()
    historyTooltips.delete(element)
  }

}

function destroyHistoryTooltips(): void {
  for (const instance of historyTooltips.values()) instance.destroy()
  historyTooltips.clear()
}

function tooltipInstanceOn(element: HTMLElement): TippyInstance | undefined {
  return (element as HTMLElement & { _tippy?: TippyInstance })._tippy
}

onUpdated(syncHistoryTooltips)
onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
onBeforeUnmount(destroyHistoryTooltips)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="git-dialog__backdrop">
      <section class="git-dialog" role="dialog" aria-modal="true" aria-labelledby="git-dialog-title">
        <header class="git-dialog__header">
          <div>
            <p class="git-dialog__eyebrow">Speicher · {{ currentPath }}</p>
            <h2 id="git-dialog-title">Versionen</h2>
          </div>
          <div class="git-dialog__header-actions">
            <ZnButton v-if="gitStore.repository" variant="ghost" :disabled="gitStore.loading" @click="refresh">Aktualisieren</ZnButton>
            <ZnIconButton label="Versionsdialog schließen" variant="ghost" @click="emit('close')">×</ZnIconButton>
          </div>
        </header>

        <div class="git-dialog__tab-panel">
          <div class="git-dialog__toolbar">
            <span class="git-dialog__summary">{{ gitStore.available ? `${statusLabel} im Workspace` : 'Arbeitsstand im Speicher' }}</span>
            <span class="git-dialog__toolbar-actions">
              <span class="git-dialog__hint">Die aktuelle Stückspeicherung bleibt davon getrennt.</span>
              <ZnButton variant="ghost" :disabled="referenceCandidate === '' || comparisonCandidate === ''" @click="openComparisonTab">Vergleichen</ZnButton>
            </span>
          </div>

          <div class="git-dialog__piece-grid">
            <section ref="historyElement" class="git-dialog__piece-history" aria-labelledby="git-history-title">
              <div class="git-dialog__section-heading">
                <h3 id="git-history-title">Versionen dieses Stückes: <span class="git-dialog__piece-title">{{ pieceTitle }}</span></h3>
                <span class="git-dialog__history-heading-status">
                  <span v-if="gitDataLoading || gitStore.loading" class="git-dialog__loading" role="status" aria-live="polite"><span class="git-dialog__spinner" aria-hidden="true"></span><span class="git-dialog__loading-label">Laden</span></span>
                  <span>{{ versionCandidates.length }}</span>
                </span>
              </div>
              <div class="git-dialog__history-selector-labels" aria-hidden="true"><span title="Referenz">R</span><span title="Vergleich">V</span></div>
              <ol v-if="versionCandidates.length > 0" class="git-dialog__history">
                <li v-for="(candidate, index) in versionCandidates" :key="candidate.id" :data-selected="candidate.commit !== undefined && selectedCommit?.oid === candidate.commit.oid" :data-workspace-version="candidate.commit === undefined" :data-git-version-start="candidate.commit !== undefined && index === 2">
                  <div class="git-dialog__history-entry">
                    <button type="button" class="git-dialog__history-main" @click="selectCandidate(candidate)">
                        <time v-if="candidate.timestamp !== undefined" :datetime="versionDatetime(candidate.timestamp)">{{ versionDate(candidate.timestamp) }}</time>
                        <span v-else class="git-dialog__history-kind" aria-label="Zeitpunkt nicht verfügbar"></span>
                        <span class="git-dialog__history-message" :data-commit-tooltip="candidate.commit === undefined ? undefined : commitTooltip(candidate.commit)">
                          <span class="git-dialog__history-message-text">{{ candidate.label }}</span>
                          <span v-if="candidate.id === WORKING_VERSION_ID && workingDirty" class="git-dialog__history-dirty" title="Ungespeichert" aria-label="Ungespeichert">●</span>
                        <span v-if="candidate.commit !== undefined && candidate.commit.tags.length > 0" class="git-dialog__history-tags" aria-label="Tags">
                          <span v-for="tag in candidate.commit.tags" :key="tag" class="git-dialog__history-tag">{{ tag }}</span>
                        </span>
                      </span>
                    </button>
                    <label class="git-dialog__history-check"><input type="checkbox" :checked="referenceCandidate === candidate.id" :aria-label="`Referenzversion: ${candidate.label}`" @change="toggleReference(candidate, $event)"></label>
                    <label class="git-dialog__history-check"><input type="checkbox" :checked="comparisonCandidate === candidate.id" :aria-label="`Vergleichsversion: ${candidate.label}`" @change="toggleComparison(candidate, $event)"></label>
                  </div>
                </li>
              </ol>
              <p v-else class="git-dialog__empty">Für dieses Stück gibt es noch keinen Versionsstand.</p>
            </section>

            <section class="git-dialog__commit-files" aria-labelledby="git-files-title">
              <div class="git-dialog__section-heading">
                <h3 id="git-files-title">Geänderte Dateien im Versionsstand<span v-if="selectedCommit"> am {{ commitDay(commitTimestamp(selectedCommit)) }}</span></h3>
                <span v-if="selectedCommit">{{ selectedCommit.shortOid }}</span>
              </div>
              <div v-if="!gitStore.available" class="git-dialog__intro git-dialog__intro--compact">
                <p>Für diesen Speicher sind keine Git-Versionen verfügbar. Arbeitsstand und gespeicherte Version können trotzdem verglichen werden.</p>
              </div>
              <div v-else-if="!gitStore.repository" class="git-dialog__intro git-dialog__intro--compact">
                <p>Für historische Versionen muss Git im lokalen Workspace aktiviert werden.</p>
                <ZnButton variant="primary" :disabled="gitStore.loading" @click="initRepository">Git aktivieren</ZnButton>
              </div>
              <p v-else-if="selectedCommit === undefined" class="git-dialog__empty">Wähle links einen Versionsstand.</p>
              <p v-else-if="selectedCommitBusy" class="git-dialog__empty">Dateien werden gelesen …</p>
              <ul v-else-if="selectedCommitAbcFiles.length > 0">
                <li v-for="file in selectedCommitAbcFiles" :key="file.path">
                  <span><span :data-state="file.state">{{ stateLetter(file.state) }}</span><span :title="file.path">{{ fileName(file.path) }}</span></span>
                </li>
              </ul>
              <p v-else class="git-dialog__empty">Keine geänderte ABC-Datei in diesem Versionsstand.</p>
            </section>
          </div>

          <section class="git-dialog__workspace-changes" aria-labelledby="git-changes-title">
            <div class="git-dialog__section-heading">
              <h3 id="git-changes-title">Aktuelle Arbeitsänderungen</h3>
              <span>{{ statusLabel }}</span>
            </div>
            <p v-if="!gitStore.available" class="git-dialog__empty">Änderungen sind für diesen Speicher nicht über Git verfügbar.</p>
            <p v-else-if="!gitStore.repository" class="git-dialog__empty">Noch kein Git-Versionsstand im lokalen Workspace.</p>
            <p v-else-if="gitStore.loading" class="git-dialog__empty">Änderungen im Workspace werden geprüft …</p>
            <p v-else-if="gitStore.statuses.length === 0" class="git-dialog__empty">Keine ungespeicherten Änderungen.</p>
            <div v-else class="git-dialog__change-list">
              <div v-for="status in gitStore.statuses" :key="status.path" class="git-dialog__change">
                <span class="git-dialog__state" :data-state="status.state" :title="stateLabel(status.state)">{{ stateLetter(status.state) }}</span>
                <span class="git-dialog__path">{{ status.path }}</span>
              </div>
            </div>
          </section>

          <section class="git-dialog__commit-panel" aria-labelledby="git-commit-title">
            <div v-if="gitStore.available && gitStore.repository">
              <h3 id="git-commit-title">Versionsstand festschreiben</h3>
              <p>Alle aktuellen Arbeitsänderungen werden gemeinsam als ein Versionsstand festgeschrieben.</p>
            </div>
            <div v-else class="git-dialog__intro git-dialog__intro--compact">
              <h3 id="git-commit-title">Versionsstand festschreiben</h3>
              <p>Das gemeinsame Festschreiben ist nur für einen lokalen Git-Workspace verfügbar.</p>
            </div>
            <label v-if="gitStore.available && gitStore.repository">Nachricht <textarea v-model="commitMessage" rows="2" placeholder="Was wurde geändert?" /></label>
            <div v-if="gitStore.available && gitStore.repository" class="git-dialog__commit-actions">
              <span>{{ gitStore.changeCount }} {{ gitStore.changeCount === 1 ? 'Datei' : 'Dateien' }} werden festgeschrieben</span>
              <ZnButton variant="primary" :disabled="gitStore.changeCount === 0 || commitMessage.trim() === '' || gitStore.loading" @click="commit">Versionsstand festschreiben</ZnButton>
            </div>
          </section>
        </div>

        <p v-if="actionError || gitStore.error" class="git-dialog__error" role="alert">{{ actionError || gitStore.error }}</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.git-dialog__backdrop{position:fixed;inset:0;z-index:1020;display:grid;place-items:center;padding:.75rem;background:rgb(15 23 42 / .45)}.git-dialog{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;width:min(74rem,calc(100vw - 1.5rem));max-height:min(52rem,calc(100vh - 1.5rem));overflow:auto;border:1px solid var(--zn-border-strong);border-radius:.85rem;background:var(--zn-bg-elevated);color:var(--zn-text)}.git-dialog__header{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;border-bottom:1px solid var(--zn-border)}.git-dialog__eyebrow{margin:0;color:var(--zn-text-soft);font-size:.78rem}.git-dialog h2{margin:.15rem 0 0;font-size:1.3rem}.git-dialog h3{margin:0 0 .55rem;font-size:1rem}.git-dialog__header-actions,.git-dialog__toolbar-actions{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}.git-dialog__toolbar{display:flex;justify-content:space-between;gap:.75rem;align-items:center;padding:.6rem 1rem;border-bottom:1px solid var(--zn-border)}.git-dialog__summary{font-weight:600}.git-dialog__intro,.git-dialog__empty{padding:1.2rem;color:var(--zn-text-soft)}.git-dialog__intro h3{color:var(--zn-text);margin-bottom:.35rem}.git-dialog__intro p{max-width:42rem}.git-dialog__content{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(18rem,.8fr);min-height:14rem}.git-dialog__changes,.git-dialog__commit,.git-dialog__lower>section{padding:.8rem 1rem}.git-dialog__changes{border-right:1px solid var(--zn-border)}.git-dialog__change{display:grid;grid-template-columns:auto 1.6rem minmax(0,1fr) auto;gap:.45rem;align-items:center;padding:.32rem .2rem;border-bottom:1px solid var(--zn-border)}.git-dialog__state{font:600 .78rem ui-monospace,monospace}.git-dialog__state[data-state=added]{color:#16803c}.git-dialog__state[data-state=deleted]{color:#b42318}.git-dialog__state[data-state=untracked]{color:#9a6700}.git-dialog__state[data-state=conflicted]{color:#b42318}.git-dialog__path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__change small,.git-dialog__history small{color:var(--zn-text-soft);font-size:.72rem}.git-dialog__commit{display:grid;align-content:start;gap:.55rem}.git-dialog__commit label,.git-dialog__branch-select{display:grid;gap:.3rem;font-size:.84rem}.git-dialog textarea,.git-dialog input,.git-dialog select{width:100%;box-sizing:border-box;padding:.42rem .5rem;border:1px solid var(--zn-border);border-radius:var(--zn-radius-sm);background:var(--zn-bg);color:inherit;font:inherit}.git-dialog__lower{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(18rem,.8fr);border-top:1px solid var(--zn-border)}.git-dialog__lower>section+section{border-left:1px solid var(--zn-border)}.git-dialog__history{display:grid;gap:.35rem;margin:0;padding:0;list-style:none}.git-dialog__history li{display:grid;grid-template-columns:4rem minmax(0,1fr);gap:.45rem;align-items:baseline}.git-dialog__history li small{grid-column:2}.git-dialog__history code{color:var(--zn-accent-strong)}.git-dialog__branch-create{display:flex;gap:.35rem;margin-top:.7rem}.git-dialog__error{margin:0;padding:.65rem 1rem;color:var(--zn-danger);border-top:1px solid color-mix(in srgb,var(--zn-danger) 35%,transparent)}@media(max-width:48rem){.git-dialog__toolbar,.git-dialog__content,.git-dialog__lower{grid-template-columns:1fr;display:grid}.git-dialog__toolbar{justify-content:stretch}.git-dialog__changes,.git-dialog__lower>section+section{border-right:0;border-left:0;border-top:1px solid var(--zn-border)}}
.git-dialog__compare{padding:1rem;border-top:1px solid var(--zn-border)}.git-dialog__compare-header,.git-dialog__compare-form{display:flex;align-items:end;justify-content:space-between;gap:.7rem}.git-dialog__compare-header p{margin:.2rem 0 0;color:var(--zn-text-soft);font-size:.82rem}.git-dialog__compare-form{justify-content:stretch;margin-top:.7rem}.git-dialog__compare-form label{display:grid;flex:1;gap:.3rem;font-size:.84rem}.git-dialog__compare-target{align-self:center;color:var(--zn-text-soft);font-size:.8rem}.git-dialog__compare-result{margin-top:.8rem}.git-dialog__render-columns{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.git-dialog__render-columns section{min-width:0;overflow:hidden;border:1px solid var(--zn-border);border-radius:var(--zn-radius-sm)}.git-dialog__render-columns h4{padding:0 .55rem}.git-dialog__svg :deep(svg){display:block;width:100%;height:auto}.git-dialog__svg{max-height:18rem;overflow:auto;padding:.45rem;background:var(--zn-bg)}.git-dialog__overlay{position:relative;overflow:hidden;border:1px solid var(--zn-border);background:var(--zn-bg)}.git-dialog__overlay-layer{position:absolute;inset:0}.git-dialog__overlay-layer--top{opacity:.5}.git-dialog__overlay :deep(svg){display:block;width:100%;height:100%}.git-dialog__difference{display:grid;place-items:center;gap:.4rem;min-height:12rem;border:1px solid var(--zn-border);background:var(--zn-bg)}.git-dialog__difference img{display:block;max-width:100%;height:auto}.git-dialog__difference p{margin:.3rem;color:var(--zn-text-soft);font-size:.8rem}.git-dialog__source-diff{margin-top:.7rem}.git-dialog__source-diff pre{max-height:16rem;overflow:auto;margin:.5rem 0 0;padding:.65rem;background:var(--zn-bg);font:.76rem/1.45 ui-monospace,monospace;white-space:pre-wrap}.git-dialog__source-diff [data-added=true]{display:block;color:#16803c;background:color-mix(in srgb,#16803c 12%,transparent)}.git-dialog__source-diff [data-removed=true]{display:block;color:#b42318;background:color-mix(in srgb,#b42318 12%,transparent)}@media(max-width:48rem){.git-dialog__compare-header{display:grid;align-items:start}.git-dialog__compare-form{display:grid;grid-template-columns:1fr}.git-dialog__render-columns{grid-template-columns:1fr}}
.git-dialog{display:flex;flex-direction:column}.git-dialog__content,.git-dialog__lower,.git-dialog__compare{flex:0 0 auto}.git-dialog__changes{max-height:28rem;overflow:auto}
.git-dialog__history-entry{display:grid;grid-template-columns:4rem minmax(0,1fr);width:100%;gap:.45rem;padding:.3rem .35rem;border:0;border-radius:var(--zn-radius-sm);background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.git-dialog__history-entry:hover,.git-dialog__history li[data-selected=true] .git-dialog__history-entry{background:var(--zn-bg-soft)}.git-dialog__history-entry small{grid-column:2}.git-dialog__commit-files{margin-top:1rem;padding-top:.7rem;border-top:1px solid var(--zn-border)}.git-dialog__commit-files h4{margin:0 0 .4rem;font-size:.85rem}.git-dialog__commit-files ul{max-height:12rem;overflow:auto;margin:0;padding:0;list-style:none;font:.78rem/1.45 ui-monospace,monospace}.git-dialog__commit-files li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__commit-files li span{display:inline-block;width:1.2rem;font-weight:700}.git-dialog__commit-files li span[data-state=added]{color:#16803c}.git-dialog__commit-files li span[data-state=deleted]{color:#b42318}.git-dialog__commit-files li span[data-state=modified]{color:#9a6700}
.git-dialog__history li{display:block}
.git-dialog{display:flex;flex-direction:column;overflow:hidden}.git-dialog__header{flex:0 0 auto}.git-dialog__toolbar{flex:0 0 auto;align-items:center}.git-dialog__hint{color:var(--zn-text-soft);font-size:.8rem}.git-dialog__piece-grid{display:grid;grid-template-columns:minmax(22rem,.9fr) minmax(28rem,1.1fr);border-bottom:1px solid var(--zn-border);min-height:0}.git-dialog__piece-history,.git-dialog__commit-files{min-width:0;max-height:19rem;overflow:auto;padding:.8rem 1rem}.git-dialog__commit-files{margin:0;border-top:0;border-left:1px solid var(--zn-border)}.git-dialog__section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem;margin-bottom:.45rem}.git-dialog__section-heading h3{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__section-heading>span{flex:0 0 auto;color:var(--zn-text-soft);font-size:.78rem}.git-dialog__piece-history .git-dialog__history{gap:.15rem}.git-dialog__history-entry{grid-template-columns:4.5rem minmax(0,1fr);padding:.35rem .4rem}.git-dialog__history-entry span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__history-entry small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__commit-files ul{max-height:none}.git-dialog__commit-files li{display:block}.git-dialog__commit-files li>button,.git-dialog__commit-files li>span{display:grid;grid-template-columns:1.4rem minmax(0,1fr);gap:.25rem;width:100%;box-sizing:border-box;align-items:baseline;padding:.26rem .35rem;border:0;background:transparent;color:inherit;text-align:left;font:inherit}.git-dialog__commit-files li>button{cursor:pointer}.git-dialog__commit-files li>button:hover{background:var(--zn-bg-soft)}.git-dialog__commit-files li>button span:last-child,.git-dialog__commit-files li>span span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__commit-files [data-state=added]{color:#16803c}.git-dialog__commit-files [data-state=deleted]{color:#b42318}.git-dialog__commit-files [data-state=modified]{color:#9a6700}.git-dialog__workspace-changes{padding:.7rem 1rem;border-bottom:1px solid var(--zn-border)}.git-dialog__change-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:.1rem .8rem;max-height:7rem;overflow:auto}.git-dialog__change{display:grid;grid-template-columns:1.4rem minmax(0,1fr);gap:.35rem;align-items:center;padding:.22rem 0;font-size:.82rem}.git-dialog__commit-panel{display:grid;grid-template-columns:minmax(15rem,.8fr) minmax(17rem,1.2fr);gap:.7rem 1rem;align-items:end;padding:.8rem 1rem;border-bottom:1px solid var(--zn-border)}.git-dialog__commit-panel p{margin:.2rem 0 0;color:var(--zn-text-soft);font-size:.8rem}.git-dialog__commit-panel label{display:grid;gap:.3rem;font-size:.84rem}.git-dialog__commit-actions{display:flex;grid-column:2;align-items:center;justify-content:space-between;gap:.7rem;color:var(--zn-text-soft);font-size:.8rem}.git-dialog__compare{flex:0 0 auto;max-height:30rem;overflow:auto}.git-dialog__error{flex:0 0 auto}@media(max-width:48rem){.git-dialog{max-height:calc(100vh - 1rem)}.git-dialog__piece-grid,.git-dialog__commit-panel{grid-template-columns:1fr}.git-dialog__commit-files{border-top:1px solid var(--zn-border);border-left:0}.git-dialog__commit-actions{grid-column:1;align-items:stretch;flex-direction:column}.git-dialog__hint{display:none}.git-dialog__change-list{grid-template-columns:1fr}.git-dialog__compare{max-height:none}}
.git-dialog__piece-history .git-dialog__history-entry{grid-template-columns:auto minmax(0,1fr);align-items:baseline;min-height:1.7rem;padding:.18rem .3rem;font-size:.82rem;line-height:1.2}.git-dialog__piece-history .git-dialog__history-entry time{color:var(--zn-text-soft);font-size:.68rem;white-space:nowrap}.git-dialog__piece-history .git-dialog__history-message{display:flex;min-width:0;align-items:baseline;gap:.35rem;overflow:visible;text-overflow:clip;white-space:normal}.git-dialog__piece-history .git-dialog__history-message-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.git-dialog__piece-history .git-dialog__history-tags{display:flex;flex:0 0 auto;gap:.2rem;overflow:visible;text-overflow:clip;white-space:normal}.git-dialog__piece-history .git-dialog__history-tag{padding:.05rem .25rem;border:1px solid var(--zn-border);border-radius:999px;color:var(--zn-accent-strong);font-size:.68rem;line-height:1.2;white-space:nowrap}.git-dialog__piece-history .git-dialog__section-heading{margin-bottom:.3rem}.git-dialog__piece-history .git-dialog__section-heading h3{font-size:.92rem}
.git-dialog__history-selector-labels{display:grid;grid-template-columns:minmax(0,1fr) 2rem 2rem;align-items:center;margin:0 .3rem .15rem;color:var(--zn-text-soft);font-size:.68rem;line-height:1.1;text-align:center}.git-dialog__history-selector-labels span:first-child{grid-column:2}.git-dialog__history-selector-labels span:last-child{grid-column:3}.git-dialog__piece-history .git-dialog__history-entry{grid-template-columns:minmax(0,1fr) 2rem 2rem;gap:.15rem;width:100%;box-sizing:border-box;min-height:1.7rem;padding:.08rem .3rem;background:transparent}.git-dialog__piece-history .git-dialog__history-entry:hover,.git-dialog__piece-history .git-dialog__history li[data-selected=true] .git-dialog__history-entry{background:var(--zn-bg-soft)}.git-dialog__history-main{display:grid;grid-template-columns:auto minmax(0,1fr);min-width:0;align-items:baseline;gap:.45rem;padding:.1rem 0;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.git-dialog__history-check{display:grid;place-items:center;min-width:0}.git-dialog__history-check input{width:1rem;height:1rem;margin:0;accent-color:var(--zn-accent-strong);cursor:pointer}.git-dialog__compare-candidate{display:grid;flex:1;min-width:0;gap:.3rem;font-size:.84rem}.git-dialog__compare-candidate span{color:var(--zn-text-soft);font-size:.76rem}.git-dialog__compare-candidate strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.git-dialog__piece-history .git-dialog__history-entry time{font-size:.68rem}
.git-dialog__piece-title{font-weight:400;color:var(--zn-text-soft)}
.git-dialog__history-dirty{flex:0 0 auto;color:var(--zn-warning,#a66a00);font-size:.8rem;line-height:1}
.git-dialog__history-main{grid-template-columns:5.5rem minmax(0,1fr)}
.git-dialog__piece-history .git-dialog__history li[data-workspace-version=true] .git-dialog__history-entry{background:color-mix(in srgb,var(--zn-accent-soft,#dbeafe) 32%,var(--zn-bg-elevated))}
.git-dialog__piece-history .git-dialog__history li[data-git-version-start=true]{margin-top:.45rem;padding-top:.4rem;border-top:1px solid var(--zn-border)}
.git-dialog__loading{display:inline-flex;align-items:center;gap:.35rem;color:var(--zn-text-soft);font-size:.78rem;white-space:nowrap}
.git-dialog__history-heading-status{display:inline-flex;align-items:center;gap:.55rem}
.git-dialog__loading-label{font-size:.72rem}
.git-dialog__spinner{display:inline-block;width:.8rem;height:.8rem;border:.12rem solid currentColor;border-right-color:transparent;border-radius:50%;animation:git-dialog-spin .7s linear infinite}
@keyframes git-dialog-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.git-dialog__spinner{animation-duration:1.5s}}
.git-dialog__tabs{display:flex;gap:.15rem;padding:0 1rem;border-bottom:1px solid var(--zn-border);background:var(--zn-bg-soft)}
.git-dialog__tabs button{padding:.55rem .8rem;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--zn-text-soft);font:inherit;cursor:pointer}
.git-dialog__tabs button[aria-selected=true]{border-bottom-color:var(--zn-accent-strong);color:var(--zn-text);font-weight:600}
.git-dialog__tabs button:focus-visible{outline:2px solid var(--zn-accent-strong);outline-offset:-2px}
.git-dialog__tab-panel{min-height:0}
.git-dialog__tab-panel--compare{display:flex;min-height:0;overflow:auto}
.git-dialog__tab-panel--compare .git-dialog__compare{width:100%;max-height:none;border-top:0}
.git-dialog__intro--compact{padding:.4rem 0;color:var(--zn-text-soft)}
.git-dialog__intro--compact p{margin:.2rem 0 .6rem}
.git-dialog__commit-panel>.git-dialog__intro--compact{padding:0}
</style>
