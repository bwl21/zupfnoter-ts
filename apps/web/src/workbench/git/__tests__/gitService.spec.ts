import { describe, expect, it } from 'vitest'
import git from 'isomorphic-git'
import { createGitService } from '../gitService'
import { createIsomorphicGitFs } from '../isomorphicGitFs'
import { createWorkspaceFileSystem } from '../../storage/workspaceFileSystem'
import { createFakeWorkspaceDirectory } from '../../storage/__tests__/fakeWorkspaceDirectory'

describe('GitService', () => {
  it('supports multiple workspace edits before one commit', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace, { author: { name: 'Test User', email: 'test@example.invalid' } })

    expect(await service.isRepository()).toBe(false)
    await service.init()
    expect(await service.isRepository()).toBe(true)

    await workspace.writeFile('songs/one.abc', 'A:1\nK:C\nCDEF|')
    expect(await service.status()).toEqual([{ path: 'songs/one.abc', state: 'untracked', staged: false, unstaged: true }])

    await service.stage(['songs/one.abc'])
    expect(await service.status()).toEqual([{ path: 'songs/one.abc', state: 'added', staged: true, unstaged: false }])
    const firstOid = await service.commit('Ausgangsstand')
    const gitFs = createIsomorphicGitFs(workspace)
    await git.tag({ fs: gitFs, dir: '/', gitdir: '/.git', ref: 'baseline' })
    await git.annotatedTag({
      fs: gitFs,
      dir: '/',
      gitdir: '/.git',
      ref: 'release',
      object: firstOid,
      message: 'Release',
      tagger: { name: 'Test User', email: 'test@example.invalid' },
    })
    expect((await service.status())).toEqual([])

    await workspace.writeFile('songs/one.abc', 'A:1\nK:C\nCDEF G|')
    await workspace.writeFile('songs/two.abc', 'A:2\nK:G\nGABc|')
    const changed = await service.status()
    expect(changed.map((entry) => [entry.path, entry.state])).toEqual([
      ['songs/one.abc', 'modified'],
      ['songs/two.abc', 'untracked'],
    ])

    await service.stage(changed.map((entry) => entry.path))
    const secondOid = await service.commit('Zwei Stücke aktualisiert')
    expect(secondOid).not.toBe(firstOid)
    expect((await service.status())).toEqual([])
    expect(await service.filesChangedInCommit(secondOid)).toEqual([
      { path: 'songs/one.abc', state: 'modified' },
      { path: 'songs/two.abc', state: 'added' },
    ])

    const history = await service.log()
    expect(history.slice(0, 2).map((entry) => entry.message)).toEqual(['Zwei Stücke aktualisiert', 'Ausgangsstand'])
    expect((await service.historyForPath('songs/one.abc')).map((entry) => entry.message)).toEqual([
      'Zwei Stücke aktualisiert',
      'Ausgangsstand',
    ])
    expect((await service.historyForPath('songs/one.abc')).find((entry) => entry.oid === firstOid)?.tags).toEqual(['baseline', 'release'])
    expect((await service.historyForPath('songs/two.abc')).map((entry) => entry.message)).toEqual(['Zwei Stücke aktualisiert'])
    expect(await service.historyForPath('songs/not-present.abc')).toEqual([])
    const oldFile = await service.getFileAtRevision(firstOid, 'songs/one.abc')
    expect(new TextDecoder().decode(oldFile)).toBe('A:1\nK:C\nCDEF|')
  })

  it('can create and switch branches after committing', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace)
    await service.init()
    await workspace.writeFile('song.abc', 'A:1')
    await service.stage(['song.abc'])
    await service.commit('Initial')

    expect(await service.currentBranch()).toBe('main')
    await service.createBranch('experiment')
    expect(await service.branches()).toContain('experiment')
    await service.checkout('experiment')
    expect(await service.currentBranch()).toBe('experiment')
  })

  it('does not initialize over an existing repository', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace)
    await service.init()
    await workspace.writeFile('keep.txt', 'keep')
    await service.stage(['keep.txt'])
    await service.commit('Existing repository')

    await expect(service.init()).rejects.toThrow('nicht überschrieben')
    expect(await service.isRepository()).toBe(true)
    expect(new TextDecoder().decode(await service.getFileAtRevision('HEAD', 'keep.txt'))).toBe('keep')
  })

  it('allows committing only the selected subset of changes', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace)
    await service.init()
    await workspace.writeFile('a.txt', 'a')
    await workspace.writeFile('b.txt', 'b')
    await service.stage(['a.txt', 'b.txt'])
    await service.commit('Initial')

    await workspace.writeFile('a.txt', 'changed')
    await workspace.writeFile('b.txt', 'also changed')
    await service.stage(['a.txt'])
    await service.commit('Only A')

    expect((await service.status()).map((entry) => entry.path)).toEqual(['b.txt'])
    expect(new TextDecoder().decode(await service.getFileAtRevision('HEAD', 'a.txt'))).toBe('changed')
  })

  it('treats decomposed macOS filenames as the same Git path', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    const service = createGitService(workspace)
    const decomposedPath = 'songs/cafe\u0301.abc'
    const composedPath = 'songs/caf\u00e9.abc'

    await service.init()
    await workspace.writeFile(decomposedPath, 'A:1\nK:C\nCDEF|')

    expect((await service.status()).map((entry) => entry.path)).toEqual([composedPath])
    await service.stage([composedPath])
    await service.commit('Unicode path')

    expect(await service.status()).toEqual([])
    expect(new TextDecoder().decode(await service.getFileAtRevision('HEAD', composedPath))).toBe('A:1\nK:C\nCDEF|')
  })
})
