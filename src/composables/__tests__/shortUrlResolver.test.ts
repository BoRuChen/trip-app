import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveShortUrl } from '../shortUrlResolver'

describe('resolveShortUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('resolves a maps.app.goo.gl short URL to its final google.com URL via allorigins', async () => {
    const longUrl = 'https://www.google.com/maps/place/Foo/@35.15,129.11,17z'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { url: longUrl } }),
    } as Response)

    const result = await resolveShortUrl('https://maps.app.goo.gl/abc')

    expect(result).toBe(longUrl)
    expect(fetch).toHaveBeenCalledOnce()
    const calledUrl = vi.mocked(fetch).mock.calls[0]![0] as string
    expect(calledUrl).toContain('api.allorigins.win')
    expect(calledUrl).toContain(encodeURIComponent('https://maps.app.goo.gl/abc'))
  })

  it('throws when fetch rejects (network error)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))
    await expect(resolveShortUrl('https://maps.app.goo.gl/abc')).rejects.toThrow()
  })

  it('throws when allorigins responds with non-ok HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response)
    await expect(resolveShortUrl('https://maps.app.goo.gl/abc')).rejects.toThrow()
  })

  it('throws when response is missing status.url', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: {} }),
    } as Response)
    await expect(resolveShortUrl('https://maps.app.goo.gl/abc')).rejects.toThrow()
  })

  it('throws when final URL hostname is not in the google whitelist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { url: 'https://evil.example.com/foo' } }),
    } as Response)
    await expect(resolveShortUrl('https://maps.app.goo.gl/abc')).rejects.toThrow()
  })

  it('accepts maps.google.com as a valid final hostname', async () => {
    const longUrl = 'https://maps.google.com/?q=35.15,129.11'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { url: longUrl } }),
    } as Response)

    const result = await resolveShortUrl('https://maps.app.goo.gl/abc')
    expect(result).toBe(longUrl)
  })

  it('aborts and throws after 8s timeout', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          ;(init as RequestInit).signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )

    const promise = resolveShortUrl('https://maps.app.goo.gl/abc')
    // Attach catch handler now so the rejection isn't reported as unhandled
    const settled = expect(promise).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(8000)
    await settled
  })
})