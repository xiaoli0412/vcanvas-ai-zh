import http from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const port = Number(process.env.VCANVAS_PORT || 18087)
const host = process.env.VCANVAS_HOST || '0.0.0.0'
const staticDir = path.resolve(process.env.VCANVAS_STATIC_DIR || 'dist')
const proxyPaths = new Set(['/proxy', '/_vcanvas_proxy'])
const remixPath = '/api/remix/fetch'
const dataDir = path.resolve(process.env.VCANVAS_DATA_DIR || '.vcanvas-data')
const dataFile = path.join(dataDir, 'public-server.json')

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
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

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultData() {
  const now0 = new Date(0).toISOString()
  return {
    siteSettings: {
      siteName: 'inscanvas Public Server',
      defaultModeId: 'custom',
      guestEnabled: true,
      serverExecutionDefault: false,
      publicGalleryEnabled: false,
      experimentalFeaturesEnabled: true,
    },
    personalSettings: {
      displayName: 'Guest',
      avatarUrl: null,
      motto: 'Canvas first.',
      preferredModeId: 'custom',
    },
    disclaimerPolicy: {
      shortText: 'Generated with inscanvas. Creator, IP/time metadata, and site disclaimer may be embedded for traceability.',
      longText: 'inscanvas is a creative canvas and model orchestration tool. Generated works must be reviewed before publishing, exporting, or sharing.',
      injectOnExport: true,
      injectOnShare: true,
    },
    rateLimitPolicies: [
      { id: 'guest-ip-daily', scope: 'ip', enabled: true, windowSeconds: 86400, maxRequests: 8, lockoutSeconds: 21600 },
      { id: 'user-hourly-basic', scope: 'user', enabled: true, windowSeconds: 3600, maxRequests: 20 },
    ],
    providerChannels: [
      { id: 'compatible-openai', label: 'Compatible OpenAI', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, favorite: true, enabled: true },
      { id: 'chatgpt', label: 'ChatGPT', endpoint: 'https://api.openai.com/v1/chat/completions', apiType: 'openai', models: [], verifiedAt: null, verifiedSourceUrl: 'https://platform.openai.com/docs/api-reference/chat/create', favorite: true, enabled: true },
      { id: 'kimi', label: 'Kimi', endpoint: 'https://api.moonshot.ai/v1/chat/completions', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://platform.kimi.ai/docs/api/overview', favorite: true, enabled: true },
      { id: 'zai', label: 'z.ai', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
      { id: 'google', label: 'Google', apiType: 'gemini', models: [], verifiedAt: null, verifiedSourceUrl: 'https://ai.google.dev/gemini-api/docs/models', enabled: true },
      { id: 'fireworks', label: 'Fireworks', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://docs.fireworks.ai/', enabled: true },
      { id: 'openrouter', label: 'OpenRouter', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://openrouter.ai/docs', enabled: true },
      { id: 'modelscope', label: 'ModelScope', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://www.modelscope.cn/docs', enabled: true },
      { id: 'ollama', label: 'Ollama', apiType: 'ollama', models: [], verifiedAt: null, verifiedSourceUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md', enabled: true },
      { id: 'dmx', label: 'DMX', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
      { id: 'bailian', label: 'Alibaba Cloud Bailian', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://help.aliyun.com/zh/model-studio/', enabled: true },
      { id: 'mimo', label: 'Xiaomi MiMo', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: null, enabled: true },
      { id: 'stepfun', label: 'StepFun', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://platform.stepfun.com/docs', enabled: true },
      { id: 'nvidia', label: 'Nvidia', apiType: 'openai-compatible', models: [], verifiedAt: null, verifiedSourceUrl: 'https://docs.nvidia.com/nim/', enabled: true },
    ],
    notices: [
      { id: 'phase-2-public-server', kind: 'announcement', title: 'inscanvas public server phase 2', body: 'Canvas-first mode, local persistence, provider governance, and public-server contracts are active in this branch.', format: 'plain', audience: 'all', enabled: true, createdAt: now0, updatedAt: now0 },
    ],
    works: [],
    workflows: [],
    sessions: [],
    auditEvents: [],
  }
}

function mergeData(data) {
  const defaults = defaultData()
  return {
    ...defaults,
    ...(data || {}),
    siteSettings: { ...defaults.siteSettings, ...(data?.siteSettings || {}) },
    personalSettings: { ...defaults.personalSettings, ...(data?.personalSettings || {}) },
    disclaimerPolicy: { ...defaults.disclaimerPolicy, ...(data?.disclaimerPolicy || {}) },
    providerChannels: data?.providerChannels?.length ? data.providerChannels : defaults.providerChannels,
    notices: data?.notices?.length ? data.notices : defaults.notices,
    rateLimitPolicies: data?.rateLimitPolicies?.length ? data.rateLimitPolicies : defaults.rateLimitPolicies,
  }
}

function readData() {
  try {
    return mergeData(JSON.parse(readFileSync(dataFile, 'utf8')))
  } catch {
    const data = defaultData()
    writeData(data)
    return data
  }
}

function writeData(data) {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function readJsonBody(req) {
  const raw = await readBody(req)
  return raw ? JSON.parse(raw) : {}
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || null
}

function withAudit(data, req, action, actorId = 'local-user', actorTier = 'user', metadata = {}) {
  data.auditEvents.push({
    id: createId('audit'),
    actorId,
    actorTier,
    action,
    ip: clientIp(req),
    createdAt: new Date().toISOString(),
    metadata,
  })
}

function injectDisclaimer(html, req) {
  if (!html || html.includes('Generated with inscanvas')) return html
  const note = `<!-- Generated with inscanvas | ip=${clientIp(req) || 'unknown'} | time=${new Date().toISOString()} | review before publishing. -->`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${note}\n</body>`)
  return `${note}\n${html}`
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

async function handleApi(req, res, url) {
  const method = req.method || 'GET'
  const data = readData()

  if (url.pathname === '/api/session/me' && method === 'GET') {
    const now = Date.now()
    const session = data.sessions
      .filter((item) => Date.parse(item.expiresAt) > now)
      .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))[0] || null
    sendJson(res, 200, {
      ok: true,
      executionMode: session?.executionMode || 'browser-local',
      user: {
        id: session?.userId || 'guest-local',
        tier: session?.tier || 'guest',
        displayName: session?.displayName || 'Guest',
      },
      session,
      loginNotice: {
        ip: clientIp(req),
        time: new Date().toISOString(),
        userAgent: req.headers['user-agent'] || null,
      },
    })
    return true
  }

  if ((url.pathname === '/api/session/login' || url.pathname === '/api/session/guest') && method === 'POST') {
    const body = await readJsonBody(req)
    const isGuest = url.pathname.endsWith('/guest')
    const now = new Date()
    const session = {
      id: createId('session'),
      userId: isGuest ? 'guest-local' : (body.userId || 'mock-user'),
      tier: isGuest ? 'guest' : (body.tier || 'user'),
      displayName: isGuest ? 'Guest' : (body.displayName || 'inscanvas user'),
      executionMode: isGuest ? 'browser-local' : 'server-managed',
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
    }
    data.sessions = [...data.sessions.filter((item) => item.userId !== session.userId), session]
    withAudit(data, req, isGuest ? 'session.guest' : 'session.login', session.userId, session.tier)
    writeData(data)
    sendJson(res, 200, { ok: true, executionMode: session.executionMode, user: { id: session.userId, tier: session.tier, displayName: session.displayName }, session })
    return true
  }

  if (url.pathname === '/api/session/logout' && method === 'POST') {
    const body = await readJsonBody(req)
    data.sessions = body.userId ? data.sessions.filter((item) => item.userId !== body.userId) : []
    withAudit(data, req, 'session.logout', body.userId || null, 'guest')
    writeData(data)
    sendJson(res, 200, { ok: true })
    return true
  }

  if (url.pathname === '/api/providers' && method === 'GET') {
    sendJson(res, 200, { ok: true, channels: data.providerChannels, note: 'Model rows are persisted locally and should be verified before becoming built-ins.' })
    return true
  }

  if (url.pathname === '/api/providers' && method === 'POST') {
    const body = await readJsonBody(req)
    const id = body.id || createId('provider')
    const existing = data.providerChannels.find((item) => item.id === id)
    const channel = {
      id,
      label: body.label || existing?.label || id,
      endpoint: body.endpoint || existing?.endpoint,
      apiType: body.apiType || existing?.apiType || 'openai-compatible',
      models: body.models || existing?.models || [],
      verifiedAt: body.verifiedAt ?? existing?.verifiedAt ?? null,
      verifiedSourceUrl: body.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
      favorite: body.favorite ?? existing?.favorite ?? false,
      enabled: body.enabled ?? existing?.enabled ?? true,
    }
    data.providerChannels = [...data.providerChannels.filter((item) => item.id !== id), channel]
    withAudit(data, req, existing ? 'provider.update' : 'provider.create', 'local-admin', 'host-admin', { providerId: id })
    writeData(data)
    sendJson(res, 200, { ok: true, channel })
    return true
  }

  if (url.pathname === '/api/notices' && method === 'GET') {
    const notices = data.notices.filter((notice) => notice.enabled)
    sendJson(res, 200, { ok: true, notices, items: notices, allNotices: data.notices })
    return true
  }

  if (url.pathname === '/api/notices' && method === 'POST') {
    const body = await readJsonBody(req)
    const now = new Date().toISOString()
    const id = body.id || createId('notice')
    const existing = data.notices.find((item) => item.id === id)
    const notice = {
      id,
      kind: body.kind || existing?.kind || 'announcement',
      title: body.title || existing?.title || 'inscanvas notice',
      body: body.body || existing?.body || '',
      format: body.format || existing?.format || 'plain',
      audience: body.audience || existing?.audience || 'all',
      enabled: body.enabled ?? existing?.enabled ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }
    data.notices = [...data.notices.filter((item) => item.id !== id), notice]
    withAudit(data, req, existing ? 'notice.update' : 'notice.create', 'local-admin', 'host-admin', { noticeId: id })
    writeData(data)
    sendJson(res, 200, { ok: true, notice })
    return true
  }

  if (url.pathname === '/api/settings/site' && method === 'GET') {
    const settings = { ...data.siteSettings, disclaimerPolicy: data.disclaimerPolicy, rateLimitPolicies: data.rateLimitPolicies }
    sendJson(res, 200, { ok: true, ...settings, settings })
    return true
  }

  if (url.pathname === '/api/settings/site' && method === 'POST') {
    const body = await readJsonBody(req)
    data.siteSettings = { ...data.siteSettings, ...body }
    if (body.disclaimerPolicy) data.disclaimerPolicy = { ...data.disclaimerPolicy, ...body.disclaimerPolicy }
    if (Array.isArray(body.rateLimitPolicies)) data.rateLimitPolicies = body.rateLimitPolicies
    withAudit(data, req, 'settings.site.update', 'local-admin', 'host-admin')
    writeData(data)
    sendJson(res, 200, { ok: true, settings: data.siteSettings })
    return true
  }

  if (url.pathname === '/api/settings/personal' && method === 'GET') {
    sendJson(res, 200, { ok: true, ...data.personalSettings, settings: data.personalSettings })
    return true
  }

  if (url.pathname === '/api/settings/personal' && method === 'POST') {
    const body = await readJsonBody(req)
    data.personalSettings = { ...data.personalSettings, ...body }
    withAudit(data, req, 'settings.personal.update')
    writeData(data)
    sendJson(res, 200, { ok: true, settings: data.personalSettings })
    return true
  }

  if (url.pathname === '/api/works' && method === 'GET') {
    const ownerId = url.searchParams.get('ownerId') || 'guest-local'
    sendJson(res, 200, { ok: true, items: data.works.filter((work) => work.ownerId === ownerId), limit: 10 })
    return true
  }

  if (url.pathname === '/api/works' && method === 'POST') {
    const body = await readJsonBody(req)
    const ownerId = body.ownerId || 'guest-local'
    if (data.works.filter((work) => work.ownerId === ownerId).length >= 10) {
      sendJson(res, 409, { ok: false, error: 'Work limit reached (10).' })
      return true
    }
    const now = new Date().toISOString()
    const id = body.id || createId('work')
    const html = injectDisclaimer(body.html, req)
    const work = {
      id,
      ownerId,
      title: (body.title || 'Untitled work').slice(0, 50),
      description: (body.description || '').slice(0, 50),
      modeId: body.modeId || 'custom',
      status: body.status || 'draft',
      html,
      shareSlug: body.shareSlug || null,
      galleryStatus: body.galleryStatus || 'private',
      disclaimerInjectedAt: html ? now : null,
      createdAt: now,
      updatedAt: now,
      snapshots: [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: null, createdAt: now }],
    }
    data.works.push(work)
    withAudit(data, req, 'work.create', ownerId, ownerId === 'guest-local' ? 'guest' : 'user', { workId: id })
    writeData(data)
    sendJson(res, 200, { ok: true, work })
    return true
  }

  const workMatch = url.pathname.match(/^\/api\/works\/([^/]+)$/)
  if (workMatch) {
    const id = decodeURIComponent(workMatch[1])
    const index = data.works.findIndex((work) => work.id === id)
    if (method === 'GET') {
      if (index < 0) sendJson(res, 404, { ok: false, error: 'Work not found' })
      else sendJson(res, 200, { ok: true, work: data.works[index] })
      return true
    }
    if (method === 'PATCH') {
      if (index < 0) {
        sendJson(res, 404, { ok: false, error: 'Work not found' })
        return true
      }
      const body = await readJsonBody(req)
      const now = new Date().toISOString()
      const html = body.html ? injectDisclaimer(body.html, req) : data.works[index].html
      const snapshot = body.html || body.canvasData
        ? [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: null, createdAt: now }]
        : []
      data.works[index] = {
        ...data.works[index],
        ...body,
        title: body.title ? body.title.slice(0, 50) : data.works[index].title,
        description: body.description ? body.description.slice(0, 50) : data.works[index].description,
        html,
        disclaimerInjectedAt: body.html ? now : data.works[index].disclaimerInjectedAt,
        updatedAt: now,
        snapshots: [...data.works[index].snapshots, ...snapshot],
      }
      withAudit(data, req, 'work.update', data.works[index].ownerId, data.works[index].ownerId === 'guest-local' ? 'guest' : 'user', { workId: id })
      writeData(data)
      sendJson(res, 200, { ok: true, work: data.works[index] })
      return true
    }
    if (method === 'DELETE') {
      const work = data.works[index]
      data.works = data.works.filter((item) => item.id !== id)
      withAudit(data, req, 'work.delete', work?.ownerId || null, work?.ownerId === 'guest-local' ? 'guest' : 'user', { workId: id })
      writeData(data)
      sendJson(res, 200, { ok: true, id })
      return true
    }
  }

  const workflowMatch = url.pathname.match(/^\/api\/workflows\/(generate|refine|plan)$/)
  if (workflowMatch && method === 'POST') {
    const route = workflowMatch[1]
    const body = await readJsonBody(req)
    const now = new Date()
    const ownerId = body.ownerId || 'guest-local'
    const run = {
      id: createId(`workflow-${route}`),
      ownerId,
      modeId: body.modeId || body.context?.modeId || 'custom',
      executionMode: body.executionMode || (ownerId === 'guest-local' ? 'browser-local' : 'server-managed'),
      prompt: body.prompt || body.context?.prompt || '',
      context: body.context || { modeId: body.modeId || 'custom', prompt: body.prompt || '', carryPolicy: 'last-turn', currentCanvasLabels: [], includePreviousPrompt: true, includePreviousOutput: true, includePreviousScreenshot: false },
      status: 'queued',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }
    data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now())
    data.workflows.push(run)
    withAudit(data, req, `workflow.${route}`, ownerId, ownerId === 'guest-local' ? 'guest' : 'user', { workflowRunId: run.id })
    writeData(data)
    sendJson(res, 200, { ok: true, route, run })
    return true
  }

  return false
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

  if (method === 'OPTIONS' && (proxyPaths.has(url.pathname) || url.pathname.startsWith('/api/'))) {
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

  if (url.pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, url)
    if (!handled) sendJson(res, 404, { ok: false, error: 'API route not found' })
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
