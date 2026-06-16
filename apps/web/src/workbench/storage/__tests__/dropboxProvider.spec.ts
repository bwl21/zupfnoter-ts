import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
const localStorageMock = {
  getItem: vi.fn((key: string) => (key === 'zupfnoter.dropbox.token'
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
    localStorageMock.getItem.mockImplementation((key: string) => (key === 'zupfnoter.dropbox.token'
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
})
