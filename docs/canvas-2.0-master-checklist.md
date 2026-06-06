# Canvas 2.0 Master Checklist

## Source Documents
- [Canvas重构方案2.0.md](C:/Users/李昊桐/Downloads/Canvas重构方案2.0.md)
- [Canvas_2.0_重构计划注意细则.md](C:/Users/李昊桐/Downloads/Canvas_2.0_重构计划注意细则.md)

## Current Phase Summary
- Branch renamed and pushed as `codex/canvas-lab-public-server`.
- Public-server phase-1 skeleton exists in `server/`, `shared/`, and `docs/public-server-baseline.md`.
- Canvas-first shell is now the enforced default: classic/custom mode opens with a compact bottom prompt bar, while Studio, context, starters, remix, video keyframes, and Web Embed management stay in secondary panels.
- Fastify `npm run server` and deployment `scripts/serve-vcanvas.mjs` now share the core public-server API surface with local JSON persistence.
- Header model entry is split into a compact quick switch plus secondary `Personal Settings · Models & Channels`; provider editing no longer expands from the canvas header directly.
- Local/mock public-server v1 now persists users, quota ledgers, redeem codes, blocked IPs, rate-limit events, sign-in records, share links, and gallery entries.
- A secondary `Works Center` modal is now wired from the compact canvas toolbar, covering current HTML save, HTML import, work metadata edits, share links, gallery submission, export, and delete without adding persistent canvas chrome.
- Frontend, server typecheck, build, service smoke tests, and desktop/mobile browser screenshots passed on 2026-06-06.

## Completion Matrix

### 1. User System
- `todo` Real auth/session system on top of latest `newapi`
- `done` 5-tier role model with host-admin/admin/vip/user/guest in shared contracts and local/mock session payloads
- `done` 8h inactivity relogin skeleton in local session routes
- `done` guest temporary login + right-top login notice payload
- `in_progress` local/mock persisted users, sign-in records, permissions, and quota ledgers
- `todo` QQ avatar sync
- `todo` wallet/payment area split with stronger protection

### 2. Security
- `todo` Encrypted provider keys for non-guest users
- `in_progress` IP audit, throttling, blocked IP store, and escalating lockouts on heavy routes
- `todo` injection/leak prevention across UI and service routes
- `in_progress` long/short disclaimer system
- `in_progress` export/share comment injection with IP/time metadata

### 3. Performance
- `todo` multi-user concurrency path and async work distribution
- `in_progress` cleanup endpoint for expired workflows, sessions, rate-limit events, and blocked IPs
- `in_progress` dynamic server/client execution fallback metadata
- `done` server-hosted high-resource toggle for video/web copy in personal settings and workflow policy

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
- `in_progress` notice / warning / announcement systems
- `in_progress` ops status and cleanup endpoints for local-json deployment health

### 7. Works / Gallery / Share
- `done` HTML export from preview
- `in_progress` persistent work save/list/manage on server through local JSON store, `/api/works`, and the secondary Works Center modal
- `done` import HTML through `/api/works/import-html` with the 10-work owner limit
- `done` share links through `/api/works/:id/share`
- `in_progress` gallery / 鉴赏厅 with mock review status and tier quotas
- `in_progress` per-tier work and gallery limits

### 8. Frontend / Branding
- `in_progress` replace visible "canvas" branding intro surfaces with `inscanvas` where required while preserving storage/runtime compatibility
- `done` preserve original dark-purple/deep-blue spirit direction as baseline target
- `todo` full route-level IA for entry/login/personal center/gallery/settings

### 9. Backend Logic
- `done` public-server skeleton and first API placeholders
- `done` phase-1 session, providers, notices, settings, works, assets, remix, and workflow route contracts
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/health`, `/_vcanvas_proxy`, `/api/session/*`, `/api/providers`, `/api/notices`, `/api/settings/*`, `/api/works/*`, `/api/remix/fetch`, and workflow enqueue routes
- `done` local JSON persistence adapter for site settings, personal settings, notices, providers, works, workflow runs, sessions, users, quotas, shares, gallery entries, rate-limit events, blocked IPs, and audit events
- `in_progress` 24h workflow run retention with compressed context payloads
- `todo` bridge `newapi`, `subapi`, `octopus`
- `in_progress` local/mock quota, sign-in, redeem, ops, cleanup, and task-retention interfaces
- `todo` production persistence, queues, payment-grade quotas, task recovery, migration

## 2026-06-06 Validation
- `npm run typecheck` passed.
- `npm run typecheck:server` passed.
- `npm run build` passed with existing large chunk warnings only.
- Fastify smoke test passed for health, proxy, index, providers, session, settings, notices, works CRUD, workflow generate, and remix fetch.
- Lightweight deployment server smoke test passed for the same core endpoints.
- Browser screenshots reviewed at `1440x960` and `390x844`; default canvas view is compact and mobile no longer shows the right preview panel crushing the canvas.

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
