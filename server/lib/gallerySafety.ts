import type { GallerySafetyReview, WorkRecord } from '../../shared/contracts/publicServer'

const BLOCK_RULES = [
  { code: 'secret-like-token', pattern: /\b(sk-[a-z0-9_-]{12,}|api[_\s-]?key|private\s+key|bearer\s+[a-z0-9._-]{12,})\b/i },
  { code: 'credential-collection', pattern: /\b(phishing|credential\s+harvesting|steal\s+password|password\s+collector)\b/i },
  { code: 'browser-data-access', pattern: /\b(document\.cookie|localStorage\.getItem|sessionStorage\.getItem)\b/i },
]

const REVIEW_RULES = [
  { code: 'active-script', pattern: /<script\b|eval\s*\(|new\s+Function\s*\(/i },
  { code: 'external-frame-or-script', pattern: /<iframe\b|<script[^>]+src=["']?https?:\/\//i },
  { code: 'external-network-call', pattern: /\bfetch\s*\(\s*["']https?:\/\/|XMLHttpRequest|navigator\.sendBeacon/i },
  { code: 'payment-or-wallet-copy', pattern: /\b(payment|wallet|checkout|credit\s+card|银行卡|支付|钱包)\b/i },
]

function workText(work: WorkRecord | null | undefined) {
  return [work?.title, work?.description, work?.html]
    .filter(Boolean)
    .join('\n')
    .slice(0, 240_000)
}

export function buildGallerySafetyReview(work: WorkRecord | null | undefined, checkedAt = new Date().toISOString()): GallerySafetyReview {
  const text = workText(work)
  const blockedReasons = BLOCK_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.code)
  const reviewReasons = REVIEW_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.code)
  const reasons = [...new Set([...blockedReasons, ...reviewReasons])]
  const status = blockedReasons.length > 0
    ? 'blocked'
    : (reviewReasons.length > 0 ? 'needs-review' : 'passed')
  return {
    status,
    checkedAt,
    checker: 'local-policy-v1',
    riskScore: Math.min(100, blockedReasons.length * 35 + reviewReasons.length * 15),
    reasons,
    notes: status === 'passed' ? 'No local policy flags found.' : null,
  }
}
