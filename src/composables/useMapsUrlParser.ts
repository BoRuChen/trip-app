export type ParseResult =
  | { ok: true; lat: number; lng: number; name?: string }
  | { ok: false; reason: string }

const isValidLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90
const isValidLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180

function tryBareCoords(input: string): ParseResult | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return { ok: false, reason: '座標超出有效範圍' }
  }
  return { ok: true, lat, lng }
}

function tryPlaceUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/place/<name>/@lat,lng,zoom
  const m = input.match(/\/maps\/place\/([^/]+)\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const name = decodeURIComponent(m[1].replace(/\+/g, ' '))
  const lat = parseFloat(m[2])
  const lng = parseFloat(m[3])
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng, name }
}

function tryQueryUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/?q=lat,lng or ...&query=lat,lng
  const m = input.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng }
}

export function parseMapsInput(input: string): ParseResult {
  if (!input || !input.trim()) {
    return { ok: false, reason: '輸入為空' }
  }
  if (/maps\.app\.goo\.gl/.test(input)) {
    return { ok: false, reason: '不支援 short URL，請在瀏覽器打開後貼展開的網址' }
  }
  return (
    tryPlaceUrl(input) ??
    tryQueryUrl(input) ??
    tryBareCoords(input) ?? {
      ok: false,
      reason: '無法解析，請貼 Google Maps 連結或座標（如 35.15, 129.11）',
    }
  )
}
