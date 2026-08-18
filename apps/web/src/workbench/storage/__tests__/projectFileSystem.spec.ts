import { describe, expect, it } from 'vitest'
import { createProjectFileSystem, createProjectMarker, ProjectMarkerError, ProjectPathError, validateProjectPath, validateProjectRootName } from '../projectFileSystem'
import { createFakeWorkspaceDirectory } from './fakeWorkspaceDirectory'
import { createWorkspaceFileSystem } from '../workspaceFileSystem'

function createProject() {
  return createProjectFileSystem(createWorkspaceFileSystem(createFakeWorkspaceDirectory()))
}

describe('validateProjectPath', () => {
  it.each(['songs/a.abc', 'songs/foo/bar.abc'])('allows %s', (path) => {
    expect(validateProjectPath(path)).toBe(path)
  })

  it.each(['', '../x', 'foo/../../x', '/foo', 'C:\\foo', 'songs//a.abc', 'songs/./a.abc', 'songs/..'])('rejects traversal or absolute path %s', (path) => {
    expect(() => validateProjectPath(path)).toThrow(ProjectPathError)
  })
})

describe('ProjectFileSystem', () => {
  it('writes allowed project files and rejects unknown files', async () => {
    const project = createProject()
    await project.writeFile('songs/a.abc', 'X:1\n')
    expect(new TextDecoder().decode(await project.readFile('songs/a.abc'))).toBe('X:1\n')
    await expect(project.writeFile('secrets.txt', 'no')).rejects.toBeInstanceOf(ProjectPathError)
    await expect(project.writeFile('../outside.txt', 'no')).rejects.toBeInstanceOf(ProjectPathError)
  })

  it('accepts project configuration, generated output and git internals', async () => {
    const project = createProject()
    await project.writeFile('.zupfnoter-project', '{}')
    await project.writeFile('config/layout.json', '{}')
    await project.writeFile('output/song.pdf', new Uint8Array([1, 2]))
    await project.mkdir('.git')
    await project.writeFile('.git/HEAD', 'ref: refs/heads/main\n')
    expect(await project.exists('.git/HEAD')).toBe(true)
  })
})

describe('project root defense in depth', () => {
  it.each(['Users', 'home', 'Windows', 'System', 'Applications', 'Program Files', 'C:\\'])('rejects obviously critical root %s', (name) => {
    expect(() => validateProjectRootName(name)).toThrow(ProjectMarkerError)
  })

  it('does not reject a normal project name', () => {
    expect(() => validateProjectRootName('Meine Zupfnoter-Stücke')).not.toThrow()
  })
})

describe('project marker', () => {
  it('creates and reads a valid marker', async () => {
    const project = createProject()
    await createProjectMarker(project, '12345678-1234-1234-1234-123456789abc')
    expect(new TextDecoder().decode(await project.readFile('.zupfnoter-project'))).toContain('zupfnoter-project')
  })

  it('rejects a missing marker', async () => {
    const project = createProject()
    const { readProjectMarker } = await import('../projectFileSystem')
    await expect(readProjectMarker(project)).rejects.toBeInstanceOf(ProjectMarkerError)
  })

  it.each([
    '{}',
    '{"type":"other","version":1,"id":"x"}',
    '{"type":"zupfnoter-project","version":2,"id":"x"}',
    '{not-json}',
  ])('rejects invalid marker %s', async (content) => {
    const project = createProject()
    await project.writeFile('.zupfnoter-project', content)
    await expect(import('../projectFileSystem').then(({ readProjectMarker }) => readProjectMarker(project))).rejects.toBeInstanceOf(ProjectMarkerError)
  })
})
