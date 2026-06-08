import type {
  PlatformCapabilityMaturity,
  PlatformCapabilityStatus,
  PlatformReadinessSnapshot,
} from '../../shared/contracts/publicServer'
import type { PublicServerData } from '../data/localDataStore'

function status(input: PlatformCapabilityStatus): PlatformCapabilityStatus {
  return input
}

function scoreFor(maturity: PlatformCapabilityMaturity) {
  if (maturity === 'production') return 1
  if (maturity === 'local-mock') return 0.55
  if (maturity === 'contract-only') return 0.25
  return 0
}

export function makePlatformReadinessSnapshot(data: PublicServerData): PlatformReadinessSnapshot {
  const capabilities: PlatformCapabilityStatus[] = [
    status({
      id: 'auth-newapi-bridge',
      domain: 'auth',
      title: 'newapi account bridge',
      maturity: 'local-mock',
      summary: 'Five-tier identities exist locally, but production login, email, wallet, and role source still need the newapi bridge.',
      implemented: [
        'host-admin/admin/vip/user/guest contracts',
        '8h local session expiry',
        'guest browser-local session',
        'explicit session header contract without ambient latest-session fallback',
        'IP and user-agent audit payloads',
      ],
      gaps: [
        'real newapi registration/login/email',
        'signed session token or cookie',
        'QQ avatar sync',
        'wallet and payment security zone',
      ],
      nextStep: 'Attach a NewApiBridge adapter and remove all local/mock role assignment from production mode.',
    }),
    status({
      id: 'security-guardrails',
      domain: 'security',
      title: 'security and secret guardrails',
      maturity: 'local-mock',
      summary: 'Traffic guard, blocked IPs, secret masking, and local AES-GCM provider-key custody exist; production key vault/KMS custody is still pending.',
      implemented: [
        'basic rate-limit policies',
        'manual IP block/unblock',
        'admin-only user guardrail view',
        'share/export disclaimer comments',
        'local provider key encryption before JSON persistence',
        'provider channel write permissions for owners/admins',
      ],
      gaps: [
        'production key vault or KMS adapter',
        'HTML safety review model',
        'injection/leak audit pass',
        'tier downgrade and emergency lock UI',
      ],
      nextStep: 'Replace local fallback key material with a production key vault adapter before enabling server-managed provider execution by default.',
    }),
    status({
      id: 'model-governance',
      domain: 'models',
      title: 'model and provider governance',
      maturity: data.providerChannels.some((channel) => channel.models.length > 0) ? 'local-mock' : 'contract-only',
      summary: 'Provider channels are modeled, searchable, and editable, but latest model capability data is not yet verified automatically.',
      implemented: [
        'Compatible OpenAI first',
        'ChatGPT/Kimi/provider channel entries',
        'manual model capability badges',
        'batch capability editing',
      ],
      gaps: [
        'official/latest model registry',
        'Asterbot-style capability detection',
        'capability confidence refresh schedule',
        'site-level main/vision/video/compression/safety model pool',
      ],
      nextStep: 'Create a ModelRegistry service that combines official-doc verification, live /models fetches, and manual overrides.',
    }),
    status({
      id: 'workflow-server-managed',
      domain: 'workflows',
      title: 'server-managed workflow execution',
      maturity: 'contract-only',
      summary: 'Workflow records and hosting policy exist, but model execution still runs from the browser path for most generation flows.',
      implemented: [
        'generate/refine/plan workflow run records',
        'WorkflowService boundary for retention, hosting policy, context compression, and execution plan',
        '24h retention metadata',
        'hosting policy calculation',
        'video/web-copy high-resource gate',
        'metadata-only asset import route for image/video/html intake audits',
      ],
      gaps: [
        'server-side model execution worker',
        'background queue and recovery',
        'quota deduction per model',
        'context compression worker',
      ],
      nextStep: 'Move Generate/Refine/Plan through a WorkflowService that can execute or delegate model calls server-side.',
    }),
    status({
      id: 'works-gallery-share',
      domain: 'works',
      title: 'works, sharing, and gallery',
      maturity: 'local-mock',
      summary: 'Works can be saved, imported, shared, submitted to the gallery, and reviewed by local/mock admins.',
      implemented: [
        'works CRUD and 10-work limit',
        'HTML import/export',
        'share links and /share/:slug',
        'Xiaohongshu-style /gallery feed shell',
        'admin gallery review workflow',
      ],
      gaps: [
        'safety review model before publishing',
        'flow-map export',
        '24h task resume UI',
      ],
      nextStep: 'Attach a safety-review model and public share rendering hardening before production publishing.',
    }),
    status({
      id: 'notice-system',
      domain: 'notices',
      title: 'announcement, realtime notice, and warning system',
      maturity: 'local-mock',
      summary: 'Notice storage and forced warning overlays exist, but permissions and rich-content sanitization need hardening.',
      implemented: [
        'announcement/realtime/warning types',
        'force and dismissible flags',
        'main app overlay',
        'admin creation UI in control center',
      ],
      gaps: [
        'markdown/image sanitization',
        'per-user warning targets',
        'subapi-style location/device enrichment',
      ],
      nextStep: 'Add a NoticePolicy service with sanitized markdown rendering and targeted warning delivery.',
    }),
    status({
      id: 'ops-dispatch',
      domain: 'ops',
      title: 'ops, cleanup, and dispatch',
      maturity: 'contract-only',
      summary: 'Local ops counts and planned-only dispatch are visible; real resource telemetry and distributed queueing are not active.',
      implemented: [
        'ops snapshot',
        'cleanup endpoint',
        'planned weighted dispatch preview',
        'high-load fallback metadata',
      ],
      gaps: [
        'CPU/memory/disk/bandwidth telemetry',
        'email alerts',
        'restart automation',
        'multi-node job execution',
      ],
      nextStep: 'Attach a HostMetrics adapter and keep dispatch planned-only until a queue backend exists.',
    }),
    status({
      id: 'update-migration',
      domain: 'migration',
      title: 'update and migration',
      maturity: 'local-mock',
      summary: 'Read-only GitHub release checks and local-json data portability exist; automated update, rollback, and encrypted migration are not production-ready.',
      implemented: [
        'GitHub repo setting',
        'read-only GitHub release check',
        'migration policy fields',
        'local-json export/import manifest',
      ],
      gaps: [
        'low-traffic update scheduling',
        'encrypted migration verification',
        'production backup/rollback',
      ],
      nextStep: 'Add a signed update planner and keep actual deployment/rollback manual until durable backup adapters exist.',
    }),
  ]

  const completed = capabilities.filter((item) => item.maturity === 'production').length
  const missing = capabilities.filter((item) => item.maturity === 'missing').length
  const partial = capabilities.length - completed - missing
  const score = Math.round((capabilities.reduce((sum, item) => sum + scoreFor(item.maturity), 0) / capabilities.length) * 100)

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    branchGoal: 'canvas-2-public-server',
    mode: 'local-json-public-server',
    productName: 'inscanvas',
    overall: {
      productionReady: false,
      completed,
      partial,
      missing,
      score,
    },
    principles: {
      canvasFirst: true,
      defaultLocale: 'zh-CN',
      promptLanguage: 'en',
      compatibleRuntimeNames: ['vcanvas_* localStorage', 'VCANVAS_* env', '/_vcanvas_proxy', '/opt/vcanvas', 'vcanvas.service'],
    },
    capabilities,
    blockers: [
      'Production auth must come from newapi/subapi bridge, not local/mock self-reported tiers.',
      'Server-managed generation needs a real WorkflowService worker before I-IV background execution can be claimed.',
      'Provider API keys require encrypted server-side custody before non-guest production use.',
      'Local JSON storage is acceptable for zero-config development, not for 250-online public operation.',
    ],
    recommendations: [
      'Keep all platform controls in the secondary Control Center so the drawing surface stays first.',
      'Treat the current branch as a public-server core, then attach newapi, queue, and database adapters behind service interfaces.',
      'Do not hardcode unverified latest models; route models through a registry with verification metadata.',
    ],
  }
}
