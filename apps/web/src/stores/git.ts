import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { GitCommit, GitCommitFile, GitFileStatus, GitService } from '../workbench/git/gitService'

export interface GitRefreshOptions {
  loadRepositoryHistory?: boolean
  loadBranchInfo?: boolean
}

export const useGitStore = defineStore('git', () => {
  const service = shallowRef<GitService>()
  const repository = ref(false)
  const statuses = ref<GitFileStatus[]>([])
  const selectedPaths = ref<string[]>([])
  const currentBranch = ref<string>()
  const branches = ref<string[]>([])
  const history = ref<GitCommit[]>([])
  const pieceHistory = ref<GitCommit[]>([])
  const loading = ref(false)
  const error = ref('')

  const available = computed(() => service.value !== undefined)
  const changeCount = computed(() => statuses.value.length)
  const selectedCount = computed(() => selectedPaths.value.length)

  function configure(nextService: GitService | undefined): void {
    service.value = nextService
    repository.value = false
    statuses.value = []
    selectedPaths.value = []
    currentBranch.value = undefined
    branches.value = []
    history.value = []
    pieceHistory.value = []
    error.value = ''
  }

  async function refresh(options: GitRefreshOptions = {}): Promise<void> {
    if (service.value === undefined) return
    loading.value = true
    error.value = ''
    try {
      repository.value = await service.value.isRepository()
      if (!repository.value) {
        statuses.value = []
        currentBranch.value = undefined
        branches.value = []
        history.value = []
        pieceHistory.value = []
        selectedPaths.value = []
        return
      }
      if (options.loadBranchInfo === false) {
        currentBranch.value = undefined
        branches.value = []
      } else {
        const [nextBranch, nextBranches] = await Promise.all([
          service.value.currentBranch(),
          service.value.branches(),
        ])
        currentBranch.value = nextBranch
        branches.value = nextBranches
      }
      history.value = options.loadRepositoryHistory === false
        ? []
        : await service.value.log({ depth: 30 })
      const nextStatuses = await service.value.status()
      const previous = new Set(selectedPaths.value)
      statuses.value = nextStatuses
      selectedPaths.value = selectedPaths.value.length === 0
        ? nextStatuses.map((entry) => entry.path)
        : nextStatuses.filter((entry) => previous.has(entry.path)).map((entry) => entry.path)
    } catch (cause) {
      error.value = toErrorMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function loadPieceHistory(path: string): Promise<GitCommit[]> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    if (!repository.value) {
      pieceHistory.value = []
      return []
    }
    loading.value = true
    error.value = ''
    try {
      pieceHistory.value = await service.value.historyForPath(path, { depth: 50 })
      return pieceHistory.value
    } catch (cause) {
      error.value = toErrorMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function initRepository(): Promise<void> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    loading.value = true
    error.value = ''
    try {
      await service.value.init()
      await refresh({ loadRepositoryHistory: false })
    } catch (cause) {
      error.value = toErrorMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function isSelected(path: string): boolean {
    return selectedPaths.value.includes(path)
  }

  function setSelected(path: string, selected: boolean): void {
    const next = new Set(selectedPaths.value)
    if (selected) next.add(path)
    else next.delete(path)
    selectedPaths.value = [...next]
  }

  function selectAll(): void {
    selectedPaths.value = statuses.value.map((entry) => entry.path)
  }

  function clearSelection(): void {
    selectedPaths.value = []
  }

  async function stageSelected(): Promise<void> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    if (selectedPaths.value.length === 0) throw new Error('Bitte mindestens eine Änderung auswählen')
    await service.value.stage(selectedPaths.value)
    await refresh()
  }

  async function unstageSelected(): Promise<void> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    if (selectedPaths.value.length === 0) throw new Error('Bitte mindestens eine Änderung auswählen')
    await service.value.unstage(selectedPaths.value)
    await refresh()
  }

  async function commit(message: string): Promise<string> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    if (selectedPaths.value.length === 0) throw new Error('Bitte mindestens eine Änderung auswählen')
    await service.value.stage(selectedPaths.value)
    const oid = await service.value.commit(message)
    await refresh()
    return oid
  }

  async function commitAll(message: string): Promise<string> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    if (statuses.value.length === 0) throw new Error('Es gibt keine ungespeicherten Änderungen')
    loading.value = true
    error.value = ''
    try {
      await service.value.stage(statuses.value.map((entry) => entry.path))
      const oid = await service.value.commit(message)
      await refresh({ loadRepositoryHistory: false })
      return oid
    } catch (cause) {
      error.value = toErrorMessage(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function createBranch(name: string): Promise<void> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    await service.value.createBranch(name)
    await refresh()
  }

  async function checkout(ref: string): Promise<void> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    await service.value.checkout(ref)
    await refresh()
  }

  async function readWorkspaceFile(path: string): Promise<Uint8Array> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    return service.value.readWorkspaceFile(path)
  }

  async function readFileAtRevision(revision: string, path: string): Promise<Uint8Array | undefined> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    return service.value.getFileAtRevision(revision, path)
  }

  async function filesChangedInCommit(revision: string): Promise<GitCommitFile[]> {
    if (service.value === undefined) throw new Error('Git ist nur mit einem aktiven lokalen Workspace verfügbar')
    return service.value.filesChangedInCommit(revision)
  }

  return {
    service,
    available,
    repository,
    statuses,
    selectedPaths,
    selectedCount,
    changeCount,
    currentBranch,
    branches,
    history,
    pieceHistory,
    loading,
    error,
    configure,
    refresh,
    loadPieceHistory,
    initRepository,
    isSelected,
    setSelected,
    selectAll,
    clearSelection,
    stageSelected,
    unstageSelected,
    commit,
    commitAll,
    createBranch,
    checkout,
    readWorkspaceFile,
    readFileAtRevision,
    filesChangedInCommit,
  }
})

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
