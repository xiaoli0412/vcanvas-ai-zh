import type { WebsiteReferenceContext } from '../../shared/contracts/publicServer'

interface RemixFetchResponse {
  ok: boolean
  url: string
  html: string
  rebasedHtml?: string
  stylesheetSnippets: string[]
  styleHints: string[]
  error?: string
}

async function captureRebasedHtmlScreenshot(html: string): Promise<string | null> {
  if (!html || typeof document === 'undefined') return null

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1440px'
  iframe.style.height = '900px'
  iframe.style.pointerEvents = 'none'
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.srcdoc = html
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      iframe.onload = () => {
        window.setTimeout(finish, 650)
      }
      window.setTimeout(finish, 2200)
    })

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc?.body) return null
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(doc.body, {
      useCORS: true,
      backgroundColor: '#0c0e11',
      scale: 0.7,
      logging: false,
      windowWidth: 1440,
      windowHeight: 900,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    iframe.remove()
  }
}

export async function fetchWebsiteReference(url: string): Promise<WebsiteReferenceContext> {
  const response = await fetch('/api/remix/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  const payload = await response.json() as RemixFetchResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Website reference fetch failed: ${response.status}`)
  }

  const screenshotDataUrl = payload.rebasedHtml
    ? await captureRebasedHtmlScreenshot(payload.rebasedHtml)
    : null

  return {
    url: payload.url,
    html: payload.html,
    rebasedHtml: payload.rebasedHtml || '',
    screenshotDataUrl,
    stylesheetSnippets: payload.stylesheetSnippets || [],
    styleHints: payload.styleHints || [],
    fetchedAt: new Date().toISOString(),
    error: null,
  }
}
