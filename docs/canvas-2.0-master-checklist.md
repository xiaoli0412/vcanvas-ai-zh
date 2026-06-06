# Canvas 2.0 Master Checklist

## Source Documents
- [Canvas重构方案2.0.md](C:/Users/李昊桐/Downloads/Canvas重构方案2.0.md)
- [Canvas_2.0_重构计划注意细则.md](C:/Users/李昊桐/Downloads/Canvas_2.0_重构计划注意细则.md)

## Current Phase Summary
- Branch renamed and pushed as `codex/canvas-lab-public-server`.
- Public-server phase-1 skeleton exists in `server/`, `shared/`, and `docs/public-server-baseline.md`.
- Canvas-first shell has begun: custom mode default, secondary mode panel, compact prompt controls, workflow context toggles, remix URL reference path, HTML export, image/video import, and Web Embed v1.
- Frontend and new server skeleton both pass typecheck; app build passes.

## Completion Matrix

### 1. User System
- `todo` Real auth/session system on top of latest `newapi`
- `todo` 5-tier role model with host-admin/admin/vip/user/guest
- `todo` 8h inactivity relogin
- `todo` guest temporary login + right-top login notice payload
- `todo` QQ avatar sync
- `todo` wallet/payment area split with stronger protection

### 2. Security
- `todo` Encrypted provider keys for non-guest users
- `todo` IP audit, throttling, and escalating lockouts
- `todo` injection/leak prevention across UI and service routes
- `todo` long/short disclaimer system
- `todo` export/share comment injection with IP/time metadata

### 3. Performance
- `todo` multi-user concurrency path and async work distribution
- `todo` caching cleanup, garbage/error artifact cleanup
- `todo` dynamic server/client execution fallback
- `todo` server-hosted high-resource toggle for video/web copy

### 4. Canvas Tools / Modes
- `done` secondary mode panel and canvas-first prompt shell
- `done` explicit workflow context toggles
- `done` remix/homepage reference fetch path
- `done` image and video import at the same entry level
- `done` expand to 12 modes from the notes document
- `done` original-author "原汁原味" mode
- `done` dedicated video-mode keyframe refinement path through extracted keyframe anchors
- `done` precise right-side annotation editing mode for preview-based refine context
- `done` Web Embed URL placeholder, edit/replace/remove controls, iframe preview, failure fallback, and prompt metadata
- `todo` tool-calling / MCP / skill gated execution model
- `todo` auto context compression

### 5. Models / Providers
- `done` provider framework still intact after refactor
- `todo` add more providers: ModelScope, Ollama, DMX, 百炼, Mimo, Step, Nvidia, etc.
- `todo` latest factual model lists with verified multimodal capabilities
- `todo` model capability auto-detection similar to Asterbot
- `todo` saved/favorited models and richer per-model capability badges
- `todo` move provider management to personal settings and leave quick switch in header

### 6. Settings
- `todo` site settings IA
- `todo` personal settings IA
- `todo` notice / warning / announcement systems
- `todo` ops dashboard

### 7. Works / Gallery / Share
- `done` HTML export from preview
- `todo` persistent work save/load on server
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
- `todo` bridge `newapi`, `subapi`, `octopus`
- `todo` persistence, queues, quotas, task recovery, migration

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
