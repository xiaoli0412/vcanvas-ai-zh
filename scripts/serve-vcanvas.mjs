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

function parseRequestUrl(req) {
  const rawUrl = req.url || '/'
  const safeUrl = rawUrl.startsWith('//') ? `/${rawUrl.replace(/^\/+/, '')}` : rawUrl
  const hostHeader = req.headers.host && /^[A-Za-z0-9.[\]:_-]+$/.test(req.headers.host)
    ? req.headers.host
    : `${host}:${port}`

  try {
    return new URL(safeUrl, `http://${hostHeader}`)
  } catch {
    return null
  }
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
  let relativePath
  try {
    relativePath = decodeURIComponent(urlPathname === '/' ? '/index.html' : urlPathname)
  } catch {
    return null
  }
  const resolved = path.resolve(staticDir, `.${relativePath}`)
  const insideStaticDir = resolved === staticDir || resolved.startsWith(staticDir + path.sep)
  if (!insideStaticDir) return null

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
      siteDescription: 'inscanvas keeps the drawing surface first while adding local public-server foundations.',
      publicBaseUrl: '',
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
      sharePolicy: { enabled: true, publicBaseUrl: '', pauseOnSecurityWarning: true },
      noticePolicy: { forceWarnings: true, allowMarkdown: true, allowImages: true },
      updatePolicy: { githubRepo: 'xiaoli0412/vcanvas-ai-zh', checkEnabled: true, lowTrafficAutoUpdate: false },
      migrationPolicy: { exportEnabled: true, requireVerification: true },
      opsPublicEnabled: false,
      dispatchPolicy: { enabled: false, strategy: 'round-robin-weighted', nodes: [] },
    },
    personalSettings: {
      userId: 'guest-local',
      displayName: 'Guest',
      avatarUrl: null,
      motto: '画布优先。',
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
      { id: 'phase-2-public-server', kind: 'announcement', title: 'inscanvas public server phase 2', body: 'inscanvas compact mode, local persistence, provider governance, and public-server contracts are active in this branch.', format: 'plain', audience: 'all', enabled: true, force: false, dismissible: true, imageUrl: null, expiresAt: null, createdAt: now0, updatedAt: now0 },
    ],
    works: [],
    workflows: [],
    sessions: [],
    users: [
      { id: 'local-admin', email: null, username: 'local-admin', tier: 'host-admin', profile: { displayName: 'inscanvas owner', avatarUrl: null, motto: '画布优先。', qq: null }, enabled: true, createdAt: now0, updatedAt: now0, lastLoginAt: null, lastLoginIp: null },
    ],
    quotaLedgers: [
      { userId: 'guest-local', tier: 'guest', premiumCredits: 0, baseCallsRemaining: 8, hostedRunsRemaining: 0, hostedRunsUsedToday: 0, resetAt: now0, hostedResetAt: now0 },
      { userId: 'local-admin', tier: 'host-admin', premiumCredits: 999999, baseCallsRemaining: 999999, hostedRunsRemaining: 999999, hostedRunsUsedToday: 0, resetAt: now0, hostedResetAt: now0 },
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
    siteSettings: {
      ...defaults.siteSettings,
      ...(data?.siteSettings || {}),
      sharePolicy: { ...defaults.siteSettings.sharePolicy, ...(data?.siteSettings?.sharePolicy || {}) },
      noticePolicy: { ...defaults.siteSettings.noticePolicy, ...(data?.siteSettings?.noticePolicy || {}) },
      updatePolicy: { ...defaults.siteSettings.updatePolicy, ...(data?.siteSettings?.updatePolicy || {}) },
      migrationPolicy: { ...defaults.siteSettings.migrationPolicy, ...(data?.siteSettings?.migrationPolicy || {}) },
      dispatchPolicy: { ...defaults.siteSettings.dispatchPolicy, ...(data?.siteSettings?.dispatchPolicy || {}) },
    },
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

function canManageUsers(tier) {
  return permissionsForTier(tier).includes('manage-users')
}

function canManageSecurity(tier) {
  const permissions = permissionsForTier(tier)
  return permissions.includes('manage-users') || permissions.includes('manage-site')
}

function normalizeIp(value) {
  return typeof value === 'string' ? value.trim().slice(0, 128) : ''
}

function canManageSecrets(tier) {
  return tier === 'host-admin' || tier === 'admin'
}

function maskProviderChannels(channels, actorTier, actorId) {
  return channels.map((channel) => {
    if (canManageSecrets(actorTier) || !channel.ownerId || channel.ownerId === actorId) return channel
    return {
      ...channel,
      endpoint: channel.endpoint ? '[hidden]' : channel.endpoint,
      apiKeyMasked: channel.apiKeyMasked ? '********' : channel.apiKeyMasked,
    }
  })
}

function userSummary(data, userId) {
  const ownedProviders = data.providerChannels.filter((provider) => provider.ownerId === userId)
  return {
    works: data.works.filter((work) => work.ownerId === userId).length,
    workflows: data.workflows.filter((workflow) => workflow.ownerId === userId).length,
    signIns: data.signInRecords.filter((record) => record.userId === userId).length,
    providerChannels: ownedProviders.length,
    maskedKeys: ownedProviders.filter((provider) => provider.apiKeyMasked).length,
  }
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
      motto: existing?.profile?.motto || '画布优先。',
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sendHtml(res, statusCode, html, head = false) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(head ? undefined : html)
}

function isShareExpired(link) {
  return Boolean(link?.expiresAt && Date.parse(link.expiresAt) <= Date.now())
}

function publicPageShell({ title, eyebrow = 'inscanvas', description = '', body, statusCode = 200 }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · inscanvas</title>
  <link rel="stylesheet" href="/fonts/noto-serif-sc.css" />
  <link rel="stylesheet" href="/fonts/fusion-pixel.css" />
  <style>
    :root{color-scheme:dark;--bg:#080d1c;--panel:rgba(11,16,36,.82);--panel-strong:rgba(17,24,49,.94);--line:rgba(142,162,255,.18);--text:#d8deed;--muted:#8d9ab6;--faint:#55627d;--accent:#8ea2ff;--warning:#f6c36a;--font-sans:"HarmonyOS Sans SC","HarmonyOS Sans","MiSans","PingFang SC","Microsoft YaHei",sans-serif;--font-serif:"Noto Serif SC Variable","Source Han Serif SC","Songti SC","STSong","SimSun",serif;--font-pixel:"Fusion Pixel 10px Monospaced SC","Noto Serif SC Variable","Source Han Serif SC",monospace;--font-mono:"JetBrains Mono","SF Mono","Cascadia Code",monospace}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--text);font-family:var(--font-sans);background:radial-gradient(circle at 12% 6%,rgba(89,103,180,.1),transparent 28rem),linear-gradient(135deg,#080d1c 0%,#0b1024 58%,#10172f 100%)}
    a{color:inherit;text-decoration:none}.page{width:min(1180px,calc(100vw - 32px));margin:0 auto;padding:24px 0 40px}.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:4px 0 14px;border-bottom:1px solid rgba(142,162,255,.14)}
    .eyebrow{color:var(--accent);font-family:var(--font-pixel);font-size:11px;font-weight:400;letter-spacing:.04em;text-transform:lowercase}h1{margin:0;font-family:var(--font-serif);font-size:clamp(30px,4.2vw,54px);font-weight:760;line-height:1.08;letter-spacing:-.02em}.hero p{max-width:420px;margin:0;color:var(--muted);font-size:13px;line-height:1.7;text-align:right}
    .notice{margin-top:16px;padding:10px 12px;border:1px solid rgba(246,195,106,.32);border-radius:14px;color:#ffe3ac;background:rgba(246,195,106,.1);font-size:12px}.gallery-feed{column-count:4;column-gap:14px;margin-top:16px}.card{break-inside:avoid;margin:0 0 14px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;padding:10px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.035),transparent 42%),var(--panel);transition:transform .18s ease,border-color .18s ease,background .18s ease}.card:nth-child(3n + 1) .cover{aspect-ratio:4/5}.card:nth-child(4n + 2) .cover{aspect-ratio:1/1}a.card:hover{transform:translateY(-2px);border-color:rgba(142,162,255,.42);background:var(--panel-strong)}
    .card h2{margin:6px 5px 0;font-family:var(--font-serif);font-size:clamp(19px,1.7vw,25px);line-height:1.28;letter-spacing:-.005em}.card p{margin:8px 5px 0;color:var(--muted);font-size:11px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.cover{position:relative;width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:14px;background:linear-gradient(135deg,rgba(142,162,255,.22),transparent 44%),linear-gradient(160deg,rgba(107,183,166,.13),rgba(8,13,28,.84))}.cover img{width:100%;height:100%;object-fit:cover;display:block}.cover:after{content:'';position:absolute;inset:0;border:1px solid rgba(255,255,255,.055);border-radius:inherit;pointer-events:none}.cover-fallback{height:100%;display:flex;align-items:flex-end;padding:12px;color:rgba(216,222,237,.54);font-family:var(--font-pixel);font-size:11px;letter-spacing:.03em}.meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 5px 2px;color:var(--faint);font-family:var(--font-sans);font-size:10px;letter-spacing:.02em}.pill{width:fit-content;margin:5px 5px 0;padding:4px 8px;border:1px solid rgba(142,162,255,.3);border-radius:999px;color:var(--accent);background:rgba(89,103,180,.12);font-size:10px}.empty{margin-top:20px;padding:24px;border:1px dashed rgba(142,162,255,.2);border-radius:16px;color:var(--muted);background:rgba(255,255,255,.035);font-size:13px}.footer{margin-top:28px;color:rgba(216,222,237,.42);font-size:12px}
    @media(max-width:560px){.page{width:min(100vw - 20px,1120px);padding-top:14px}.hero{display:grid;gap:8px;padding-bottom:14px}.hero p{text-align:left;font-size:12px}.gallery-feed{column-count:1}.card:nth-child(3n + 1) .cover,.card:nth-child(4n + 2) .cover{aspect-ratio:4/3}}@media(min-width:561px) and (max-width:900px){.gallery-feed{column-count:2}}@media(min-width:901px) and (max-width:1180px){.gallery-feed{column-count:3}}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1></div>${description ? `<p>${escapeHtml(description)}</p>` : ''}</section>
    ${body}
    <div class="footer">inscanvas · 作品流${statusCode !== 200 ? ` · status ${statusCode}` : ''}</div>
  </main>
</body>
</html>`
}

function renderPublicStatus(statusCode, title, description) {
  return publicPageShell({
    title,
    eyebrow: '分享状态',
    description,
    statusCode,
    body: `<div class="empty">${escapeHtml(description)}</div>`,
  })
}

function formatPublicDate(value) {
  if (!value) return '未知时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function formatGalleryStatus(status) {
  if (status === 'published') return '已发布'
  if (status === 'pending-review') return '待审核'
  if (status === 'rejected') return '已退回'
  return status
}

function latestPreview(work) {
  return [...(work.snapshots || [])].reverse().find((snapshot) => snapshot.previewImageUrl)?.previewImageUrl || null
}

function renderShareFallback(work) {
  return publicPageShell({
    title: work.title || '未命名作品',
    eyebrow: '分享作品',
    description: work.description || '这个分享作品已有元数据，但还没有保存可渲染的 HTML。',
    body: '<div class="empty">这个分享链接存在，但作品暂时没有可渲染的 HTML。请在作品中心重新保存或导入 HTML 后再分享。</div>',
  })
}

function renderGalleryPage(data) {
  const items = data.galleryEntries
    .filter((entry) => entry.status === 'published' || entry.status === 'pending-review')
    .map((entry) => ({
      entry,
      work: data.works.find((work) => work.id === entry.workId) || null,
      shareLink: data.shareLinks.find((link) => link.workId === entry.workId && link.enabled),
    }))
    .filter((item) => item.work)

  const cards = items.map(({ entry, work, shareLink }) => {
    const href = shareLink && !isShareExpired(shareLink) ? `/share/${encodeURIComponent(shareLink.slug)}` : null
    const preview = latestPreview(work)
    const content = `
      <div class="cover">
        ${preview ? `<img src="${escapeHtml(preview)}" alt="${escapeHtml(work.title || 'inscanvas work')}" loading="lazy" />` : '<div class="cover-fallback">inscanvas</div>'}
      </div>
      <div>
        <span class="pill">${escapeHtml(formatGalleryStatus(entry.status))}</span>
        <h2>${escapeHtml(work.title || '未命名作品')}</h2>
        ${work.description ? `<p>${escapeHtml(work.description)}</p>` : ''}
      </div>
      <div class="meta"><span>${escapeHtml(formatPublicDate(entry.submittedAt))}</span><span>${href ? '打开作品' : '未分享'}</span></div>`
    return href ? `<a class="card" href="${href}">${content}</a>` : `<article class="card" aria-disabled="true">${content}</article>`
  }).join('')

  const disabledNotice = data.siteSettings.publicGalleryEnabled === false
    ? '<div class="notice">公开展示暂未开放。</div>'
    : ''

  return publicPageShell({
    title: '鉴赏厅',
    eyebrow: 'inscanvas feed',
    body: `${disabledNotice}${cards ? `<section class="gallery-feed">${cards}</section>` : '<div class="empty">还没有作品。</div>'}`,
  })
}

function handlePublicPages(req, res, url) {
  const data = readData()
  const head = req.method === 'HEAD'
  const shareMatch = url.pathname.match(/^\/share\/([^/]+)$/)
  if (shareMatch) {
    if (data.siteSettings.sharePolicy?.enabled === false) {
      sendHtml(res, 403, renderPublicStatus(403, '分享已暂停', '站点当前已暂停公开分享入口。'), head)
      return true
    }
    const slug = decodeURIComponent(shareMatch[1])
    const link = data.shareLinks.find((item) => item.slug === slug && item.enabled)
    if (isShareExpired(link)) {
      sendHtml(res, 410, renderPublicStatus(410, '分享已过期', '这个分享链接已经过期，请让作者重新生成分享链接。'), head)
      return true
    }
    const work = link ? data.works.find((item) => item.id === link.workId) : null
    if (!work) {
      sendHtml(res, 404, renderPublicStatus(404, '没有找到分享作品', '这个分享链接不存在、已关闭，或对应作品已被删除。'), head)
      return true
    }
    sendHtml(res, 200, work.html?.trim() ? work.html : renderShareFallback(work), head)
    return true
  }

  if (url.pathname === '/gallery') {
    sendHtml(res, 200, renderGalleryPage(data), head)
    return true
  }

  return false
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

function dispatchSnapshot(data) {
  const policy = data.siteSettings.dispatchPolicy || { enabled: false, strategy: 'round-robin-weighted', nodes: [] }
  const nodes = (policy.nodes || [])
    .filter((node) => node.enabled !== false && node.url)
    .map((node) => ({ ...node, weight: Math.max(1, Number(node.weight) || 1) }))
  if (!policy.enabled || nodes.length === 0) {
    return {
      strategy: 'round-robin-weighted',
      selectedNode: null,
      nodes,
      message: 'Dispatch is a planned-only balancing contract. Configure dispatchPolicy.nodes to preview multi-server routing.',
      plannedOnly: true,
      fallbackReason: policy.enabled ? 'no-enabled-dispatch-nodes' : 'dispatch-disabled',
    }
  }
  const sortedNodes = [...nodes].sort((a, b) => ((a.currentLoad || 0) / a.weight) - ((b.currentLoad || 0) / b.weight))
  const expanded = sortedNodes.flatMap((node) => Array.from({ length: node.weight }, () => node))
  const selectedNode = expanded[Math.floor(Date.now() / 1000) % expanded.length] || nodes[0]
  return {
    strategy: 'round-robin-weighted',
    selectedNode,
    nodes,
    message: 'Planned-only dispatch preview selected a candidate node. Real queue execution can attach here later.',
    plannedOnly: true,
    fallbackReason: null,
  }
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
    dispatch: dispatchSnapshot(data),
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
        'User-Agent': 'inscanvas Public Server Remix Fetcher',
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
          headers: { 'User-Agent': 'inscanvas Public Server Remix Fetcher' },
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

  if (url.pathname === '/api/session/register' && method === 'POST') {
    if (data.siteSettings.registrationEnabled === false) {
      sendJson(res, 403, { ok: false, error: 'inscanvas registration is temporarily closed by site settings.' })
      return true
    }
    const body = await readJsonBody(req)
    const tier = normalizeTier(body.tier || 'user')
    const userId = body.userId || body.username || `user-${Date.now()}`
    const session = makeSession({ userId, tier, executionMode: tier === 'guest' ? 'browser-local' : 'server-managed', req })
    const user = upsertUser(data, { id: userId, username: body.username || userId, email: body.email || null, tier, displayName: body.displayName || 'inscanvas user', ip: clientIp(req) })
    data.sessions = [...data.sessions.filter((item) => item.userId !== session.userId), session]
    data.signInRecords.push({ id: createId('signin'), userId, tier, ip: clientIp(req), userAgent: req.headers['user-agent'] || '', createdAt: new Date().toISOString() })
    withAudit(data, req, 'session.register', userId, tier)
    writeData(data)
    sendJson(res, 200, {
      ok: true,
      executionMode: session.executionMode,
      user: { id: userId, tier, displayName: user.profile.displayName, permissions: permissionsForTier(tier) },
      session,
      quota: data.quotaLedgers.find((ledger) => ledger.userId === userId) || null,
      note: 'Local/mock inscanvas registration is active until the newapi bridge is attached.',
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

  if (url.pathname === '/api/users' && method === 'GET') {
    const actor = getActor(data, req)
    if (!canManageUsers(actor.tier)) {
      sendJson(res, 403, { ok: false, error: 'Only host-admin/admin can manage inscanvas users.' })
      return true
    }
    const users = data.users.map((user) => ({
      ...user,
      summary: userSummary(data, user.id),
      providerKeyVisibility: user.id === actor.id || actor.tier === 'host-admin' ? 'masked-own-or-host-admin' : 'masked-admin-view',
    }))
    sendJson(res, 200, {
      ok: true,
      users,
      actor: { id: actor.id, tier: actor.tier },
      note: 'Provider keys are never returned in clear text from this local/mock user-management surface.',
    })
    return true
  }

  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/)
  if (userMatch && method === 'PATCH') {
    const actor = getActor(data, req)
    if (!canManageUsers(actor.tier)) {
      sendJson(res, 403, { ok: false, error: 'Only host-admin/admin can manage inscanvas users.' })
      return true
    }
    const id = decodeURIComponent(userMatch[1])
    const index = data.users.findIndex((user) => user.id === id)
    if (index < 0) {
      sendJson(res, 404, { ok: false, error: 'User not found.' })
      return true
    }
    const body = await readJsonBody(req)
    const current = data.users[index]
    const tier = body.tier ? normalizeTier(body.tier) : current.tier
    const now = new Date().toISOString()
    const next = {
      ...current,
      tier,
      enabled: body.enabled ?? current.enabled,
      profile: {
        ...current.profile,
        displayName: body.displayName ?? current.profile.displayName,
        motto: body.motto ?? current.profile.motto,
        qq: body.qq ?? current.profile.qq,
        avatarUrl: body.avatarUrl ?? current.profile.avatarUrl,
      },
      updatedAt: now,
    }
    data.users[index] = next
    const ledger = data.quotaLedgers.find((item) => item.userId === id)
    if (ledger) ledger.tier = tier
    data.sessions = data.sessions.map((session) => session.userId === id ? { ...session, tier } : session)
    withAudit(data, req, 'users.update', actor.id, actor.tier, { userId: id, tier, enabled: next.enabled })
    writeData(data)
    sendJson(res, 200, { ok: true, user: next })
    return true
  }

  if (url.pathname === '/api/security/blocked-ips' && method === 'GET') {
    const actor = getActor(data, req)
    if (!canManageSecurity(actor.tier)) {
      sendJson(res, 403, { ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return true
    }
    sendJson(res, 200, { ok: true, blockedIps: data.blockedIps, actor: { id: actor.id, tier: actor.tier } })
    return true
  }

  if (url.pathname === '/api/security/blocked-ips' && method === 'POST') {
    const actor = getActor(data, req)
    if (!canManageSecurity(actor.tier)) {
      sendJson(res, 403, { ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return true
    }
    const body = await readJsonBody(req)
    const ip = normalizeIp(body.ip)
    if (!ip) {
      sendJson(res, 400, { ok: false, error: 'IP is required.' })
      return true
    }
    const requestIp = clientIp(req)
    if (requestIp && ip === requestIp) {
      sendJson(res, 400, { ok: false, error: 'Refusing to block the current request IP in local/mock mode.' })
      return true
    }
    const now = Date.now()
    const expiresAt = typeof body.expiresInHours === 'number' && body.expiresInHours > 0
      ? new Date(now + body.expiresInHours * 60 * 60 * 1000).toISOString()
      : null
    const blockedIp = {
      ip,
      reason: String(body.reason || 'manual admin block').trim().slice(0, 240),
      blockedAt: new Date(now).toISOString(),
      expiresAt,
      createdBy: actor.id,
    }
    data.blockedIps = [...data.blockedIps.filter((item) => item.ip !== ip), blockedIp]
    withAudit(data, req, 'security.ip.block', actor.id, actor.tier, { ip, reason: blockedIp.reason, expiresAt })
    writeData(data)
    sendJson(res, 200, { ok: true, blockedIp })
    return true
  }

  const blockedIpMatch = url.pathname.match(/^\/api\/security\/blocked-ips\/([^/]+)$/)
  if (blockedIpMatch && method === 'DELETE') {
    const actor = getActor(data, req)
    if (!canManageSecurity(actor.tier)) {
      sendJson(res, 403, { ok: false, error: 'Only host-admin/admin can manage inscanvas security controls.' })
      return true
    }
    const ip = normalizeIp(decodeURIComponent(blockedIpMatch[1]))
    const before = data.blockedIps.length
    data.blockedIps = data.blockedIps.filter((item) => item.ip !== ip)
    const removed = before - data.blockedIps.length
    withAudit(data, req, 'security.ip.unblock', actor.id, actor.tier, { ip, removed })
    writeData(data)
    sendJson(res, 200, { ok: true, removed })
    return true
  }

  if (url.pathname === '/api/providers' && method === 'GET') {
    const actor = getActor(data, req)
    sendJson(res, 200, {
      ok: true,
      channels: maskProviderChannels(data.providerChannels, actor.tier, actor.id),
      actor: { id: actor.id, tier: actor.tier },
      note: 'Model rows are persisted locally and should be verified before becoming built-ins.',
    })
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
      force: body.force ?? existing?.force ?? body.kind === 'warning',
      dismissible: body.dismissible ?? existing?.dismissible ?? body.kind !== 'warning',
      imageUrl: body.imageUrl ?? existing?.imageUrl ?? null,
      expiresAt: body.expiresAt ?? existing?.expiresAt ?? null,
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
    const actor = getActor(data, req)
    const ownerId = url.searchParams.get('ownerId') || actor.id
    const items = data.works.filter((work) => work.ownerId === ownerId)
    sendJson(res, 200, {
      ok: true,
      items,
      limit: data.siteSettings.workLimitPerOwner || 10,
      shareLinks: data.shareLinks.filter((link) => items.some((work) => work.id === link.workId)),
    })
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
      title: (body.title || '未命名作品').slice(0, 50),
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
      snapshots: [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: body.previewImageUrl || null, createdAt: now }],
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
      title: (body.title || '导入 HTML').slice(0, 50),
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
      snapshots: [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: body.previewImageUrl || null, createdAt: now }],
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
        ? [{ id: createId('snapshot'), workId: id, html, canvasData: body.canvasData, previewImageUrl: body.previewImageUrl || null, createdAt: now }]
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
      data.shareLinks = data.shareLinks.filter((item) => item.workId !== id)
      data.galleryEntries = data.galleryEntries.filter((item) => item.workId !== id)
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

  if (url.pathname === '/api/dispatch/status' && method === 'GET') {
    sendJson(res, 200, { ok: true, dispatch: dispatchSnapshot(data) })
    return true
  }

  if (url.pathname === '/api/dispatch/route' && method === 'POST') {
    sendJson(res, 200, { ok: true, dispatch: dispatchSnapshot(data) })
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
  const url = parseRequestUrl(req)

  if (!url) {
    sendJson(res, 400, { ok: false, error: 'Invalid request URL' })
    return
  }

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

  if ((method === 'GET' || method === 'HEAD') && handlePublicPages(req, res, url)) {
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
  console.log(`inscanvas server listening on http://${host}:${port}`)
})
