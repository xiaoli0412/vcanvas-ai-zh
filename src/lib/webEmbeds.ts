import type { WebEmbedReference } from '../../shared/contracts/publicServer'

export type { WebEmbedReference }

export function normalizeWebEmbedUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('webEmbed.error.missingUrl')
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('webEmbed.error.invalidUrl')
  }
  return url.toString()
}

export function createWebEmbedReference(input: {
  url: string
  title?: string
  frameId?: string | null
}): WebEmbedReference {
  const url = normalizeWebEmbedUrl(input.url)
  const host = new URL(url).hostname.replace(/^www\./, '')
  const now = new Date().toISOString()
  return {
    id: `web-embed-${Date.now()}`,
    url,
    title: input.title?.trim() || host,
    frameId: input.frameId || null,
    status: 'idle',
    error: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateWebEmbedUrl(embed: WebEmbedReference, urlValue: string): WebEmbedReference {
  const url = normalizeWebEmbedUrl(urlValue)
  const host = new URL(url).hostname.replace(/^www\./, '')
  return {
    ...embed,
    url,
    title: host,
    status: 'idle',
    error: null,
    updatedAt: new Date().toISOString(),
  }
}

export function buildWebEmbedContextNotes(embeds: WebEmbedReference[]) {
  if (!embeds.length) return ''

  return [
    '## Web Embed References',
    'The user placed these URLs as web embed references on the canvas. Use them as layout/content context, but do not assume iframe rendering is always allowed.',
    ...embeds.map((embed, index) =>
      `Embed ${index + 1}: ${embed.title} — ${embed.url} — status=${embed.status}`,
    ),
  ].join('\n')
}
