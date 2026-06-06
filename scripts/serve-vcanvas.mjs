import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const port = Number(process.env.VCANVAS_PORT || 18087)
const host = process.env.VCANVAS_HOST || '0.0.0.0'
const staticDir = path.resolve(process.env.VCANVAS_STATIC_DIR || 'dist')
const proxyPaths = new Set(['/proxy', '/_vcanvas_proxy'])
const remixPath = '/api/remix/fetch'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function writeCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(res, statusCode, payload) {
  writeCors(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isAllowedUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getStaticFilePath(urlPathname) {
  const relativePath = decodeURIComponent(urlPathname === '/' ? '/index.html' : urlPathname)
  const resolved = path.resolve(staticDir, `.${relativePath}`)
  if (!resolved.startsWith(staticDir)) return null

  if (existsSync(resolved) && statSync(resolved).isFile()) return resolved

  const fallback = path.join(staticDir, 'index.html')
  if (!path.extname(resolved) && existsSync(fallback)) return fallback

  return null
}

function ensureAbsoluteUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString()
  } catch {
    return maybeRelative
  }
}

function extractStylesheetUrls(html, baseUrl) {
  return [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]+href=["']([^"']+)["']/gi)]
    .map((match) => ensureAbsoluteUrl(baseUrl, match[1]))
    .slice(0, 3)
}

function rebaseHtml(html, baseUrl) {
  return html
    .replace(/(src|href)=["']([^"']+)["']/gi, (_, attr, value) => `${attr}="${ensureAbsoluteUrl(baseUrl, value)}"`)
    .replace(/url\((['"]?)([^'")]+)\1\)/gi, (_, quote, value) => `url(${quote}${ensureAbsoluteUrl(baseUrl, value)}${quote})`)
}

function extractStyleHints(html, cssSnippets) {
  const colors = [...new Set([...html.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((match) => match[0]).slice(0, 8))]
  const fonts = [...new Set([...cssSnippets.join('\n').matchAll(/font-family\s*:\s*([^;]+);/gi)].map((match) => match[1].trim()).slice(0, 6))]
  const keywords = [...new Set(
    ['hero', 'grid', 'sidebar', 'cta', 'card', 'editorial', 'mono']
      .filter((keyword) => new RegExp(keyword.replace(/\s+/g, '\\s+'), 'i').test(html + '\n' + cssSnippets.join('\n'))),
  )]

  return [
    ...colors.map((color) => `color:${color}`),
    ...fonts.map((font) => `font:${font}`),
    ...keywords.map((keyword) => `keyword:${keyword}`),
  ]
}

async function handleProxy(req, res) {
  try {
    const raw = await readBody(req)
    const payload = raw ? JSON.parse(raw) : {}
    const targetUrl = payload?.url
    if (!isAllowedUrl(targetUrl)) {
      sendJson(res, 400, { error: 'Invalid target URL' })
      return
    }

    const upstream = await fetch(targetUrl, {
      method: payload?.method || 'GET',
      headers: payload?.headers || {},
      body: payload?.body || undefined,
    })

    writeCors(res)
    res.statusCode = upstream.status

    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)

    const cacheControl = upstream.headers.get('cache-control')
    if (cacheControl) res.setHeader('Cache-Control', cacheControl)

    if (!upstream.body) {
      res.end()
      return
    }

    for await (const chunk of upstream.body) {
      res.write(chunk)
    }
    res.end()
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function handleRemixFetch(req, res) {
  try {
    const raw = await readBody(req)
    const payload = raw ? JSON.parse(raw) : {}
    const targetUrl = payload?.url
    if (!isAllowedUrl(targetUrl)) {
      sendJson(res, 400, { ok: false, error: 'Invalid target URL' })
      return
    }

    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'VCanvas Public Server Remix Fetcher',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        ok: false,
        error: `Homepage fetch failed: ${upstream.status}`,
      })
      return
    }

    const html = (await upstream.text()).slice(0, 20000)
    const stylesheetUrls = extractStylesheetUrls(html, targetUrl)
    const stylesheetSnippets = []

    for (const stylesheetUrl of stylesheetUrls) {
      try {
        const stylesheetResponse = await fetch(stylesheetUrl, {
          headers: { 'User-Agent': 'VCanvas Public Server Remix Fetcher' },
        })
        if (!stylesheetResponse.ok) continue
        stylesheetSnippets.push((await stylesheetResponse.text()).slice(0, 3000))
      } catch {
        // degrade gracefully
      }
    }

    sendJson(res, 200, {
      ok: true,
      url: targetUrl,
      html,
      rebasedHtml: rebaseHtml(html, targetUrl),
      stylesheetSnippets,
      styleHints: extractStyleHints(html, stylesheetSnippets),
    })
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = contentTypes[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType })

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  const stream = createReadStream(filePath)
  stream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Failed to read file')
  })
  stream.pipe(res)
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`)

  if (method === 'OPTIONS' && proxyPaths.has(url.pathname)) {
    writeCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, port, host, staticDir })
    return
  }

  if (method === 'POST' && proxyPaths.has(url.pathname)) {
    await handleProxy(req, res)
    return
  }

  if (method === 'POST' && url.pathname === remixPath) {
    await handleRemixFetch(req, res)
    return
  }

  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Method not allowed')
    return
  }

  const filePath = getStaticFilePath(url.pathname)
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  serveStatic(req, res, filePath)
})

server.listen(port, host, () => {
  console.log(`VCanvas server listening on http://${host}:${port}`)
})
