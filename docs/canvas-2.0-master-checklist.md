# Canvas 2.0 Master Checklist

## Source Documents
- [Canvas重构方案2.0.md](C:/Users/李昊桐/Downloads/Canvas重构方案2.0.md)
- [Canvas_2.0_重构计划注意细则.md](C:/Users/李昊桐/Downloads/Canvas_2.0_重构计划注意细则.md)

## Current Phase Summary
- Branch renamed and pushed as `codex/canvas-lab-public-server`; current owner-cadence work continues on `codex/canvas-lab-public-server-v1.10.9`.
- Public-server phase-1 skeleton exists in `server/`, `shared/`, and `docs/public-server-baseline.md`.
- Canvas-first shell is now the enforced default: classic/custom mode opens with a compact bottom prompt bar, while Studio, context, starters, remix, video keyframes, and Web Embed management stay in secondary panels.
- Fastify `npm run server` and deployment `scripts/serve-vcanvas.mjs` now share the core public-server API surface with local JSON persistence.
- Header model entry is split into a compact quick switch plus secondary `Personal Settings · Models & Channels`; provider editing no longer expands from the canvas header directly.
- Local/mock public-server v1 now persists users, quota ledgers, redeem codes, blocked IPs, rate-limit events, sign-in records, share links, and gallery entries.
- A secondary `Works Center` modal is now wired from the compact canvas toolbar, covering current HTML save, HTML import, work metadata edits, share links, gallery submission, export, and delete without adding persistent canvas chrome.
- A secondary `inscanvas Control Center` modal is now wired from the header, covering mock login/register/guest session state, personal quota/profile entry, admin site settings, notices/warnings, gallery front desk, and ops cleanup without adding a persistent sidebar.
- Control Center v2 now adds admin-only user management, app-level forced warning popups, and a Works Center over-limit deletion chooser while keeping all controls in secondary modals.
- Control Center v3 now adds user search plus admin IP block/unblock controls backed by `/api/security/blocked-ips`; self-blocking the current request IP is refused in local/mock mode.
- Public share and gallery front-desk pages now exist at `/share/:slug` and `/gallery` in both Fastify and the lightweight deployment server, without adding persistent canvas chrome.
- Frontend, server typecheck, build, service smoke tests, and desktop/mobile browser screenshots passed on 2026-06-06.

## Completion Matrix

### 1. User System
- `todo` Real auth/session system on top of latest `newapi`
- `done` 5-tier role model with host-admin/admin/vip/user/guest in shared contracts and local/mock session payloads
- `done` 8h inactivity relogin skeleton in local session routes
- `done` guest temporary login + right-top login notice payload
- `done` local/mock persisted users, sign-in records, permissions, and quota ledgers
- `done` Control Center v1 exposes mock login, local/mock register, guest session, session-left, login IP/UA/time, profile fields, sign-in, and redeem entry
- `done` admin-only user management UI and `/api/users` local/mock route with tier/enabled edits and IP/activity summaries
- `done` user-management search and IP block/unblock controls in Control Center
- `todo` QQ avatar sync
- `todo` wallet/payment area split with stronger protection

### 2. Security
- `todo` Encrypted provider keys for non-guest users
- `in_progress` IP audit, throttling, blocked IP store, manual admin block/unblock, and escalating lockouts on heavy routes
- `todo` injection/leak prevention across UI and service routes
- `in_progress` long/short disclaimer system
- `in_progress` export/share comment injection with IP/time metadata
- `in_progress` admin-only site/security controls are visible in Control Center; production key encryption and security review model remain deferred
- `done` app-level forced warning overlay consumes persisted `warning/realtime/force` notices and supports dismissible vs session acknowledgement behavior

### 3. Performance
- `todo` multi-user concurrency path and async work distribution
- `in_progress` cleanup endpoint for expired workflows, sessions, rate-limit events, and blocked IPs
- `in_progress` dynamic server/client execution fallback metadata
- `done` server-hosted high-resource toggle for video/web copy in personal settings and workflow policy
- `done` Control Center v1 surfaces ops status and manual cleanup as secondary controls

### 4. Canvas Tools / Modes
- `done` secondary mode panel and canvas-first prompt shell
- `done` classic/custom default prompt bar is compact and does not keep Studio/context/starters open
- `done` explicit workflow context toggles
- `done` remix/homepage reference fetch path
- `done` image and video import at the same entry level
- `done` expand to 12 modes from the notes document
- `done` original-author "原汁原味" mode
- `done` dedicated video-mode keyframe refinement path through extracted keyframe anchors
- `done` precise right-side annotation editing mode for preview-based refine context
- `done` Web Embed URL placeholder, edit/replace/remove controls, iframe preview, failure fallback, and prompt metadata
- `todo` tool-calling / MCP / skill gated execution model
- `in_progress` auto context compression v1 for workflow payloads

### 5. Models / Providers
- `done` provider framework still intact after refactor
- `done` Compatible OpenAI restored as first/default provider for unconfigured users
- `done` ChatGPT and Kimi added as distinct frontend provider cards without unverified model claims
- `in_progress` add more providers: ModelScope, Ollama, DMX, 百炼, Mimo, Step, Nvidia, etc. as server-side channel entries
- `todo` latest factual model lists with verified multimodal capabilities
- `todo` model capability auto-detection similar to Asterbot
- `in_progress` saved/favorited models and richer per-model capability badges
- `done` move provider management to personal settings and leave quick switch in header
- `in_progress` batch capability editing for provider channel models through `/api/providers`

