# VCanvas Public Server Baseline

## Branch
- Current phase-0/1 branch: `codex/canvas-lab-public-server`
- Legacy branch retained remotely for rollback comparison: `publish/codex/creative-lab`

## Frozen Compatibility Baseline
- Frontend canvas stack remains `React + Vite + Excalidraw`.
- Current user-visible generation path remains browser-side for now.
- Existing `/_vcanvas_proxy`, `/proxy`, `/health`, Electron bootstrap, static build, and remote deployment script remain supported.
- Existing provider storage, prompt studio storage, and canvas save/load behavior remain readable during migration.

## Phase-1 Additions Started
- `shared/contracts/publicServer.ts` defines the first public-server contract set.
- `server/` now hosts the public-server TypeScript skeleton and placeholder API routes.
- `server/data/localDataStore.ts` provides the default zero-configuration JSON persistence adapter under `.vcanvas-data/`, covering settings, notices, provider channels, works, workflow runs, sessions, users, quotas, redeem codes, blocked IPs, rate-limit events, sign-in records, share links, gallery entries, and audit events.
- `src/lib/canvasModes.ts` now carries the 12-mode Canvas 2.0 state model, including legacy-mode migration from the earlier six-mode branch.
- `src/lib/workflowContext.ts` introduces explicit workflow context composition for previous-turn carryover and remix references.
- `src/lib/websiteReference.ts` introduces client-side remix reference fetching against `/api/remix/fetch`.
- `src/components/ModePanel.tsx` and `src/components/PromptBar.tsx` now keep modes, website remix input, and fine-tune controls in secondary UI so the canvas remains first.
- `src/components/PreviewAnnotations.tsx` adds right-side preview annotations that feed location-aware notes into refine and plan-refine prompts.
- `src/lib/videoReferences.ts` extracts local video keyframes for video mode and sends selected frames as visual anchors across generate/refine/plan flows.
- `src/components/WebEmbedPanel.tsx` and `src/lib/webEmbeds.ts` add Web Embed v1: URL placeholder frames, edit/replace/remove controls, compact iframe preview, visible fallback, save/load support, and prompt metadata.
- `server/routes/providers.ts` and `server/routes/notices.ts` add phase-1 public-server contracts for model channel governance and site notice delivery without claiming unverified model capability data.
- Session, settings, works, quota, ops, and workflow routes now expose the planned phase-1 local/mock surface for guest/server-managed execution, personal/site settings, works CRUD/import/share/gallery-submit, sign-in/redeem, 24h workflow run retention, cleanup, and compressed workflow context payloads.
- `scripts/serve-vcanvas.mjs` now mirrors the core Fastify API surface for existing `/opt/vcanvas` static deployments instead of serving only `/health`, static files, and proxy calls.
- Frontend provider defaults are OpenAI-compatible first: `custom` remains the storage ID, but the UI label/default entry is `Compatible OpenAI`; ChatGPT and Kimi are distinct cards, and unverified model lists are intentionally not hardcoded.
- The header model control is now a compact quick switch. Channel/model management moves into `Personal Settings · Models & Channels`, with search, favorites, manual model IDs, capability badges, and batch capability editing through the server provider contract.
- Video mode now explicitly falls back to keyframe/vision translation notes when the active model is not marked `video=true`; direct video-understanding requests are not assumed for non-video models.
- `src/components/WorkCenterModal.tsx` adds the first canvas-first Works Center UI layer: save the latest generated HTML with a canvas snapshot, import standalone HTML, edit metadata, export, share, submit to the mock gallery queue, and delete works from a secondary modal opened by the compact canvas toolbar.
- Classic/custom mode now opens with a compact prompt bar by default. Starter chips, Studio, context carry settings, remix details, video keyframes, and Web Embed management stay behind secondary controls so the canvas remains primary.
- Mobile/narrow layouts hide the right preview panel and keep the header horizontally scrollable instead of crushing the canvas or stacking the brand vertically.

## 2026-06-06 Verification Snapshot
- `npm run typecheck`
- `npm run typecheck:server`
- `npm run build`
- Fastify smoke test: `/health`, `/_vcanvas_proxy`, `/`, `/api/providers`, `/api/session/me`, `/api/settings/site`, `/api/notices`, `/api/works` CRUD, `/api/workflows/generate`, `/api/remix/fetch`.
- Lightweight `scripts/serve-vcanvas.mjs` smoke test: same endpoint set as Fastify.
- Browser screenshots reviewed at desktop `1440x960` and mobile `390x844`.

## Deferred Beyond This Commit
- Real auth on top of latest `newapi`, production key encryption, payment-grade quotas, PostgreSQL/Redis persistence, and external `newapi/subapi/octopus` bridges.
- Production-grade native Excalidraw embeddable element integration, deeper iframe-block detection, and persisted web-embed previews.
- Queue-backed screenshots, Redis, PostgreSQL, and worker orchestration.
- Verified official model catalogs and Asterbot-style model capability auto-detection across every provider channel.
