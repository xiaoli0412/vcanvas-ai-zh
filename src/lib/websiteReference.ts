import { resolveProxyUrl } from './proxy'

export interface WebsiteReferenceContext {
  url: string
  html: string
  screenshotDataUrl: string | null
  stylesheetSnippets: string[]
  styleHints: string[]
  fetchedAt: string
  error: string | null
}

const MAX_HTML_CHARS = 14000
const MAX_STYLESHEET_COUNT = 3
const MAX_STYLESHEET_CHARS = 4000

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeWebsiteUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return null

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

async function proxyFetchText(url: string) {
  const proxyUrl = await resolveProxyUrl()
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      method: 'GET',
      headers: {
        Accept: 'text/html, text/css, */*',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url} (${response.status})`)
  }

  return response.text()
}

function absolutizeUrl(candidate: string, baseUrl: string) {
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return candidate
  }
}

function rebaseDocumentHtml(rawHtml: string, baseUrl: string) {
  if (typeof DOMParser === 'undefined') {
    return rawHtml
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')

  Array.from(doc.querySelectorAll('script')).forEach((node) => node.remove())

  let base = doc.querySelector('base')
  if (!base) {
    base = doc.createElement('base')
    if (doc.head) {
      doc.head.prepend(base)
    }
  }
  base?.setAttribute('href', baseUrl)

  for (const element of Array.from(doc.querySelectorAll('[src], [href], [poster]'))) {
    for (const attribute of ['src', 'href', 'poster']) {
      const value = element.getAttribute(attribute)
      if (!value || value.startsWith('data:') || value.startsWith('javascript:')) continue
      element.setAttribute(attribute, absolutizeUrl(value, baseUrl))
    }
  }

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

function collectStylesheetUrls(rawHtml: string, baseUrl: string) {
  if (typeof DOMParser === 'undefined') {
    return [] as string[]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  const urls = new Set<string>()

  for (const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))) {
    const href = link.getAttribute('href')
    if (!href) continue
    urls.add(absolutizeUrl(href, baseUrl))
    if (urls.size >= MAX_STYLESHEET_COUNT) break
  }

  return Array.from(urls)
}

function sliceUniqueMatches(source: string, pattern: RegExp, limit = 6) {
  const results: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null = null

  while ((match = pattern.exec(source)) && results.length < limit) {
    const value = normalizeWhitespace(match[1] || match[0] || '')
    if (!value || seen.has(value)) continue
    seen.add(value)
    results.push(value)
  }

  return results
}

function extractStyleHints(html: string, stylesheets: string[]) {
  const combined = [html, ...stylesheets].join('\n')
  const colors = sliceUniqueMatches(combined, /(#(?:[0-9a-f]{3,8}))/gi, 6)
  const fonts = sliceUniqueMatches(combined, /font-family\s*:\s*([^;}{]+)/gi, 5)
  const radii = sliceUniqueMatches(combined, /border-radius\s*:\s*([^;}{]+)/gi, 4)
  const layoutKeywords = [
    'hero',
    'navbar',
    'pricing',
    'testimonial',
    'card',
    'grid',
    'cta',
    'footer',
  ].filter((keyword) => combined.toLowerCase().includes(keyword))

  const hints = [
    colors.length ? `Colors detected: ${colors.join(', ')}` : null,
    fonts.length ? `Font families detected: ${fonts.join(', ')}` : null,
    radii.length ? `Rounded corners seen: ${radii.join(', ')}` : null,
    layoutKeywords.length ? `Layout cues: ${layoutKeywords.join(', ')}` : null,
  ].filter((value): value is string => Boolean(value))

  if (hints.length > 0) return hints

  return ['Use the homepage structure, typography rhythm, spacing, and visual hierarchy as the reference baseline.']
}

async function captureWebsiteScreenshot(rebasedHtml: string) {
  if (typeof document === 'undefined') return null

  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-20000px'
  iframe.style.top = '0'
  iframe.style.width = '1440px'
  iframe.style.height = '1024px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.srcdoc = rebasedHtml

  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1800)
      iframe.addEventListener('load', () => {
        window.setTimeout(() => {
          window.clearTimeout(timeout)
          resolve()
        }, 250)
      }, { once: true })
    })

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc?.body) return null

    const { default: html2canvas } = await import('html2canvas')
    const width = Math.min(Math.max(doc.documentElement.scrollWidth, 1280), 1440)
    const height = Math.min(Math.max(doc.documentElement.scrollHeight, 720), 2200)
    const canvas = await html2canvas(doc.body, {
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 0.45,
      logging: false,
      windowWidth: width,
      windowHeight: height,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    iframe.remove()
  }
}

export async function fetchWebsiteReference(inputUrl: string): Promise<WebsiteReferenceContext> {
  const url = normalizeWebsiteUrl(inputUrl)
  if (!url) {
    throw new Error('Please enter a valid http or https URL.')
  }

  const rawHtml = await proxyFetchText(url)
  const rebasedHtml = rebaseDocumentHtml(rawHtml, url)
  const stylesheetUrls = collectStylesheetUrls(rawHtml, url)
  const stylesheetResults = await Promise.allSettled(
    stylesheetUrls.map((stylesheetUrl) => proxyFetchText(stylesheetUrl)),
  )

  const stylesheetSnippets = stylesheetResults
    .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
    .map((result) => result.value.slice(0, MAX_STYLESHEET_CHARS))

  const screenshotDataUrl = await captureWebsiteScreenshot(rebasedHtml)
  const styleHints = extractStyleHints(rawHtml, stylesheetSnippets)

  return {
    url,
    html: rebasedHtml.slice(0, MAX_HTML_CHARS),
    screenshotDataUrl,
    stylesheetSnippets,
    styleHints,
    fetchedAt: new Date().toISOString(),
    error: null,
  }
}

export function formatWebsiteReferenceSummary(reference: WebsiteReferenceContext | null) {
  if (!reference) return ''
  return `${reference.url} · ${reference.styleHints.slice(0, 2).join(' · ')}`
}
