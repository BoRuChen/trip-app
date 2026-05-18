import { resolveShortUrl } from './shortUrlResolver'

export type ParseResult =
  | { ok: true; lat: number; lng: number; name?: string }
  | { ok: false; reason: string }

const isValidLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90
const isValidLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180

function tryBareCoords(input: string): ParseResult | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1]!)
  const lng = parseFloat(m[2]!)
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return { ok: false, reason: '座標超出有效範圍' }
  }
  return { ok: true, lat, lng }
}

function tryDataPin(input: string): { lat: number; lng: number } | null {
  // /data=...!3d<lat>!4d<lng>... — actual place pin (higher precision than @viewport)
  const m = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = parseFloat(m[1]!)
  const lng = parseFloat(m[2]!)
  if (!isValidLat(lat) || !isValidLng(lng)) return null
  return { lat, lng }
}

function tryPlaceUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/place/<name>/@<viewport>/data=...!3d!4d<pin>
  const nameMatch = input.match(/\/maps\/place\/([^/]+)/)
  if (!nameMatch) return null
  let name: string
  try {
    name = decodeURIComponent(nameMatch[1]!.replace(/\+/g, ' '))
  } catch {
    name = nameMatch[1]!.replace(/\+/g, ' ')
  }

  const pin = tryDataPin(input)
  if (pin) return { ok: true, ...pin, name }

  const atMatch = input.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1]!)
    const lng = parseFloat(atMatch[2]!)
    if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
    return { ok: true, lat, lng, name }
  }

  return null
}

function tryAtUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/@lat,lng,zoom (no /place/ segment)
  const m = input.match(/\/maps\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = parseFloat(m[1]!)
  const lng = parseFloat(m[2]!)
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng }
}

function tryQueryUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/?q=lat,lng or ...&query=lat,lng
  const m = input.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = parseFloat(m[1]!)
  const lng = parseFloat(m[2]!)
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng }
}

function parseLongInput(input: string): ParseResult {
  return (
    tryPlaceUrl(input) ??
    tryAtUrl(input) ??
    tryQueryUrl(input) ??
    tryBareCoords(input) ?? {
      ok: false,
      reason: '無法解析，請貼 Google Maps 連結或座標（如 35.15, 129.11）',
    }
  )
}

export async function parseMapsInput(input: string): Promise<ParseResult> {
  if (!input || !input.trim()) {
    return { ok: false, reason: '輸入為空' }
  }
  if (/maps\.app\.goo\.gl/.test(input)) {
    let resolved: string
    try {
      resolved = await resolveShortUrl(input.trim())
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
    return parseLongInput(resolved)
  }
  return parseLongInput(input)
}
