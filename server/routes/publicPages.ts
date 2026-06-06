import type { FastifyInstance } from 'fastify'
import { localDataStore, type PublicServerData } from '../data/localDataStore'
import type { GalleryEntry, ShareLink, WorkRecord } from '../../shared/contracts/publicServer'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isExpired(link: ShareLink) {
  return Boolean(link.expiresAt && Date.parse(link.expiresAt) <= Date.now())
}

function findActiveShare(data: PublicServerData, slug: string) {
  const link = data.shareLinks.find((item) => item.slug === slug && item.enabled)
  if (!link || isExpired(link)) return { link, work: null, expired: Boolean(link && isExpired(link)) }
  return {
    link,
    work: data.works.find((item) => item.id === link.workId) || null,
    expired: false,
  }
}

function shareHref(link: ShareLink | undefined) {
  if (!link || !link.enabled || isExpired(link)) return null
  return `/share/${encodeURIComponent(link.slug)}`
}

function publicPageShell(input: {
  title: string
  eyebrow?: string
  description?: string
  body: string
  statusCode?: number
}) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} · inscanvas</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #090b18;
      --panel: rgba(20, 22, 45, 0.72);
      --panel-strong: rgba(32, 31, 61, 0.9);
      --line: rgba(190, 179, 255, 0.18);
      --text: #f5f1ff;
      --muted: rgba(245, 241, 255, 0.64);
      --accent: #9d8cff;
      --cyan: #79e0ff;
      --warning: #f6c36a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: "LXGW WenKai Screen", "Noto Serif SC", "Microsoft YaHei", serif;
      background:
        radial-gradient(circle at 10% 8%, rgba(111, 92, 255, 0.34), transparent 28rem),
        radial-gradient(circle at 86% 12%, rgba(57, 181, 255, 0.18), transparent 24rem),
        linear-gradient(135deg, #070812 0%, #10122a 52%, #17122d 100%);
    }
    a { color: inherit; text-decoration: none; }
    .page {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 42px 0 56px;
    }
    .hero {
      display: grid;
      gap: 12px;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(22, 24, 51, 0.84), rgba(11, 13, 30, 0.58));
      box-shadow: 0 24px 90px rgba(0, 0, 0, 0.42);
      overflow: hidden;
      position: relative;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -12% -42% 52%;
      height: 220px;
      background: radial-gradient(circle, rgba(157, 140, 255, 0.24), transparent 68%);
      pointer-events: none;
    }
    .eyebrow {
      color: var(--cyan);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    h1 {
      max-width: 780px;
      margin: 0;
      font-size: clamp(34px, 5vw, 66px);
      line-height: 0.96;
      letter-spacing: -0.055em;
    }
    .hero p {
      max-width: 720px;
      margin: 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.8;
    }
    .notice {
      margin-top: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(246, 195, 106, 0.32);
      border-radius: 18px;
      color: #ffe3ac;
      background: rgba(246, 195, 106, 0.1);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      margin-top: 22px;
    }
    .card {
      min-height: 210px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
        var(--panel);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    }
    a.card:hover {
      transform: translateY(-3px);
      border-color: rgba(157, 140, 255, 0.52);
      background:
        linear-gradient(145deg, rgba(157, 140, 255, 0.15), rgba(121, 224, 255, 0.045)),
        var(--panel-strong);
    }
    .card h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
      letter-spacing: -0.025em;
    }
    .card p {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: rgba(245, 241, 255, 0.58);
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .pill {
      width: fit-content;
      padding: 6px 10px;
      border: 1px solid rgba(157, 140, 255, 0.32);
      border-radius: 999px;
      color: #dcd3ff;
      background: rgba(157, 140, 255, 0.12);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .empty {
      margin-top: 20px;
      padding: 30px;
      border: 1px dashed rgba(245, 241, 255, 0.18);
      border-radius: 24px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.035);
    }
    .footer {
      margin-top: 28px;
      color: rgba(245, 241, 255, 0.42);
      font-size: 12px;
    }
    @media (max-width: 560px) {
      .page { width: min(100vw - 20px, 1120px); padding-top: 14px; }
      .hero { padding: 20px; border-radius: 22px; }
      .grid { grid-template-columns: 1fr; }
      .card { min-height: 180px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">${escapeHtml(input.eyebrow || 'inscanvas public server')}</div>
      <h1>${escapeHtml(input.title)}</h1>
      ${input.description ? `<p>${escapeHtml(input.description)}</p>` : ''}
    </section>
    ${input.body}
    <div class="footer">inscanvas · public-server local/mock route · status ${input.statusCode || 200}</div>
  </main>
</body>
</html>`
}

function renderShareFallback(work: WorkRecord) {
  return publicPageShell({
    title: work.title || 'Untitled work',
    eyebrow: 'Shared work',
    description: work.description || 'This shared work has metadata but no saved HTML payload yet.',
    body: `<div class="empty">这个分享链接存在，但作品暂时没有可渲染的 HTML。请在 Works Center 中重新保存或导入 HTML 后再分享。</div>`,
  })
}

function renderStatusPage(statusCode: number, title: string, description: string) {
  return publicPageShell({
    title,
    eyebrow: 'inscanvas share',
    description,
    statusCode,
    body: `<div class="empty">${escapeHtml(description)}</div>`,
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'unknown time'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function renderGalleryPage(data: PublicServerData) {
  const visibleEntries = data.galleryEntries
    .filter((entry) => entry.status === 'published' || entry.status === 'pending-review')
    .map((entry) => ({
      entry,
      work: data.works.find((work) => work.id === entry.workId) || null,
      shareLink: data.shareLinks.find((link) => link.workId === entry.workId && link.enabled),
    }))
    .filter((item): item is { entry: GalleryEntry; work: WorkRecord; shareLink: ShareLink | undefined } => Boolean(item.work))

  const cards = visibleEntries.map(({ entry, work, shareLink }) => {
    const href = shareHref(shareLink)
    const content = `
      <div>
        <span class="pill">${escapeHtml(entry.status)}</span>
        <h2>${escapeHtml(work.title || 'Untitled work')}</h2>
        <p>${escapeHtml(work.description || '作者还没有写简介，但画布已经在这里等你打开。')}</p>
      </div>
      <div class="meta">
        <span>${escapeHtml(work.modeId)}</span>
        <span>${escapeHtml(formatDate(entry.submittedAt))}</span>
        <span>${href ? 'open share' : 'not shared yet'}</span>
      </div>`
    return href
      ? `<a class="card" href="${href}">${content}</a>`
      : `<article class="card" aria-disabled="true">${content}</article>`
  }).join('')

  const disabledNotice = data.siteSettings.publicGalleryEnabled === false
    ? `<div class="notice">公开鉴赏厅当前处于站点关闭状态；本页仍展示 local/mock 阶段的可见队列，方便管理员验收分享与审核链路。</div>`
    : ''

  return publicPageShell({
    title: 'inscanvas 鉴赏厅',
    eyebrow: 'Gallery front desk',
    description: '这里展示已经提交审核或公开发布的作品。它是独立前台，不会挤压创作画布，也不会把设置入口暴露给访问者。',
    body: `${disabledNotice}${cards ? `<section class="grid">${cards}</section>` : '<div class="empty">还没有可展示的作品。先在 Works Center 保存 HTML、创建分享链接，再提交鉴赏厅。</div>'}`,
  })
}

export async function registerPublicPageRoutes(app: FastifyInstance) {
  app.get('/share/:slug', async (request, reply) => {
    const slug = decodeURIComponent((request.params as { slug: string }).slug)
    const data = await localDataStore.read()
    if (data.siteSettings.sharePolicy?.enabled === false) {
      return reply.code(403).type('text/html').send(renderStatusPage(403, '分享已暂停', '站点当前已暂停公开分享入口。'))
    }
    const { work, expired } = findActiveShare(data, slug)
    if (expired) {
      return reply.code(410).type('text/html').send(renderStatusPage(410, '分享已过期', '这个分享链接已经过期，请让作者重新生成分享链接。'))
    }
    if (!work) {
      return reply.code(404).type('text/html').send(renderStatusPage(404, '没有找到分享作品', '这个分享链接不存在、已关闭，或对应作品已被删除。'))
    }
    return reply.type('text/html').send(work.html?.trim() ? work.html : renderShareFallback(work))
  })

  app.get('/gallery', async (_request, reply) => {
    const data = await localDataStore.read()
    return reply.type('text/html').send(renderGalleryPage(data))
  })
}
