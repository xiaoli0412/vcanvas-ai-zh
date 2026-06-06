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
  <link rel="stylesheet" href="/fonts/noto-serif-sc.css" />
  <link rel="stylesheet" href="/fonts/fusion-pixel.css" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #080d1c;
      --panel: rgba(11, 16, 36, 0.82);
      --panel-strong: rgba(17, 24, 49, 0.94);
      --line: rgba(142, 162, 255, 0.18);
      --text: #d8deed;
      --muted: #8d9ab6;
      --faint: #55627d;
      --accent: #8ea2ff;
      --cyan: #6bb7d6;
      --warning: #f6c36a;
      --font-sans: "HarmonyOS Sans SC", "HarmonyOS Sans", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --font-serif: "Noto Serif SC Variable", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
      --font-pixel: "Fusion Pixel 10px Monospaced SC", "Noto Serif SC Variable", "Source Han Serif SC", monospace;
      --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: var(--font-sans);
      background:
        radial-gradient(circle at 12% 6%, rgba(89, 103, 180, 0.1), transparent 28rem),
        linear-gradient(135deg, #080d1c 0%, #0b1024 58%, #10172f 100%);
    }
    a { color: inherit; text-decoration: none; }
    .page {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 24px 0 40px;
    }
    .hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding: 4px 0 14px;
      border-bottom: 1px solid rgba(142, 162, 255, 0.14);
    }
    .eyebrow {
      color: var(--accent);
      font-family: var(--font-pixel);
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.04em;
      text-transform: lowercase;
    }
    h1 {
      margin: 0;
      font-family: var(--font-serif);
      font-size: clamp(30px, 4.2vw, 54px);
      font-weight: 760;
      line-height: 1.08;
      letter-spacing: -0.02em;
    }
    .hero p {
      max-width: 420px;
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.7;
      text-align: right;
    }
    .notice {
      margin-top: 16px;
      padding: 10px 12px;
      border: 1px solid rgba(246, 195, 106, 0.32);
      border-radius: 14px;
      color: #ffe3ac;
      background: rgba(246, 195, 106, 0.1);
      font-size: 12px;
    }
    .gallery-feed {
      column-count: 4;
      column-gap: 14px;
      margin-top: 18px;
    }
    .card {
      break-inside: avoid;
      margin: 0 0 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 42%),
        var(--panel);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
    }
    .card:nth-child(3n + 1) .cover { aspect-ratio: 4 / 5; }
    .card:nth-child(4n + 2) .cover { aspect-ratio: 1 / 1; }
    a.card:hover {
      transform: translateY(-2px);
      border-color: rgba(142, 162, 255, 0.42);
      background: var(--panel-strong);
    }
    .card h2 {
      margin: 6px 5px 0;
      font-family: var(--font-serif);
      font-size: clamp(19px, 1.7vw, 25px);
      line-height: 1.28;
      letter-spacing: -0.005em;
    }
    .card p {
      margin: 8px 5px 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.55;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .cover {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border-radius: 14px;
      background:
        linear-gradient(135deg, rgba(142, 162, 255, 0.22), transparent 44%),
        linear-gradient(160deg, rgba(107, 183, 166, 0.13), rgba(8, 13, 28, 0.84));
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .cover::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px solid rgba(255, 255, 255, 0.055);
      border-radius: inherit;
      pointer-events: none;
    }
    .cover-fallback {
      height: 100%;
      display: flex;
      align-items: flex-end;
      padding: 12px;
      color: rgba(216, 222, 237, 0.54);
      font-family: var(--font-pixel);
      font-size: 11px;
      letter-spacing: 0.03em;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 5px 2px;
      color: var(--faint);
      font-family: var(--font-sans);
      font-size: 10px;
      letter-spacing: 0.02em;
    }
    .pill {
      width: fit-content;
      margin: 5px 5px 0;
      padding: 4px 8px;
      border: 1px solid rgba(142, 162, 255, 0.3);
      border-radius: 999px;
      color: var(--accent);
      background: rgba(89, 103, 180, 0.12);
      font-size: 10px;
    }
    .empty {
      margin-top: 20px;
      padding: 24px;
      border: 1px dashed rgba(142, 162, 255, 0.2);
      border-radius: 16px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.035);
      font-size: 13px;
    }
    .footer {
      margin-top: 28px;
      color: rgba(245, 241, 255, 0.42);
      font-size: 12px;
    }
    @media (max-width: 560px) {
      .page { width: min(100vw - 20px, 1120px); padding-top: 14px; }
      .hero { display: grid; gap: 8px; padding-bottom: 14px; }
      .hero p { text-align: left; font-size: 12px; }
      .gallery-feed { column-count: 1; }
      .card:nth-child(3n + 1) .cover,
      .card:nth-child(4n + 2) .cover { aspect-ratio: 4 / 3; }
    }
    @media (min-width: 561px) and (max-width: 900px) {
      .gallery-feed { column-count: 2; }
    }
    @media (min-width: 901px) and (max-width: 1180px) {
      .gallery-feed { column-count: 3; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <div class="eyebrow">${escapeHtml(input.eyebrow || 'inscanvas')}</div>
        <h1>${escapeHtml(input.title)}</h1>
      </div>
      ${input.description ? `<p>${escapeHtml(input.description)}</p>` : ''}
    </section>
    ${input.body}
    <div class="footer">inscanvas · 作品流${input.statusCode && input.statusCode !== 200 ? ` · status ${input.statusCode}` : ''}</div>
  </main>
</body>
</html>`
}

function renderShareFallback(work: WorkRecord) {
  return publicPageShell({
    title: work.title || '未命名作品',
    eyebrow: '分享作品',
    description: work.description || '这个分享作品已有元数据，但还没有保存可渲染的 HTML。',
    body: `<div class="empty">这个分享链接存在，但作品暂时没有可渲染的 HTML。请在作品中心重新保存或导入 HTML 后再分享。</div>`,
  })
}

function renderStatusPage(statusCode: number, title: string, description: string) {
  return publicPageShell({
    title,
    eyebrow: '分享状态',
    description,
    statusCode,
    body: `<div class="empty">${escapeHtml(description)}</div>`,
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未知时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function formatGalleryStatus(status: string) {
  if (status === 'published') return '已发布'
  if (status === 'pending-review') return '待审核'
  if (status === 'rejected') return '已退回'
  return status
}

function latestPreview(work: WorkRecord) {
  return [...(work.snapshots || [])].reverse().find((snapshot) => snapshot.previewImageUrl)?.previewImageUrl || null
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
      <div class="meta">
        <span>${escapeHtml(formatDate(entry.submittedAt))}</span>
        <span>${href ? '打开作品' : '未分享'}</span>
      </div>`
    return href
      ? `<a class="card" href="${href}">${content}</a>`
      : `<article class="card" aria-disabled="true">${content}</article>`
  }).join('')

  const disabledNotice = data.siteSettings.publicGalleryEnabled === false
    ? `<div class="notice">公开展示暂未开放。</div>`
    : ''

  return publicPageShell({
    title: '鉴赏厅',
    eyebrow: 'inscanvas feed',
    body: `${disabledNotice}${cards ? `<section class="gallery-feed">${cards}</section>` : '<div class="empty">还没有作品。</div>'}`,
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
