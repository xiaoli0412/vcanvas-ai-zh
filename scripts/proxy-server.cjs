const http = require('node:http')

const DEFAULT_PROXY_PORT = 8765
const DEFAULT_PROXY_HOST = '127.0.0.1'
const PROXY_PATHS = new Set(['/proxy', '/_vcanvas_proxy'])

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

function createProxyServer(options = {}) {
  const port = Number(options.port ?? DEFAULT_PROXY_PORT)
  const host = options.host || DEFAULT_PROXY_HOST

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      writeCors(res)
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url === '/health') {
      sendJson(res, 200, { ok: true, port, host })
      return
    }

    if (req.method !== 'POST' || !PROXY_PATHS.has(req.url || '')) {
      sendJson(res, 404, { error: 'Not found' })
      return
    }

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
  })

  return { server, host, port }
}

function startProxyServer(options = {}) {
  const { server, host, port } = createProxyServer(options)

  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      const address = server.address()
      const resolvedPort = typeof address === 'object' && address ? address.port : port
      resolve({
        server,
        host,
        port: resolvedPort,
        proxyUrl: `http://${host}:${resolvedPort}/proxy`,
      })
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

module.exports = {
  DEFAULT_PROXY_HOST,
  DEFAULT_PROXY_PORT,
  createProxyServer,
  startProxyServer,
}
