const LOCAL_PROXY_URL = 'http://127.0.0.1:8765/proxy'
const SAME_ORIGIN_PROXY_PATH = '/_vcanvas_proxy'

let resolvedProxyUrlPromise: Promise<string> | null = null

function isLocalHostname(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost'
}

function getSameOriginProxyUrl(origin: string) {
  return `${origin.replace(/\/$/, '')}${SAME_ORIGIN_PROXY_PATH}`
}

async function detectProxyUrl() {
  if (typeof window === 'undefined') return LOCAL_PROXY_URL

  const { origin } = window.location
  const healthUrl = `${origin.replace(/\/$/, '')}/health`

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      cache: 'no-store',
    })
    if (!response.ok) return LOCAL_PROXY_URL

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return LOCAL_PROXY_URL

    const payload = await response.json()
    if (payload?.ok === true) {
      return getSameOriginProxyUrl(origin)
    }
  } catch {
    // Fall back to the local desktop proxy when the same-origin server probe fails.
  }

  return LOCAL_PROXY_URL
}

export async function resolveProxyUrl(): Promise<string> {
  if (!resolvedProxyUrlPromise) {
    resolvedProxyUrlPromise = detectProxyUrl()
  }

  return resolvedProxyUrlPromise
}

export async function shouldUseProxyFirst(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (isLocalHostname(window.location.hostname)) return false

  return (await resolveProxyUrl()) !== LOCAL_PROXY_URL
}
