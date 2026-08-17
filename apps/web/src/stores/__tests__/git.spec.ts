import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { useGitStore } from '../git'
import { createFakeWorkspaceDirectory } from '../../workbench/storage/__tests__/fakeWorkspaceDirectory'
import { createWorkspaceFileSystem } from '../../workbench/storage/workspaceFileSystem'
import { createGitService } from '../../workbench/git/gitService'

describe('GitStore', () => {
  it('schreibt alle aktuellen Arbeitsänderungen gemeinsam fest', async () => {
    setActivePinia(createPinia())
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace)
    await service.init()
    await workspace.writeFile('songs/one.abc', 'A:1\nK:C\nCDEF|')
    await workspace.writeFile('songs/two.abc', 'A:2\nK:G\nGABc|')
    await service.stage(['songs/one.abc', 'songs/two.abc'])
    await service.commit('Ausgangsstand')
    await workspace.writeFile('songs/one.abc', 'A:1\nK:C\nCDEF G|')
    await workspace.writeFile('songs/two.abc', 'A:2\nK:G\nGABc d|')

    const store = useGitStore()
    store.configure(service)
    await store.refresh({ loadRepositoryHistory: false })
    const oid = await store.commitAll('Zwei Stücke aktualisiert')

    expect(store.statuses).toEqual([])
    expect((await service.log()).filter((entry) => entry.oid === oid)).toHaveLength(1)
    expect(await service.filesChangedInCommit(oid)).toEqual([
      { path: 'songs/one.abc', state: 'modified' },
      { path: 'songs/two.abc', state: 'modified' },
    ])
  })
})
