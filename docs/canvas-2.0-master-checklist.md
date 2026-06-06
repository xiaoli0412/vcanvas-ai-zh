# Canvas 2.0 Master Checklist

## Source Documents
- [Canvas重构方案2.0.md](C:/Users/李昊桐/Downloads/Canvas重构方案2.0.md)
- [Canvas_2.0_重构计划注意细则.md](C:/Users/李昊桐/Downloads/Canvas_2.0_重构计划注意细则.md)

## Current Phase Summary
- Branch renamed and pushed as `codex/canvas-lab-public-server`.
- Public-server phase-1 skeleton exists in `server/`, `shared/`, and `docs/public-server-baseline.md`.
- Canvas-first shell is now the enforced default: classic/custom mode opens with a compact bottom prompt bar, while Studio, context, starters, remix, video keyframes, and Web Embed management stay in secondary panels.
- Fastify `npm run server` and deployment `scripts/serve-vcanvas.mjs` now share the core public-server API surface with local JSON persistence.
- Frontend, server typecheck, build, service smoke tests, and desktop/mobile browser screenshots passed on 2026-06-06.

## Completion Matrix

### 1. User System
- `todo` Real auth/session system on top of latest `newapi`
- `in_progress` 5-tier role model with host-admin/admin/vip/user/guest in shared contracts and local/mock session payloads
- `in_progress` 8h inactivity relogin skeleton in local session routes
- `in_progress` guest temporary login + right-top login notice payload
- `todo` QQ avatar sync
- `todo` wallet/payment area split with stronger protection

### 2. Security
- `todo` Encrypted provider keys for non-guest users
- `in_progress` IP audit, throttling, and escalating lockouts
- `todo` injection/leak prevention across UI and service routes
- `in_progress` long/short disclaimer system
- `in_progress` export/share comment injection with IP/time metadata

### 3. Performance
- `todo` multi-user concurrency path and async work distribution
- `todo` caching cleanup, garbage/error artifact cleanup
- `todo` dynamic server/client execution fallback
- `todo` server-hosted high-resource toggle for video/web copy

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
- `todo` saved/favorited models and richer per-model capability badges
- `todo` move provider management to personal settings and leave quick switch in header

### 6. Settings
- `in_progress` site settings IA
- `in_progress` personal settings IA
- `in_progress` notice / warning / announcement systems
- `todo` ops dashboard

### 7. Works / Gallery / Share
- `done` HTML export from preview
- `in_progress` persistent work save/load on server through local JSON store and `/api/works`
- `todo` import HTML with limits
- `todo` share links
- `todo` gallery / 鉴赏厅 with moderation and quotas
- `todo` per-tier concurrency and work limits

### 8. Frontend / Branding
- `in_progress` replace visible "canvas" branding intro surfaces with `inscanvas` where required while preserving storage/runtime compatibility
- `done` preserve original dark-purple/deep-blue spirit direction as baseline target
- `todo` full route-level IA for entry/login/personal center/gallery/settings

### 9. Backend Logic
- `done` public-server skeleton and first API placeholders
- `done` phase-1 session, providers, notices, settings, works, assets, remix, and workflow route contracts
- `done` `npm run server` and `scripts/serve-vcanvas.mjs` both serve `/health`, `/_vcanvas_proxy`, `/api/session/*`, `/api/providers`, `/api/notices`, `/api/settings/*`, `/api/works/*`, `/api/remix/fetch`, and workflow enqueue routes
- `done` local JSON persistence adapter for site settings, personal settings, notices, providers, works, workflow runs, sessions, and audit events
- `in_progress` 24h workflow run retention with compressed context payloads
- `todo` bridge `newapi`, `subapi`, `octopus`
- `todo` persistence, queues, quotas, task recovery, migration

## 2026-06-06 Validation
- `npm run typecheck` passed.
- `npm run typecheck:server` passed.
- `npm run build` passed with existing large chunk warnings only.
- Fastify smoke test passed for health, proxy, index, providers, session, settings, notices, works CRUD, workflow generate, and remix fetch.
- Lightweight deployment server smoke test passed for the same core endpoints.
- Browser screenshots reviewed at `1440x960` and `390x844`; default canvas view is compact and mobile no longer shows the right preview panel crushing the canvas.

### 10. Sign-in / Quota
- `todo` login-as-signin flow
- `todo` natural-day quota windows
- `todo` premium/basic model quota ledgers
- `todo` guest daily/IP caps

### 11. Redeem
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
