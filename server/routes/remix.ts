import type { FastifyInstance } from 'fastify'

interface HtmlFetchPayload {
  url?: string
}

const MAX_CSS_FILES = 3
const MAX_CSS_CHARS = 3000
const MAX_HTML_CHARS = 20000

function ensureAbsoluteUrl(baseUrl: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, baseUrl).toString()
  } catch {
    return maybeRelative
  }
}

function extractStylesheetUrls(html: string, baseUrl: string) {
  const hrefs = [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["']/gi)]
    .map((match) => ensureAbsoluteUrl(baseUrl, match[1]))
  return hrefs.slice(0, MAX_CSS_FILES)
}

function rebaseHtml(html: string, baseUrl: string) {
  return html
    .replace(/(src|href)=["']([^"']+)["']/gi, (_, attr, value) => `${attr}="${ensureAbsoluteUrl(baseUrl, value)}"`)
    .replace(/url\((['"]?)([^'")]+)\1\)/gi, (_, quote, value) => {
      const rebased = ensureAbsoluteUrl(baseUrl, value)
      return `url(${quote}${rebased}${quote})`
    })
}

function extractStyleHints(html: string, cssSnippets: string[]) {
  const colors = [...new Set(
    [...html.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((match) => match[0]).slice(0, 8),
  )]
  const fonts = [...new Set(
    [...cssSnippets.join('\n').matchAll(/font-family\s*:\s*([^;]+);/gi)].map((match) => match[1].trim()).slice(0, 6),
  )]
  const keywords = [...new Set(
    ['hero', 'grid', 'sidebar', 'cta', 'card', 'split layout', 'editorial', 'mono']
      .filter((keyword) => new RegExp(keyword.replace(/\s+/g, '\\s+'), 'i').test(html + '\n' + cssSnippets.join('\n'))),
  )]
  return [
    ...colors.map((color) => `color:${color}`),
    ...fonts.map((font) => `font:${font}`),
    ...keywords.map((keyword) => `keyword:${keyword}`),
  ]
}

export async function registerRemixRoutes(app: FastifyInstance) {
  app.post('/api/remix/fetch', async (request, reply) => {
    const body = (request.body || {}) as HtmlFetchPayload
    const url = body.url?.trim()
    if (!url) {
      reply.code(400).send({ ok: false, error: 'Missing URL' })
      return
    }

    let homepage: Response
    try {
      homepage = await fetch(url, {
        headers: {
          'User-Agent': 'inscanvas Public Server Remix Fetcher',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
    } catch (error) {
      reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    if (!homepage.ok) {
      reply.code(homepage.status).send({
        ok: false,
        error: `Homepage fetch failed: ${homepage.status}`,
      })
      return
    }

    const html = (await homepage.text()).slice(0, MAX_HTML_CHARS)
    const stylesheetUrls = extractStylesheetUrls(html, url)
    const stylesheetSnippets: string[] = []

    for (const stylesheetUrl of stylesheetUrls) {
      try {
        const stylesheetResponse = await fetch(stylesheetUrl, {
          headers: { 'User-Agent': 'inscanvas Public Server Remix Fetcher' },
        })
        if (!stylesheetResponse.ok) continue
        const css = await stylesheetResponse.text()
        stylesheetSnippets.push(css.slice(0, MAX_CSS_CHARS))
      } catch {
        // degrade gracefully
      }
    }

    const rebasedHtml = rebaseHtml(html, url)
    reply.send({
      ok: true,
      url,
      html,
      rebasedHtml,
      stylesheetSnippets,
      styleHints: extractStyleHints(html, stylesheetSnippets),
    })
  })
}
