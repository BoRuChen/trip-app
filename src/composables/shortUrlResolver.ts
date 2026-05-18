const ALLOWED_HOSTNAMES = new Set(['www.google.com', 'maps.google.com', 'google.com'])
const TIMEOUT_MS = 8000
export const SHORT_URL_ERROR =
  '短網址解析失敗，請在瀏覽器打開連結後複製跳轉後的長網址'

export async function resolveShortUrl(url: string): Promise<string> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(proxyUrl, { signal: controller.signal })
  } catch {
    throw new Error(SHORT_URL_ERROR)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw new Error(SHORT_URL_ERROR)

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(SHORT_URL_ERROR)
  }

  const finalUrl =
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    typeof (data as { status: unknown }).status === 'object' &&
    (data as { status: { url?: unknown } }).status !== null
      ? (data as { status: { url?: unknown } }).status.url
      : undefined

  if (typeof finalUrl !== 'string' || finalUrl === '') {
    throw new Error(SHORT_URL_ERROR)
  }

  let hostname: string
  try {
    hostname = new URL(finalUrl).hostname
  } catch {
    throw new Error(SHORT_URL_ERROR)
  }

  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    throw new Error(SHORT_URL_ERROR)
  }

  return finalUrl
}