import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { SiteSettings, UpdateCheckResult } from '../../shared/contracts/publicServer'

const DEFAULT_REPO = 'xiaoli0412/vcanvas-ai-zh'

function currentPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: string }
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function normalizeRepo(value?: string | null) {
  const raw = (value || DEFAULT_REPO).trim()
  try {
    const parsed = raw.match(/^https?:\/\//i) ? new URL(raw) : null
    if (parsed && /(^|\.)github\.com$/i.test(parsed.hostname)) {
      const [owner, repo] = parsed.pathname.split('/').filter(Boolean)
      if (owner && repo) return `${owner}/${repo.replace(/\.git$/i, '')}`
    }
  } catch {
    // Fall back to the permissive text parser below.
  }
  const cleaned = raw.replace(/[#?].*$/, '').replace(/\/+$/, '').replace(/\.git$/i, '')
  const match = cleaned.match(/github\.com[:/]+([^/\s]+)\/([^/\s#?]+)$/i)
    || cleaned.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (!match) return DEFAULT_REPO
  return `${match[1]}/${match[2].replace(/\.git$/i, '')}`
}

function parseVersion(value?: string | null) {
  const normalized = (value || '').trim().replace(/^v/i, '')
  const parts = normalized.split(/[^\d]+/).filter(Boolean).slice(0, 3).map((part) => Number(part))
  if (parts.length === 0 || parts.some((part) => !Number.isFinite(part))) return null
  while (parts.length < 3) parts.push(0)
  return parts
}

function compareVersions(current: string, latest?: string | null): UpdateCheckResult['comparison'] {
  const currentParts = parseVersion(current)
  const latestParts = parseVersion(latest)
  if (!currentParts || !latestParts) return 'unknown'
  for (let index = 0; index < 3; index += 1) {
    if (latestParts[index] > currentParts[index]) return 'newer'
    if (latestParts[index] < currentParts[index]) return 'older'
  }
  return 'current'
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'inscanvas-update-check',
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function checkGithubReleaseUpdate(settings: SiteSettings): Promise<UpdateCheckResult> {
  const checkedAt = new Date().toISOString()
  const currentVersion = currentPackageVersion()
  const repo = normalizeRepo(settings.updatePolicy?.githubRepo)
  if (settings.updatePolicy?.checkEnabled === false) {
    return {
      checkedAt,
      source: 'disabled',
      repo,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      comparison: 'unknown',
      release: null,
      error: 'GitHub update checks are disabled by site settings.',
    }
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`GitHub releases responded ${response.status}`)
    const release = await response.json() as {
      tag_name?: string
      name?: string | null
      html_url?: string
      published_at?: string | null
      prerelease?: boolean
      draft?: boolean
    }
    const latestVersion = release.tag_name || null
    const comparison = compareVersions(currentVersion, latestVersion)
    return {
      checkedAt,
      source: 'github-releases',
      repo,
      currentVersion,
      latestVersion,
      updateAvailable: comparison === 'newer',
      comparison,
      release: latestVersion ? {
        tagName: latestVersion,
        name: release.name || null,
        url: release.html_url || `https://github.com/${repo}/releases`,
        publishedAt: release.published_at || null,
        prerelease: Boolean(release.prerelease),
        draft: Boolean(release.draft),
      } : null,
      error: null,
    }
  } catch (err) {
    return {
      checkedAt,
      source: 'error',
      repo,
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      comparison: 'unknown',
      release: null,
      error: err instanceof Error ? err.message : 'Unable to check GitHub releases.',
    }
  }
}