### 6. Settings
- `in_progress` site settings IA
- `in_progress` personal settings IA
- `done` Control Center v1 gives users one secondary entry for personal center, site settings, notices, gallery, quotas, and ops
- `in_progress` notice / warning / announcement systems with persisted `force`, `dismissible`, markdown/image metadata, and admin creation UI
- `done` forced warning notices now surface in the main app rather than only inside Control Center
- `in_progress` site settings now include site profile, share policy, notice policy, security mode, update policy, migration policy, and ops public switch
- `in_progress` ops status and cleanup endpoints for local-json deployment health

### 7. Works / Gallery / Share
- `done` HTML export from preview
- `in_progress` persistent work save/list/manage on server through local JSON store, `/api/works`, and the secondary Works Center modal
- `done` import HTML through `/api/works/import-html` with the 10-work owner limit
- `done` Works Center shows an in-modal deletion chooser when the work limit is reached, so users can free space without leaving the canvas
- `done` share links through `/api/works/:id/share`
- `done` public share route `/share/:slug` renders enabled share links and returns branded 404/410/paused fallback pages
- `done` public gallery route `/gallery` renders a read-only standalone front desk for pending/published local/mock entries
- `in_progress` gallery / 鉴赏厅 with mock review status and tier quotas
- `done` Control Center v1 includes a read-only gallery front desk preview; route-level public gallery now exists separately
- `in_progress` per-tier work and gallery limits

### 8. Frontend / Branding
- `in_progress` replace visible "canvas" branding intro surfaces with `inscanvas` where required while preserving storage/runtime compatibility
- `done` preserve original dark-purple/deep-blue spirit direction as baseline target
- `in_progress` full route-level IA for entry/login/personal center/gallery/settings, with `/share/:slug` and `/gallery` now implemented first

### 9. Backend Logic
- `done` public-server skeleton and first API placeholders
- `done` phase-1 session, providers, notices, settings, works, assets, remix, and workflow route contracts
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/health`, `/_vcanvas_proxy`, `/api/session/*`, `/api/providers`, `/api/notices`, `/api/settings/*`, `/api/works/*`, `/api/gallery`, `/api/quotas/*`, `/api/ops/status`, `/api/maintenance/cleanup`, `/api/remix/fetch`, and workflow enqueue routes
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/users` with admin-only local/mock user management and masked provider-key summaries
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/security/blocked-ips` with admin-only list/block/unblock parity
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve public HTML routes `/share/:slug` and `/gallery`
- `done` local JSON persistence adapter for site settings, personal settings, notices, providers, works, workflow runs, sessions, users, quotas, shares, gallery entries, rate-limit events, blocked IPs, and audit events
- `in_progress` 24h workflow run retention with compressed context payloads
- `todo` bridge `newapi`, `subapi`, `octopus`
- `in_progress` local/mock quota, sign-in, redeem, ops, cleanup, and task-retention interfaces
- `todo` production persistence, queues, payment-grade quotas, task recovery, migration

## 2026-06-06 Validation
- `npm run typecheck` passed.
- `npm run typecheck:server` passed.
- `node --check scripts/serve-vcanvas.mjs` passed.
- `npm run build` passed with existing large chunk warnings only.
- Fastify smoke test passed for health, proxy, index, session register/login/me, providers, site settings patch, notices create, quotas sign-in/redeem, works CRUD/share/gallery-submit/delete, gallery, workflow generate/refine/plan, remix fetch, ops status, and cleanup.
- Lightweight deployment server smoke test passed for the same endpoint set, including parity cleanup of share/gallery metadata when deleting a work.
- Browser/CDP screenshots reviewed at `1440x960` and `390x844`; Control Center opens as a secondary modal and leaves `.workspace` dimensions unchanged on both viewports.
- Follow-up smoke test passed for `/api/users`, forced warning notice payloads, and work-limit delete/re-save behavior on both Fastify and lightweight deployment services.
- Security follow-up smoke test passed for `/api/security/blocked-ips` list/block/self-block rejection/blocked request rejection/unblock on both Fastify and lightweight deployment services.
- Browser screenshot review passed for user search + blocked IP state and ops blocked-IP list; `.workspace` remained `1440x920` before and after opening Control Center.
- Public route smoke test passed on both Fastify and `scripts/serve-vcanvas.mjs`: mock login, save HTML work, create share link, open `/share/:slug`, submit gallery, open `/gallery`, and confirm `/api/gallery`.
- Browser screenshot review passed for `/gallery` at `1440x960` and `390x844`, plus `/share/:slug` at `1440x960`; public pages remain standalone and do not add canvas chrome.

### 10. Sign-in / Quota
- `in_progress` login-as-signin flow through local/mock records
- `todo` natural-day quota windows
- `in_progress` premium/basic model quota ledgers in local JSON
- `in_progress` guest daily/IP caps on heavy routes

### 11. Redeem
- `in_progress` local/mock redeem endpoint and ledger application
- `todo` redeem code generation on top of `newapi`
- `todo` redeemable goods: tier, concurrency, quota, space

### 12. Updates / Migration
- `todo` GitHub update notice flow
- `todo` low-traffic update path
- `todo` encrypted migration/export/import

## Execution Order
1. Keep landing current phase-1 ergonomics and mode system until the canvas UX is stable.
2. Finish mode expansion, branding alignment, and provider-management IA.
3. Add real server persistence + auth/session foundations.
4. Add works/gallery/quota/payment/security flows on top of that foundation.
5. Add ops/update/migration and external bridges last.
