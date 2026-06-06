import path from 'node:path'

export interface ServerConfig {
  host: string
  port: number
  staticDir: string
  proxyPaths: Set<string>
}

export function loadServerConfig(): ServerConfig {
  return {
    host: process.env.VCANVAS_HOST || '0.0.0.0',
    port: Number(process.env.VCANVAS_PORT || 18087),
    staticDir: path.resolve(process.env.VCANVAS_STATIC_DIR || 'dist'),
    proxyPaths: new Set(['/proxy', '/_vcanvas_proxy']),
  }
}
