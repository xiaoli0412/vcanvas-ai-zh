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
      registrationEnabled: true,
      serverExecutionDefault: false,
      publicGalleryEnabled: false,
      experimentalFeaturesEnabled: true,
      securityMode: 'normal',
      workLimitPerOwner: 10,
      galleryPublishLimits: { 'host-admin': null, admin: null, vip: 9, user: 6, guest: 0 },
      highLoadDegradeThreshold: 0.9,
      longDisclaimer: 'inscanvas is a creative canvas platform. Public works and shared exports are user-directed content and must be reviewed by the creator before publication.',
    },
    personalSettings: {
      userId: 'guest-local',
      displayName: 'Guest',
      avatarUrl: null,
      motto: 'Canvas first.',
      preferredModeId: 'custom',
      favoriteModelKeys: [],
      experimental: { serverHighResourceHosting: false },
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
    users: [
      { id: 'local-admin', email: null, username: 'local-admin', tier: 'host-admin', profile: { displayName: 'inscanvas owner', avatarUrl: null, motto: 'Canvas first.', qq: null }, enabled: true, createdAt: now0, updatedAt: now0, lastLoginAt: null, lastLoginIp: null },
    ],
    quotaLedgers: [
      { userId: 'guest-local', tier: 'guest', premiumCredits: 0, baseCallsRemaining: 8, hostedRunsRemaining: 0, resetAt: now0, hostedResetAt: now0 },
      { userId: 'local-admin', tier: 'host-admin', premiumCredits: 999999, baseCallsRemaining: 999999, hostedRunsRemaining: 999999, resetAt: now0, hostedResetAt: now0 },
    ],
    redeemCodes: [],
    blockedIps: [],
    rateLimitEvents: [],
    signInRecords: [],
    shareLinks: [],
    galleryEntries: [],
    auditEvents: [],
  }
}

