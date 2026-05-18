import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMapsInput } from '../useMapsUrlParser'
import { resolveShortUrl } from '../shortUrlResolver'

vi.mock('../shortUrlResolver', () => ({
  resolveShortUrl: vi.fn(),
  SHORT_URL_ERROR: '短網址解析失敗，請在瀏覽器打開連結後複製跳轉後的長網址',
}))

describe('parseMapsInput', () => {
  beforeEach(() => {
    vi.mocked(resolveShortUrl).mockReset()
  })

  it('parses /place/<name>/@lat,lng,zoom URL', async () => {
    const r = await parseMapsInput('https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })

  it('parses ?q=lat,lng URL', async () => {
    const r = await parseMapsInput('https://www.google.com/maps/?q=35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat, lng" string', async () => {
    const r = await parseMapsInput('35.1531, 129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat,lng" without space', async () => {
    const r = await parseMapsInput('35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('resolves a maps.app.goo.gl short URL via resolveShortUrl then parses coords', async () => {
    vi.mocked(resolveShortUrl).mockResolvedValueOnce(
      'https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z',
    )

    const r = await parseMapsInput('https://maps.app.goo.gl/abc123')

    expect(resolveShortUrl).toHaveBeenCalledWith('https://maps.app.goo.gl/abc123')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })

  it('returns ok:false with resolver error message when resolveShortUrl rejects', async () => {
    vi.mocked(resolveShortUrl).mockRejectedValueOnce(
      new Error('短網址解析失敗，請在瀏覽器打開連結後複製跳轉後的長網址'),
    )

    const r = await parseMapsInput('https://maps.app.goo.gl/abc123')

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/短網址解析失敗/)
  })

  it('rejects garbage input', async () => {
    const r = await parseMapsInput('hello world')
    expect(r.ok).toBe(false)
  })

  it('rejects out-of-range coordinates', async () => {
    const r = await parseMapsInput('95.0, 200.0')
    expect(r.ok).toBe(false)
  })

  it('decodes URL-encoded place names', async () => {
    const r = await parseMapsInput('https://www.google.com/maps/place/%EA%B4%91%EC%95%88%EB%A6%AC/@35.15,129.11,17z')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.name).toBe('광안리')
  })

  it('handles malformed URL encoding without throwing', async () => {
    const r = await parseMapsInput('https://www.google.com/maps/place/%E0/@35.1531,129.1187,17z')
    expect(r.ok).toBe(true)
    // Should not throw; name falls back to the raw segment
  })

  it('parses /maps/@lat,lng,zoom URL (no /place/ segment)', async () => {
    const r = await parseMapsInput('https://www.google.com/maps/@35.1531,129.1187,17z')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('prefers !3d!4d pin coords over @viewport coords on a real place URL', async () => {
    const url =
      'https://www.google.com/maps/place/Haeundae+Beach/@35.1585,129.1604,17z/data=!3m1!4b1!4m6!3m5!1s0x35689e5fd3d05ed3:0x6a8f3ec3e87497a4!8m2!3d35.158698!4d129.160056!16s%2Fg%2F11b6q6_d8h'
    const r = await parseMapsInput(url)
    expect(r).toEqual({ ok: true, lat: 35.158698, lng: 129.160056, name: 'Haeundae Beach' })
  })

  it('falls back to @viewport coords when /place/ URL has no data segment', async () => {
    const r = await parseMapsInput(
      'https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z',
    )
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })
})
