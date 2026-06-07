# Canvas 2.0 Master Checklist

## Source Documents
- [Canvas重构方案2.0.md](C:/Users/李昊桐/Downloads/Canvas重构方案2.0.md)
- [Canvas_2.0_重构计划注意细则.md](C:/Users/李昊桐/Downloads/Canvas_2.0_重构计划注意细则.md)

## Current Phase Summary
- Branch renamed and pushed as `codex/canvas-lab-public-server`; current owner-cadence work continues on `codex/canvas-lab-public-server-v1.10.9`.
- Public-server phase-1 skeleton exists in `server/`, `shared/`, and `docs/public-server-baseline.md`.
- 画布优先 shell is now the enforced default: classic/custom mode opens with a compact bottom prompt bar, while Studio, context, starters, remix, video keyframes, and Web Embed management stay in secondary panels.
- Fastify `npm run server` and deployment `scripts/serve-vcanvas.mjs` now share the core public-server API surface with local JSON persistence.
- Header model entry is split into a compact quick switch plus secondary `Personal Settings · Models & Channels`; provider editing no longer expands from the canvas header directly.
- Local/mock public-server v1 now persists users, quota ledgers, redeem codes, blocked IPs, rate-limit events, sign-in records, share links, and gallery entries.
- A secondary `Works Center` modal is now wired from the compact canvas toolbar, covering current HTML save, HTML import, work metadata edits, share links, gallery submission, export, and delete without adding persistent canvas chrome.
- A secondary `inscanvas Control Center` modal is now wired from the header, covering mock login/register/guest session state, personal quota/profile entry, admin site settings, notices/warnings, gallery front desk, and ops cleanup without adding a persistent sidebar.
- Control Center v2 now adds admin-only user management, app-level forced warning popups, and a Works Center over-limit deletion chooser while keeping all controls in secondary modals.
- Control Center v3 now adds user search plus admin IP block/unblock controls backed by `/api/security/blocked-ips`; self-blocking the current request IP is refused in local/mock mode.
- Public share and gallery front-desk pages now exist at `/share/:slug` and `/gallery` in both Fastify and the lightweight deployment server, without adding persistent canvas chrome.
- Typography, language, and theme consistency pass is underway for `1.10.11`: default locale is Chinese, Header language switching stays visible on desktop/mobile, HarmonyOS Sans system-first typography is applied to body/control text, and public fallback pages are simplified into a deep-blue/slightly-purple admin-style shell.
- `1.10.11` now embeds local OFL display fonts: Noto Serif SC for premium Songti-style titles and Fusion Pixel 10px Monospaced SC for short playful title/brand accents; no external font CDN is required.
- `/gallery` is being simplified into a lighter Xiaohongshu-style masonry feed with optional snapshot covers, compact metadata, shorter notices, and matching Fastify/lightweight server templates.
- `/api/dispatch/status` and `/api/dispatch/route` now expose a planned-only distributed dispatch opening with weighted candidate selection and explicit fallback reasons.
- `1.11.3` adds a first-class platform readiness boundary: `/api/platform/readiness` reports production/local-mock/contract-only/missing maturity, and Control Center opens to that map by default so incomplete public-server pieces are visible instead of hidden behind optimistic UI.
- Local/mock login and registration no longer trust browser-submitted user tiers; roles now come from an existing local user record, the reserved `local-admin` bootstrap account, or the future `newapi/subapi` bridge.
- `1.11.4` removes the unsafe ambient latest-session fallback. Control Center, Personal Settings, and Works Center now carry explicit `x-vcanvas-session-id` headers from a small frontend session helper.
- `1.11.4` also hardens logout semantics: anonymous/no-header requests cannot clear all sessions, users can only logout their own sessions, and admin session removal remains explicit.
- `1.11.4` hardens owner assignment for workflow and asset intake: non-admin requests cannot forge `ownerId`, and audit events record the real actor separately from target owner metadata.
- `1.11.4` extracts workflow run creation into a server `WorkflowService` boundary and upgrades `/api/assets/import` into metadata-only asset intake with audit records in both Fastify and the lightweight deployment server.
- `1.11.5` adds local AES-GCM provider-key custody and provider write permissions: guests cannot save server channels, regular users can only edit owned channels, and host-admin/admin owns site-level provider governance.
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
- `done` local/mock login/register hardening: client-supplied `tier` is ignored for new sessions; arbitrary users cannot self-promote to admin through `/api/session/login`
- `done` explicit session contract: user identity no longer falls back to the most recent active session when headers are missing
- `done` logout safety contract: no ambient session wipe; cross-user logout requires host-admin/admin
- `done` workflow/asset ownership contract: requested `ownerId` is ignored for non-admin callers and kept only as metadata
- `in_progress` platform readiness endpoint exposes the real auth gap and keeps the future `newapi/subapi` role source explicit
- `todo` QQ avatar sync
- `todo` wallet/payment area split with stronger protection