function mergeData(data) {
  const defaults = defaultData()
  const mergeById = (a, b) => {
    const map = new Map()
    for (const item of a || []) map.set(item.id, item)
    for (const item of b || []) map.set(item.id, { ...(map.get(item.id) || {}), ...item })
    return [...map.values()]
  }
  const mergeByKey = (a, b, getKey) => {
    const map = new Map()
    for (const item of a || []) map.set(getKey(item), item)
    for (const item of b || []) {
      const key = getKey(item)
      map.set(key, { ...(map.get(key) || {}), ...item })
    }
    return [...map.values()]
  }
  return {
    ...defaults,
    ...(data || {}),
    siteSettings: { ...defaults.siteSettings, ...(data?.siteSettings || {}) },
    personalSettings: {
      ...defaults.personalSettings,
      ...(data?.personalSettings || {}),
      experimental: { ...defaults.personalSettings.experimental, ...(data?.personalSettings?.experimental || {}) },
    },
    disclaimerPolicy: { ...defaults.disclaimerPolicy, ...(data?.disclaimerPolicy || {}) },
    providerChannels: mergeById(defaults.providerChannels, data?.providerChannels),
    notices: data?.notices?.length ? data.notices : defaults.notices,
    rateLimitPolicies: data?.rateLimitPolicies?.length ? data.rateLimitPolicies : defaults.rateLimitPolicies,
    users: mergeById(defaults.users, data?.users),
    quotaLedgers: mergeByKey(defaults.quotaLedgers, data?.quotaLedgers, (item) => item.userId),
    redeemCodes: data?.redeemCodes || [],
    blockedIps: data?.blockedIps || [],
    rateLimitEvents: data?.rateLimitEvents || [],
    signInRecords: data?.signInRecords || [],
    shareLinks: data?.shareLinks || [],
    galleryEntries: data?.galleryEntries || [],
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

function normalizeTier(value) {
  return ['host-admin', 'admin', 'vip', 'user', 'guest'].includes(value) ? value : 'user'
}

function permissionsForTier(tier) {
  if (tier === 'host-admin') return ['manage-site', 'manage-users', 'manage-models', 'manage-gallery', 'use-server-execution', 'publish-gallery', 'manage-own-works']
  if (tier === 'admin') return ['manage-users', 'manage-models', 'manage-gallery', 'use-server-execution', 'publish-gallery', 'manage-own-works']
  if (tier === 'vip' || tier === 'user') return ['use-server-execution', 'publish-gallery', 'manage-own-works']
  return ['manage-own-works']
}

function getActor(data, req) {
  const now = Date.now()
  const sessionId = typeof req.headers['x-vcanvas-session-id'] === 'string' ? req.headers['x-vcanvas-session-id'] : ''
  const userId = typeof req.headers['x-vcanvas-user-id'] === 'string' ? req.headers['x-vcanvas-user-id'] : ''
  const sessions = (data.sessions || [])
    .filter((item) => Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))
  const session = sessions.find((item) => item.id === sessionId)
    || sessions.find((item) => userId && item.userId === userId)
    || sessions[0]
    || null
  if (!session) return { id: 'guest-local', tier: 'guest', displayName: 'Guest', session: null }
  const user = (data.users || []).find((item) => item.id === session.userId)
  return { id: session.userId, tier: session.tier, displayName: user?.profile?.displayName || 'inscanvas user', session }
}

function ensureQuotaLedger(data, userId, tier) {
  let ledger = data.quotaLedgers.find((item) => item.userId === userId)
  if (ledger) {
    ledger.tier = tier
    return ledger
  }
  const now = Date.now()
  ledger = {
    userId,
    tier,
    premiumCredits: tier === 'guest' ? 0 : 100,
    baseCallsRemaining: tier === 'guest' ? 8 : 20,
    hostedRunsRemaining: tier === 'vip' || tier === 'user' ? 2 : tier === 'guest' ? 0 : 999999,
    resetAt: new Date(now + 86400000).toISOString(),
    hostedResetAt: new Date(now + 86400000).toISOString(),
  }
  data.quotaLedgers.push(ledger)
  return ledger
}

function upsertUser(data, input) {
  const now = new Date().toISOString()
  const existing = data.users.find((item) => item.id === input.id)
  const user = {
    id: input.id,
    email: input.email ?? existing?.email ?? null,
    username: input.username || existing?.username || input.id,
    tier: input.tier,
    profile: {
      displayName: input.displayName || existing?.profile?.displayName || 'inscanvas user',
      avatarUrl: existing?.profile?.avatarUrl || null,
      motto: existing?.profile?.motto || 'Canvas first.',
      qq: existing?.profile?.qq || null,
    },
    enabled: existing?.enabled ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: now,
    lastLoginIp: input.ip || null,
  }
  data.users = [...data.users.filter((item) => item.id !== input.id), user]
  ensureQuotaLedger(data, input.id, input.tier)
  return user
}

function makeSession(input) {
  const now = new Date()
  return {
    id: createId('session'),
    userId: input.userId,
    tier: input.tier,
    executionMode: input.executionMode || (input.tier === 'guest' ? 'browser-local' : 'server-managed'),
    lastActiveAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    ip: input.ip || null,
    userAgent: input.userAgent || null,
  }
}

function buildDisclaimerComment(data, req, action) {
  return `Generated with inscanvas | action=${action} | ip=${clientIp(req) || 'unknown'} | time=${new Date().toISOString()} | ${data.disclaimerPolicy.shortText}`
}

function injectDisclaimer(html, req, data = { disclaimerPolicy: { shortText: 'Generated with inscanvas.' } }, action = 'save') {
  if (!html || html.includes('Generated with inscanvas')) return html
  const note = `<!-- ${buildDisclaimerComment(data, req, action).replace(/--/g, '- -')} -->`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${note}\n</body>`)
  return `${note}\n${html}`
}

function galleryLimit(data, tier) {
  const configured = data.siteSettings.galleryPublishLimits?.[tier]
  if (configured === null) return Infinity
  if (typeof configured === 'number') return configured
  if (tier === 'host-admin' || tier === 'admin') return Infinity
  if (tier === 'vip') return 9
  if (tier === 'user') return 6
  return 0
}

function cleanupData(data) {
  const now = Date.now()
  const before = {
    workflows: data.workflows.length,
    rateLimitEvents: data.rateLimitEvents.length,
    blockedIps: data.blockedIps.length,
    sessions: data.sessions.length,
  }
  data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > now)
  data.rateLimitEvents = data.rateLimitEvents.filter((item) => Date.parse(item.createdAt) > now - 48 * 60 * 60 * 1000)
  data.blockedIps = data.blockedIps.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > now)
  data.sessions = data.sessions.filter((item) => Date.parse(item.expiresAt) > now)
  return {
    workflows: before.workflows - data.workflows.length,
    rateLimitEvents: before.rateLimitEvents - data.rateLimitEvents.length,
    blockedIps: before.blockedIps - data.blockedIps.length,
    sessions: before.sessions - data.sessions.length,
  }
}

function opsSnapshot(data) {
  return {
    takenAt: new Date().toISOString(),
    counts: {
      users: data.users.length,
      sessions: data.sessions.length,
      workflows: data.workflows.length,
      works: data.works.length,
      shareLinks: data.shareLinks.length,
      galleryEntries: data.galleryEntries.length,
      rateLimitEvents: data.rateLimitEvents.length,
      blockedIps: data.blockedIps.length,
    },
    hostingPolicy: {
      defaultExecutionMode: data.siteSettings.securityMode === 'limited' ? 'browser-local' : 'server-managed',
      resourceHeavyModeDefault: 'browser-local',
      serverHighResourceHostingEnabled: data.personalSettings.experimental?.serverHighResourceHosting === true,
      dailyHostedLimit: 2,
      fallbackReason: data.siteSettings.securityMode === 'limited' ? 'server-high-load-degrade-after-current-task' : null,
    },
    storage: { adapter: 'local-json', retentionHours: 24 },
    highLoadMode: data.siteSettings.securityMode === 'limited',
  }
}

function isMeteredRoute(method, route) {
  if (!['POST', 'PATCH', 'DELETE'].includes(method)) return false
  return /^\/api\/workflows\//.test(route)
    || route === '/api/remix/fetch'
    || route === '/api/assets/import'
    || route === '/api/works'
    || /^\/api\/works\/[^/]+\/(share|gallery-submit)$/.test(route)
}

function enforceTrafficGuard(data, req, url) {
  const ip = clientIp(req)
  const now = Date.now()
  const blocked = ip ? data.blockedIps.find((item) => item.ip === ip && (!item.expiresAt || Date.parse(item.expiresAt) > now)) : null
  if (blocked) return { ok: false, statusCode: 403, error: `IP blocked: ${blocked.reason}` }
  if (!isMeteredRoute(req.method || 'GET', url.pathname)) return { ok: true }

  const actor = getActor(data, req)
  if (actor.tier === 'host-admin' || actor.tier === 'admin') return { ok: true }
  const policy = actor.tier === 'guest'
    ? data.rateLimitPolicies.find((item) => item.id === 'guest-ip-daily')
    : data.rateLimitPolicies.find((item) => item.id === 'user-hourly-basic')
  if (!policy?.enabled) return { ok: true }
  const subjectType = actor.tier === 'guest' ? 'ip' : 'user'
  const subject = actor.tier === 'guest' ? (ip || 'unknown-ip') : actor.id
  const cutoff = now - policy.windowSeconds * 1000
  data.rateLimitEvents = data.rateLimitEvents.filter((event) => Date.parse(event.createdAt) > now - 48 * 60 * 60 * 1000)
  const count = data.rateLimitEvents.filter((event) => event.subject === subject && event.subjectType === subjectType && Date.parse(event.createdAt) >= cutoff).length
  if (count >= policy.maxRequests) {
    if (policy.lockoutSeconds && ip) {
      data.blockedIps.push({ ip, reason: `rate limit ${policy.id}`, blockedAt: new Date().toISOString(), expiresAt: new Date(now + policy.lockoutSeconds * 1000).toISOString(), createdBy: 'system' })
    }
    return { ok: false, statusCode: 429, error: `Rate limit exceeded (${policy.maxRequests}/${policy.windowSeconds}s).` }
  }
  data.rateLimitEvents.push({ id: createId('rate'), subject, subjectType, route: url.pathname, tier: actor.tier, ip, createdAt: new Date().toISOString() })
  return { ok: true }
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
  const guard = enforceTrafficGuard(data, req, url)
  if (!guard.ok) {
    writeData(data)
    sendJson(res, guard.statusCode || 429, { ok: false, error: guard.error })
    return true
  }

  if (url.pathname === '/api/session/me' && method === 'GET') {
    const now = Date.now()
    const session = data.sessions
      .filter((item) => Date.parse(item.expiresAt) > now)
      .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))[0] || null
    if (session) {
      session.lastActiveAt = new Date().toISOString()
      session.expiresAt = new Date(now + 8 * 60 * 60 * 1000).toISOString()
      writeData(data)
    }
    const user = session ? data.users.find((item) => item.id === session.userId) : null
    sendJson(res, 200, {
      ok: true,
      executionMode: session?.executionMode || 'browser-local',
      user: {
        id: session?.userId || 'guest-local',
        tier: session?.tier || 'guest',
        displayName: user?.profile?.displayName || 'Guest',
        permissions: permissionsForTier(session?.tier || 'guest'),
      },
      session,
      quota: data.quotaLedgers.find((ledger) => ledger.userId === (session?.userId || 'guest-local')) || null,
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
    const tier = isGuest ? 'guest' : normalizeTier(body.tier)
    const userId = isGuest ? 'guest-local' : (body.userId || body.username || 'mock-user')
    const session = makeSession({
      userId,
      tier,
      executionMode: isGuest ? 'browser-local' : 'server-managed',
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || null,
    })
    const user = isGuest ? null : upsertUser(data, { id: userId, username: body.username || userId, email: body.email || null, tier, displayName: body.displayName || 'inscanvas user', ip: clientIp(req) })
    data.sessions = [...data.sessions.filter((item) => item.userId !== session.userId), session]
    data.signInRecords.push({ id: createId('signin'), userId, tier, ip: clientIp(req), userAgent: req.headers['user-agent'] || null, createdAt: new Date().toISOString() })
    withAudit(data, req, isGuest ? 'session.guest' : 'session.login', session.userId, session.tier)
    writeData(data)
    sendJson(res, 200, {
      ok: true,
      executionMode: session.executionMode,
      user: { id: session.userId, tier: session.tier, displayName: user?.profile?.displayName || 'Guest', permissions: permissionsForTier(session.tier) },
      session,
      quota: data.quotaLedgers.find((ledger) => ledger.userId === session.userId) || null,
    })
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
    if (Array.isArray(body.batchCapabilities)) {
      for (const patch of body.batchCapabilities) {
        const channel = data.providerChannels.find((item) => item.id === patch.providerId)
        if (!channel) continue
        const existing = channel.models.find((model) => model.id === patch.modelId)
        const next = {
          id: patch.modelId,
          label: patch.capability?.label || existing?.label || patch.modelId,
          source: patch.capability?.source || existing?.source || 'manual',
          vision: patch.capability?.vision ?? existing?.vision ?? false,
          video: patch.capability?.video ?? existing?.video ?? false,
          toolCalling: patch.capability?.toolCalling ?? existing?.toolCalling ?? false,
          contextWindow: patch.capability?.contextWindow ?? existing?.contextWindow,
          favorite: patch.capability?.favorite ?? existing?.favorite ?? false,
          verifiedAt: patch.capability?.verifiedAt ?? existing?.verifiedAt ?? null,
          verifiedSourceUrl: patch.capability?.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
          serverSide: patch.capability?.serverSide ?? existing?.serverSide ?? true,
        }
        channel.models = [...channel.models.filter((model) => model.id !== patch.modelId), next]
        channel.favoriteModelIds = next.favorite
          ? [...new Set([...(channel.favoriteModelIds || []), next.id])]
          : (channel.favoriteModelIds || []).filter((id) => id !== next.id)
      }
      withAudit(data, req, 'provider.batchCapabilities.update', 'local-user', 'user', { count: body.batchCapabilities.length })
      writeData(data)
      sendJson(res, 200, { ok: true, channels: data.providerChannels })
      return true
    }
    const id = body.id || createId('provider')
    const existing = data.providerChannels.find((item) => item.id === id)
    const channel = {
      id,
      label: body.label || existing?.label || id,
      endpoint: body.endpoint || existing?.endpoint,
      apiType: body.apiType || existing?.apiType || 'openai-compatible',
      models: body.models || existing?.models || [],
      ownerId: body.ownerId ?? existing?.ownerId ?? getActor(data, req).id,
      apiKeyMasked: body.apiKeyMasked ?? existing?.apiKeyMasked ?? null,
      verifiedAt: body.verifiedAt ?? existing?.verifiedAt ?? null,
      verifiedSourceUrl: body.verifiedSourceUrl ?? existing?.verifiedSourceUrl ?? null,
      verificationMethod: body.verificationMethod ?? existing?.verificationMethod ?? null,
      favoriteModelIds: body.favoriteModelIds ?? existing?.favoriteModelIds ?? [],
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

  if (url.pathname === '/api/settings/site' && (method === 'POST' || method === 'PATCH')) {
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

  if (url.pathname === '/api/settings/personal' && (method === 'POST' || method === 'PATCH')) {
    const body = await readJsonBody(req)
    data.personalSettings = {
      ...data.personalSettings,
      ...body,
      experimental: { ...data.personalSettings.experimental, ...(body.experimental || {}) },
    }
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
    const actor = getActor(data, req)
    const ownerId = body.ownerId || actor.id
    const limit = data.siteSettings.workLimitPerOwner || 10
    if (data.works.filter((work) => work.ownerId === ownerId).length >= limit) {
      sendJson(res, 409, { ok: false, error: `Work limit reached (${limit}).` })
      return true
    }
    const now = new Date().toISOString()
    const id = body.id || createId('work')
    const html = injectDisclaimer(body.html, req, data, 'save')
    const disclaimerComment = buildDisclaimerComment(data, req, 'save')
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
      exportMetadata: { exportedAt: null, includesFlowMap: false, disclaimerComment },
      disclaimerInjectedAt: html ? now : null,
      createdAt: now,
      updatedAt: now,
      snapshots: [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: null, createdAt: now }],
    }
    data.works.push(work)
    withAudit(data, req, 'work.create', ownerId, actor.tier, { workId: id })
    writeData(data)
    sendJson(res, 200, { ok: true, work })
    return true
  }

  if (url.pathname === '/api/works/import-html' && method === 'POST') {
    const body = await readJsonBody(req)
    if (!body.html?.trim()) {
      sendJson(res, 400, { ok: false, error: 'Missing HTML content.' })
      return true
    }
    const actor = getActor(data, req)
    const ownerId = body.ownerId || actor.id
    const limit = data.siteSettings.workLimitPerOwner || 10
    if (data.works.filter((work) => work.ownerId === ownerId).length >= limit) {
      sendJson(res, 409, { ok: false, error: `Work limit reached (${limit}).` })
      return true
    }
    const now = new Date().toISOString()
    const id = body.id || createId('work')
    const html = injectDisclaimer(body.html, req, data, 'save')
    const disclaimerComment = buildDisclaimerComment(data, req, 'save')
    const work = {
      id,
      ownerId,
      title: (body.title || 'Imported HTML').slice(0, 50),
      description: (body.description || '').slice(0, 50),
      modeId: body.modeId || 'custom',
      status: 'saved',
      html,
      shareSlug: null,
      galleryStatus: 'private',
      exportMetadata: { exportedAt: null, includesFlowMap: false, disclaimerComment },
      disclaimerInjectedAt: now,
      createdAt: now,
      updatedAt: now,
      snapshots: [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: null, createdAt: now }],
    }
    data.works.push(work)
    withAudit(data, req, 'work.importHtml', ownerId, actor.tier, { workId: id })
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
      const html = body.html ? injectDisclaimer(body.html, req, data, 'save') : data.works[index].html
      const disclaimerComment = body.html ? buildDisclaimerComment(data, req, 'save') : data.works[index].exportMetadata?.disclaimerComment
      const snapshot = body.html || body.canvasData
        ? [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: null, createdAt: now }]
        : []
      data.works[index] = {
        ...data.works[index],
        ...body,
        title: body.title ? body.title.slice(0, 50) : data.works[index].title,
        description: body.description ? body.description.slice(0, 50) : data.works[index].description,
        html,
        exportMetadata: { ...data.works[index].exportMetadata, ...body.exportMetadata, disclaimerComment },
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

  const shareMatch = url.pathname.match(/^\/api\/works\/([^/]+)\/share$/)
  if (shareMatch && method === 'POST') {
    const id = decodeURIComponent(shareMatch[1])
    const work = data.works.find((item) => item.id === id)
    if (!work) {
      sendJson(res, 404, { ok: false, error: 'Work not found' })
      return true
    }
    const actor = getActor(data, req)
    const now = new Date().toISOString()
    const slug = work.shareSlug || `${id}-${Math.random().toString(36).slice(2, 7)}`
    const disclaimerComment = buildDisclaimerComment(data, req, 'share')
    work.shareSlug = slug
    work.html = injectDisclaimer(work.html, req, data, 'share')
    work.exportMetadata = { ...work.exportMetadata, exportedAt: now, disclaimerComment }
    work.updatedAt = now
    const link = { id: createId('share'), workId: id, ownerId: work.ownerId, slug, enabled: true, createdAt: now, expiresAt: null, disclaimerComment }
    data.shareLinks = [...data.shareLinks.filter((item) => item.workId !== id), link]
    withAudit(data, req, 'work.share', actor.id, actor.tier, { workId: id, slug })
    writeData(data)
    sendJson(res, 200, { ok: true, work, link })
    return true
  }

  const gallerySubmitMatch = url.pathname.match(/^\/api\/works\/([^/]+)\/gallery-submit$/)
  if (gallerySubmitMatch && method === 'POST') {
    const id = decodeURIComponent(gallerySubmitMatch[1])
    const work = data.works.find((item) => item.id === id)
    if (!work) {
      sendJson(res, 404, { ok: false, error: 'Work not found' })
      return true
    }
    const actor = getActor(data, req)
    const limit = galleryLimit(data, actor.tier)
    const count = data.galleryEntries.filter((entry) => entry.ownerId === actor.id && entry.status !== 'rejected').length
    if (limit <= 0 || count >= limit) {
      sendJson(res, 403, { ok: false, error: limit <= 0 ? 'This tier cannot publish to gallery.' : `Gallery publish limit reached (${limit}).`, limit })
      return true
    }
    const now = new Date().toISOString()
    const entry = { id: createId('gallery'), workId: id, ownerId: work.ownerId, status: 'pending-review', submittedAt: now, reviewedAt: null, reviewerId: null, rejectionReason: null }
    work.galleryStatus = 'pending-review'
    data.galleryEntries = [...data.galleryEntries.filter((item) => item.workId !== id), entry]
    withAudit(data, req, 'work.gallerySubmit', actor.id, actor.tier, { workId: id, galleryEntryId: entry.id })
    writeData(data)
    sendJson(res, 200, { ok: true, entry, work, limit })
    return true
  }

  if (url.pathname === '/api/gallery' && method === 'GET') {
    const entries = data.galleryEntries
      .filter((entry) => entry.status === 'published' || entry.status === 'pending-review')
      .map((entry) => ({ ...entry, work: data.works.find((work) => work.id === entry.workId) || null }))
    sendJson(res, 200, { ok: true, enabled: data.siteSettings.publicGalleryEnabled, entries, items: entries })
    return true
  }

  const workflowMatch = url.pathname.match(/^\/api\/workflows\/(generate|refine|plan)$/)
  if (workflowMatch && method === 'POST') {
    const route = workflowMatch[1]
    const body = await readJsonBody(req)
    const now = new Date()
    const actor = getActor(data, req)
    const ownerId = body.ownerId || actor.id
    const modeId = body.modeId || body.context?.modeId || 'custom'
    const heavy = modeId === 'video' || modeId === 'web-copy'
    const ledger = ensureQuotaLedger(data, ownerId, actor.tier)
    const heavyHosted = data.personalSettings.experimental?.serverHighResourceHosting === true && (ledger.hostedRunsRemaining || 0) > 0
    const executionMode = body.executionMode || (actor.tier === 'guest' ? 'browser-local' : (heavy && !heavyHosted ? 'browser-local' : (data.siteSettings.securityMode === 'limited' ? 'browser-local' : 'server-managed')))
    if (heavy && executionMode === 'server-managed' && typeof ledger.hostedRunsRemaining === 'number') {
      ledger.hostedRunsRemaining = Math.max(0, ledger.hostedRunsRemaining - 1)
    }
    const run = {
      id: createId(`workflow-${route}`),
      ownerId,
      modeId,
      executionMode,
      prompt: body.prompt || body.context?.prompt || '',
      context: body.context || { modeId: body.modeId || 'custom', prompt: body.prompt || '', carryPolicy: 'last-turn', currentCanvasLabels: [], includePreviousPrompt: true, includePreviousOutput: true, includePreviousScreenshot: false },
      status: 'queued',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }
    data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now())
    data.workflows.push(run)
    const hostingPolicy = { defaultExecutionMode: executionMode, resourceHeavyModeDefault: heavy ? executionMode : 'server-managed', serverHighResourceHostingEnabled: data.personalSettings.experimental?.serverHighResourceHosting === true, dailyHostedLimit: ledger.hostedRunsRemaining || 0, fallbackReason: executionMode === 'browser-local' && heavy ? 'high-resource-hosting-disabled-or-quota-exhausted' : null }
    withAudit(data, req, `workflow.${route}`, ownerId, actor.tier, { workflowRunId: run.id, hostingPolicy })
    writeData(data)
    sendJson(res, 200, { ok: true, route, run, hostingPolicy })
    return true
  }

  if (url.pathname === '/api/quotas/sign-in' && method === 'GET') {
    const actor = getActor(data, req)
    sendJson(res, 200, { ok: true, ledger: data.quotaLedgers.find((ledger) => ledger.userId === actor.id) || null, records: data.signInRecords.filter((record) => record.userId === actor.id).slice(-7) })
    return true
  }

  if (url.pathname === '/api/quotas/sign-in' && method === 'POST') {
    const actor = getActor(data, req)
    const ledger = ensureQuotaLedger(data, actor.id, actor.tier)
    ledger.baseCallsRemaining += actor.tier === 'guest' ? 1 : 3
    if (actor.tier === 'vip' || actor.tier === 'user') ledger.hostedRunsRemaining = Math.min(2, (ledger.hostedRunsRemaining || 0) + 1)
    const record = { id: createId('signin'), userId: actor.id, tier: actor.tier, ip: clientIp(req), userAgent: req.headers['user-agent'] || null, createdAt: new Date().toISOString() }
    data.signInRecords.push(record)
    withAudit(data, req, 'quota.signIn', actor.id, actor.tier)
    writeData(data)
    sendJson(res, 200, { ok: true, ledger, record })
    return true
  }

  if (url.pathname === '/api/quotas/redeem' && method === 'GET') {
    const actor = getActor(data, req)
    sendJson(res, 200, {
      ok: true,
      ledger: data.quotaLedgers.find((ledger) => ledger.userId === actor.id) || null,
      redeemCodes: data.redeemCodes.map((code) => ({ ...code, code: code.code.replace(/.(?=.{4})/g, '*') })),
    })
    return true
  }

  if (url.pathname === '/api/quotas/redeem' && method === 'POST') {
    const body = await readJsonBody(req)
    const actor = getActor(data, req)
    const code = data.redeemCodes.find((item) => item.code === body.code && (item.enabled ?? true))
    if (!code || Date.parse(code.expiresAt) < Date.now() || code.redeemedCount >= code.maxRedemptions || code.redeemedBy?.includes(actor.id)) {
      sendJson(res, 400, { ok: false, error: 'Redeem code unavailable.' })
      return true
    }
    const ledger = ensureQuotaLedger(data, actor.id, actor.tier)
    ledger.premiumCredits += code.premiumCredits || 0
    if (code.tierUpgrade) {
      ledger.tier = code.tierUpgrade
      const user = data.users.find((item) => item.id === actor.id)
      if (user) user.tier = code.tierUpgrade
    }
    code.redeemedCount += 1
    code.redeemedBy = [...(code.redeemedBy || []), actor.id]
    withAudit(data, req, 'quota.redeem', actor.id, actor.tier, { redeemCodeId: code.id })
    writeData(data)
    sendJson(res, 200, { ok: true, ledger })
    return true
  }

  if (url.pathname === '/api/ops/status' && method === 'GET') {
    sendJson(res, 200, { ok: true, snapshot: opsSnapshot(data) })
    return true
  }

  if (url.pathname === '/api/maintenance/cleanup' && method === 'POST') {
    const actor = getActor(data, req)
    const removed = cleanupData(data)
    withAudit(data, req, 'maintenance.cleanup', actor.id, actor.tier, removed)
    writeData(data)
    sendJson(res, 200, { ok: true, removed, snapshot: opsSnapshot(data) })
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
