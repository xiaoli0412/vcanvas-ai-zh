import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT, startProxyServer } = require('./proxy-server.cjs')

const port = Number(process.env.VCANVAS_PROXY_PORT || DEFAULT_PROXY_PORT)
const host = process.env.VCANVAS_PROXY_HOST || DEFAULT_PROXY_HOST

startProxyServer({ port, host })
  .then(({ proxyUrl }) => {
    console.log(`VCanvas custom OpenAI proxy listening on ${proxyUrl}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
