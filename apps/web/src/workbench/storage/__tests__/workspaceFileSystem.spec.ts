import { describe, expect, it } from 'vitest'
import { createWorkspaceFileSystem, WorkspaceFileSystemError } from '../workspaceFileSystem'
import { createFakeWorkspaceDirectory } from './fakeWorkspaceDirectory'

describe('WorkspaceFileSystem', () => {
  it('reads and writes UTF-8 and binary files in nested paths', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    await workspace.writeFile('.git/refs/heads/main', 'abc')
    await workspace.writeFile('assets/data.bin', new Uint8Array([0, 127, 255]))

    expect(new TextDecoder().decode(await workspace.readFile('.git/refs/heads/main'))).toBe('abc')
    expect([...await workspace.readFile('assets/data.bin')]).toEqual([0, 127, 255])
    expect(await workspace.readdir('.git/refs/heads')).toEqual(['main'])
    expect((await workspace.stat('.git')).kind).toBe('directory')
    expect((await workspace.stat('assets/data.bin')).size).toBe(3)
  })

  it('creates directories, renames files, and deletes them', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    await workspace.mkdir('one/two/three')
    await workspace.writeFile('one/two/three/file.txt', 'content')
    await workspace.rename('one/two/three/file.txt', 'one/two/renamed.txt')

    expect(await workspace.exists('one/two/three/file.txt')).toBe(false)
    expect(await workspace.exists('one/two/renamed.txt')).toBe(true)
    await workspace.deleteFile('one/two/renamed.txt')
    expect(await workspace.exists('one/two/renamed.txt')).toBe(false)
  })

  it('reports missing files with a filesystem error code', async () => {
    const workspace = createWorkspaceFileSystem(createFakeWorkspaceDirectory())
    await expect(workspace.readFile('.git/refs/heads/main')).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(workspace.deleteFile('missing.txt')).rejects.toBeInstanceOf(WorkspaceFileSystemError)
  })
})