### 2. Security
- `in_progress` Encrypted provider keys for non-guest users: local AES-GCM custody exists, production KMS/key-vault adapter remains todo
- `in_progress` IP audit, throttling, blocked IP store, manual admin block/unblock, and escalating lockouts on heavy routes
- `todo` injection/leak prevention across UI and service routes
- `in_progress` long/short disclaimer system
- `in_progress` export/share comment injection with IP/time metadata
- `in_progress` admin-only site/security controls are visible in Control Center; production key encryption and security review model remain deferred
- `done` provider write guardrails: guest POST is blocked, owned channels are user-editable, site/built-in channels require host-admin/admin
- `done` app-level forced warning overlay consumes persisted `warning/realtime/force` notices and supports dismissible vs session acknowledgement behavior
- `done` Control Center readiness map names the key-vault/security-review gaps instead of implying provider-key custody is production-safe

### 3. Performance
- `todo` multi-user concurrency path and async work distribution
- `in_progress` cleanup endpoint for expired workflows, sessions, rate-limit events, and blocked IPs
- `in_progress` dynamic server/client execution fallback metadata
- `in_progress` planned-only distributed dispatch contract through `/api/dispatch/status` and `/api/dispatch/route`
- `in_progress` platform readiness endpoint marks dispatch as `contract-only` until CPU/memory/disk/bandwidth telemetry and a queue backend exist
- `in_progress` workflow service boundary now centralizes hosting policy, 24h retention, context compression, execution plan metadata, and hosted-run quota debit
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
- `in_progress` `/api/assets/import` now records image/video/html import metadata and audit events without pretending binary storage is enabled
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
- `done` provider key custody metadata surfaces encrypted-local vs masked-only status without returning ciphertext

### 6. Settings
- `in_progress` site settings IA
- `in_progress` personal settings IA
- `done` Control Center v1 gives users one secondary entry for personal center, site settings, notices, gallery, quotas, and ops
- `done` Control Center now defaults to a maturity/readiness tab that separates production, local/mock, contract-only, and missing capabilities
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
- `in_progress` gallery / 鉴赏厅 with mock review status, tier quotas, and lightweight masonry-feed presentation
- `done` Control Center v1 includes a read-only gallery front desk preview; route-level public gallery now exists separately
- `in_progress` per-tier work and gallery limits

### 8. Frontend / Branding
- `in_progress` replace visible "canvas" branding intro surfaces with `inscanvas` where required while preserving storage/runtime compatibility
- `done` embedded local OFL font layer: Noto Serif SC display Songti, Fusion Pixel short-title accents, HarmonyOS/system sans for dense controls
- `done` preserve original dark-purple/deep-blue spirit direction as baseline target
- `in_progress` default Chinese + English toggle consistency pass; `ModelQuickSwitch`, `PersonalSettingsModal`, Header utility labels, and public fallback pages now share i18n/font/theme rules
- `in_progress` New API `v1.0.0-rc.10` is used only as a design-direction reference for compact management UI, table/card density, badges, and mobile scanability; no AGPL code or assets are copied
- `in_progress` full route-level IA for entry/login/personal center/gallery/settings, with `/share/:slug` and `/gallery` now implemented first

### 9. Backend Logic
- `done` public-server skeleton and first API placeholders
- `done` phase-1 session, providers, notices, settings, works, assets, remix, and workflow route contracts
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/health`, `/_vcanvas_proxy`, `/api/session/*`, `/api/providers`, `/api/notices`, `/api/settings/*`, `/api/works/*`, `/api/gallery`, `/api/quotas/*`, `/api/ops/status`, `/api/maintenance/cleanup`, `/api/remix/fetch`, and workflow enqueue routes
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/users` with admin-only local/mock user management and masked provider-key summaries
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/security/blocked-ips` with admin-only list/block/unblock parity
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve public HTML routes `/share/:slug` and `/gallery`
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/platform/readiness` with the same public-server maturity report
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/api/assets/import` metadata-only v1 and return workflow `executionPlan` metadata from `/api/workflows/generate|refine|plan`
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
- Language/theme follow-up verification passed for `1.10.11`: default Chinese fallback, embedded Noto Serif SC + Fusion Pixel font loading, mobile Header language toggle visibility, simplified public `/gallery` and `/share/:slug` fallback parity, planned-only `/api/dispatch/*` parity, and no obvious text overlap at `1440x960` / `390x844`.
- Fastify static resource fallback was fixed so production JS/CSS/font assets stream from `VCANVAS_STATIC_DIR` before the SPA `index.html` fallback.

## 2026-06-07 Validation
- `npm run typecheck` passed.
- `npm run typecheck:server` passed.
- `node --check scripts/serve-vcanvas.mjs` passed.
- `npm run build` passed with the existing large chunk warnings only.
- Fastify smoke test passed for explicit session auth, user-id-only spoof rejection, anonymous logout no-op, cross-user logout rejection, self logout, workflow `executionPlan`, and metadata-only asset import.
- Lightweight `scripts/serve-vcanvas.mjs` smoke test passed for the same session/logout/workflow/assets scenarios, confirming deployment-service parity.
- Owner-spoof smoke test passed on both services: non-admin workflow/assets requests with `ownerId=local-admin` are pinned back to the caller, while host-admin delegated ownership remains allowed.
- `1.11.5` provider custody smoke test passed on both services: anonymous provider writes are rejected, regular users can save encrypted owned channels, plaintext API keys do not persist to JSON, other users receive masked/hidden provider views, and only host-admin/admin can edit built-in channel capabilities.

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
