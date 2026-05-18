import { describe, it, expect } from 'vitest'
import { parseMapsInput } from '../useMapsUrlParser'

describe('parseMapsInput', () => {
  it('parses /place/<name>/@lat,lng,zoom URL', () => {
    const r = parseMapsInput('https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })

  it('parses ?q=lat,lng URL', () => {
    const r = parseMapsInput('https://www.google.com/maps/?q=35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat, lng" string', () => {
    const r = parseMapsInput('35.1531, 129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat,lng" without space', () => {
    const r = parseMapsInput('35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('rejects maps.app.goo.gl short URLs with a helpful message', () => {
    const r = parseMapsInput('https://maps.app.goo.gl/abc123')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/short.*url/i)
  })

  it('rejects garbage input', () => {
    const r = parseMapsInput('hello world')
    expect(r.ok).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    const r = parseMapsInput('95.0, 200.0')
    expect(r.ok).toBe(false)
  })

  it('decodes URL-encoded place names', () => {
    const r = parseMapsInput('https://www.google.com/maps/place/%EA%B4%91%EC%95%88%EB%A6%AC/@35.15,129.11,17z')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.name).toBe('광안리')
  })

  it('handles malformed URL encoding without throwing', () => {
    const r = parseMapsInput('https://www.google.com/maps/place/%E0/@35.1531,129.1187,17z')
    expect(r.ok).toBe(true)
    // Should not throw; name falls back to the raw segment
  })

  it('parses /maps/@lat,lng,zoom URL (no /place/ segment)', () => {
    const r = parseMapsInput('https://www.google.com/maps/@35.1531,129.1187,17z')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('prefers !3d!4d pin coords over @viewport coords on a real place URL', () => {
    const url =
      'https://www.google.com/maps/place/Haeundae+Beach/@35.1585,129.1604,17z/data=!3m1!4b1!4m6!3m5!1s0x35689e5fd3d05ed3:0x6a8f3ec3e87497a4!8m2!3d35.158698!4d129.160056!16s%2Fg%2F11b6q6_d8h'
    const r = parseMapsInput(url)
    expect(r).toEqual({ ok: true, lat: 35.158698, lng: 129.160056, name: 'Haeundae Beach' })
  })

  it('falls back to @viewport coords when /place/ URL has no data segment', () => {
    const r = parseMapsInput(
      'https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z',
    )
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })
})
