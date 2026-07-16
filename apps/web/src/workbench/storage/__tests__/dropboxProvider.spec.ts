import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
const localStorageMock = {
  getItem: vi.fn((key: string) => (key === 'zupfnoter.storage.dropbox.token.default'
    ? JSON.stringify({ access_token: 'token' })
    : null)),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

vi.stubGlobal('fetch', fetchMock)
vi.stubGlobal('localStorage', localStorageMock)

describe('dropboxProvider', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorageMock.getItem.mockImplementation((key: string) => (key === 'zupfnoter.storage.dropbox.token.default'
      ? JSON.stringify({ access_token: 'token' })
      : null))
  })

  it('uses Dropbox search instead of recursive listing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        matches: [
          { metadata: { metadata: { path_display: '/A/abend1.abc' } } },
          { metadata: { metadata: { path_display: '/B/sub/abend2.abc' } } },
        ],
      }),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
    } as Response)

    const { createDropboxProvider } = await import('../dropboxProvider')
    const provider = createDropboxProvider()
    const results = await provider.search({ system: 'dropbox', path: '/A', loggedIn: true, pendingCandidates: [] }, 'Abend')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/files/search_v2',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(results).toEqual(['/A/abend1.abc', '/B/sub/abend2.abc'])
  })

  it('hides dot-prefixed folders from the root picker', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [
          { '.tag': 'folder', name: '.cache', path_display: '/.cache' },
          { '.tag': 'folder', name: 'Noten', path_display: '/Noten' },
        ],
        cursor: 'cursor',
        has_more: false,
      }),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
    } as Response)

    const { createDropboxProvider } = await import('../dropboxProvider')
    const provider = createDropboxProvider()

    await expect(provider.listFolders({ system: 'dropbox', path: '', loggedIn: true, pendingCandidates: [] }, '')).resolves.toEqual([
      { name: 'Noten', path: 'Noten' },
    ])
  })

  it('removes credentials only for the selected connection', async () => {
    const { removeDropboxConnection } = await import('../dropboxProvider')

    removeDropboxConnection('private')

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zupfnoter.storage.dropbox.token.private')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('zupfnoter.storage.dropbox.authstate.private')
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('zupfnoter.storage.dropbox.token.club')
  })
})
