import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
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

export async function createServer() {
  const config = loadServerConfig()
  const app = Fastify({
    logger: false,
    bodyLimit: 8 * 1024 * 1024,
  })

  await app.register(fastifyStatic, {
    root: config.staticDir,
    prefix: '/',
    wildcard: false,
  })

  app.addHook('onSend', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  })

  app.options('/proxy', async (_request, reply) => reply.code(204).send())
  app.options('/_vcanvas_proxy', async (_request, reply) => reply.code(204).send())
  app.options('/api/*', async (_request, reply) => reply.code(204).send())

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

  app.setNotFoundHandler(async (request, reply) => {
    if (request.raw.method !== 'GET' && request.raw.method !== 'HEAD') {
      reply.code(404).send({ ok: false, error: 'Not found' })
      return
    }

    return reply.sendFile('index.html')
  })

  return { app, config }
}

export async function startServer() {
  const { app, config } = await createServer()
  await app.listen({ host: config.host, port: config.port })
  return { app, config }
}
