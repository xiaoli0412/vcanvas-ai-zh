import type { FastifyReply, FastifyRequest } from 'fastify'

function isAllowedUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function proxyHandler(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }

  const targetUrl = payload?.url || ''
  if (!isAllowedUrl(targetUrl)) {
    reply.code(400).send({ error: 'Invalid target URL' })
    return
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: payload?.method || 'GET',
      headers: payload?.headers || {},
      body: payload?.body || undefined,
    })

    const contentType = upstream.headers.get('content-type')
    if (contentType) reply.header('Content-Type', contentType)

    const cacheControl = upstream.headers.get('cache-control')
    if (cacheControl) reply.header('Cache-Control', cacheControl)

    const text = await upstream.text()
    reply.code(upstream.status).send(text)
  } catch (error) {
    reply.code(502).send({
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
