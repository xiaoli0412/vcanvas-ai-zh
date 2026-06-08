import Fastify from 'fastify'
import path from 'node:path'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { loadServerConfig } from './config'
import { proxyHandler } from './routes/proxy'
import { registerSessionRoutes } from './routes/session'
import { registerWorkflowRoutes } from './routes/workflows'
import { registerWorkRoutes } from './routes/works'
import { registerAssetRoutes } from './routes/assets'
import { registerRemixRoutes } from './routes/remix'
import { registerSettingsRoutes } from './routes/settings'
import { registerProviderRoutes } from './routes/providers'
import { registerNoticeRoutes } from './routes/notices'
import { registerUserRoutes } from './routes/users'
import { registerSecurityRoutes } from './routes/security'
import { localDataStore } from './data/localDataStore'
import { enforceTrafficGuard } from './lib/platformPolicy'
import { registerQuotaRoutes } from './routes/quotas'
import { registerOpsRoutes } from './routes/ops'
import { registerPublicPageRoutes } from './routes/publicPages'
import { registerDispatchRoutes } from './routes/dispatch'
import { registerDataRoutes } from './routes/data'
import { registerUpdateRoutes } from './routes/updates'
import { registerPlatformRoutes } from './routes/platform'

export async function createServer() {
  const config = loadServerConfig()
  const app = Fastify({
    logger: false,
    bodyLimit: 8 * 1024 * 1024,
  })

  app.addHook('onSend', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-vcanvas-session-id, x-vcanvas-user-id')
  })

  app.options('/proxy', async (_request, reply) => reply.code(204).send())
  app.options('/_vcanvas_proxy', async (_request, reply) => reply.code(204).send())
  app.options('/api/*', async (_request, reply) => reply.code(204).send())

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return
    const guard = await localDataStore.update((data) => enforceTrafficGuard(data, request))
    if (!guard.ok) {
      const { ok: _ok, statusCode, ...payload } = guard
      return reply.code(statusCode || 429).send({ ok: false, ...payload })
    }
  })

  app.get('/health', async () => ({
    ok: true,
    host: config.host,
    port: config.port,
    staticDir: config.staticDir,
    phase: 'public-server-skeleton',
  }))

  app.post('/proxy', proxyHandler)
  app.post('/_vcanvas_proxy', proxyHandler)

  await registerSessionRoutes(app)
  await registerWorkflowRoutes(app)
  await registerWorkRoutes(app)
  await registerAssetRoutes(app)
  await registerRemixRoutes(app)
  await registerSettingsRoutes(app)
  await registerProviderRoutes(app)
  await registerNoticeRoutes(app)
  await registerUserRoutes(app)
  await registerSecurityRoutes(app)
  await registerQuotaRoutes(app)
  await registerOpsRoutes(app)
  await registerDispatchRoutes(app)
  await registerDataRoutes(app)
  await registerUpdateRoutes(app)
  await registerPlatformRoutes(app)
  await registerPublicPageRoutes(app)

  app.setNotFoundHandler(async (request, reply) => {
    if (request.raw.method !== 'GET' && request.raw.method !== 'HEAD') {
      reply.code(404).send({ ok: false, error: 'Not found' })
      return
    }

    const sendStaticFile = (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase()
      const contentTypes: Record<string, string> = {
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.map': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.txt': 'text/plain; charset=utf-8',
        '.webp': 'image/webp',
        '.woff2': 'font/woff2',
      }
      reply.type(contentTypes[ext] || 'application/octet-stream')
      return reply.send(createReadStream(filePath))
    }

    try {
      const pathname = decodeURIComponent(request.url.split('?')[0] || '/')
      const requestedPath = path.resolve(config.staticDir, `.${pathname}`)
      const insideStaticDir = requestedPath === config.staticDir || requestedPath.startsWith(config.staticDir + path.sep)
      if (insideStaticDir && existsSync(requestedPath) && statSync(requestedPath).isFile()) {
        return sendStaticFile(requestedPath)
      }
    } catch {
      // Fall through to the SPA fallback when the path is malformed.
    }

    return sendStaticFile(path.join(config.staticDir, 'index.html'))
  })

  return { app, config }
}

export async function startServer() {
  const { app, config } = await createServer()
  await app.listen({ host: config.host, port: config.port })
  return { app, config }
}
