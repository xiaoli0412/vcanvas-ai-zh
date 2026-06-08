# inscanvas Public Server Baseline

## Branch
- Current owner-cadence branch: `codex/canvas-lab-public-server-v1.10.9`
- Main phase-0/1 branch retained on publish: `codex/canvas-lab-public-server`
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
- `src/components/ControlCenterModal.tsx` adds the first `inscanvas` control-center UI layer: mock login/register/guest, session/IP/UA visibility, quota sign-in/redeem entry, profile fields, site settings, notice creation, gallery front desk, and ops cleanup all live in a secondary modal instead of a permanent side panel.
- `src/components/ControlCenterModal.tsx` now also exposes an admin-only user-management tab backed by `/api/users`, showing tier/enabled state, IP/activity summaries, work/workflow counts, provider channel counts, and masked-key counts without returning clear-text keys.
- `src/components/ControlCenterModal.tsx` now adds user search plus manual IP block/unblock controls backed by `/api/security/blocked-ips`; the server refuses to block the current request IP in local/mock mode to avoid admin self-lockout.
- `src/components/NoticeOverlay.tsx` consumes forced warning/realtime notices from `/api/notices` and displays them as app-level secondary overlays with local/session acknowledgement.
- `src/components/WorkCenterModal.tsx` now catches work-limit situations before save/import and shows an in-modal deletion chooser so users can free one slot without leaving the canvas.
- Classic/custom mode now opens with a compact prompt bar by default. Starter chips, Studio, context carry settings, remix details, video keyframes, and Web Embed management stay behind secondary controls so the canvas remains primary.
- Mobile/narrow layouts hide the right preview panel and keep the header horizontally scrollable instead of crushing the canvas or stacking the brand vertically.
- Site settings and notice payloads now preserve nested `sharePolicy`, `noticePolicy`, `updatePolicy`, and `migrationPolicy` defaults when old local JSON data is migrated or partially patched.
- `scripts/serve-vcanvas.mjs` mirrors the Fastify delete semantics for works, including cleanup of share links and gallery entries, so the deployment server does not accumulate orphaned public metadata.
- Public share pages now resolve enabled share links at `/share/:slug`; saved HTML is returned directly so imported static landing pages are not wrapped or broken, while missing/expired/paused links return branded fallback pages.
- Public gallery front-desk pages now resolve at `/gallery` in both Fastify and `scripts/serve-vcanvas.mjs`, rendering pending/published local/mock entries as a read-only standalone page in the simple deep-blue inscanvas direction.
- `1.10.11` language/theme baseline aligns the app and public pages around default Chinese, always-available Header language switching, HarmonyOS Sans system-first body/control typography, and a deeper blue with slight purple accent palette (`#080d1c`, `#0b1024`, `#111831`).
- `ModelQuickSwitch` and `PersonalSettingsModal` are now wired to the shared i18n dictionary; public `/gallery` and `/share/:slug` fallback pages use Chinese copy in both Fastify and the lightweight deployment server while leaving brand/provider/API/model identifiers unchanged.
- `1.10.11` typography now embeds local OFL fonts: Noto Serif SC / Source Han Serif style for high-quality Songti display titles and Fusion Pixel 10px Monospaced SC for short playful titles/brand accents, while dense controls keep HarmonyOS/system sans fallbacks. Font notices are tracked in `docs/third-party-fonts.md`.
- `/gallery` now uses a lighter Xiaohongshu-style masonry feed in both Fastify and `scripts/serve-vcanvas.mjs`: optional snapshot covers first, compact metadata, shorter notices, and simple gradient placeholders when no preview image exists.
- `/api/dispatch/status` and `/api/dispatch/route` now expose a planned-only distributed dispatch contract with weighted candidate selection, current-load awareness, and explicit fallback reasons; no real cross-server queue execution is implied in this phase.
- `1.11.3` adds `/api/platform/readiness` to both Fastify and `scripts/serve-vcanvas.mjs`. It reports Canvas 2.0 public-server maturity by domain (`production`, `local-mock`, `contract-only`, `missing`) and lists blockers for newapi auth, key vault custody, server-managed workflow execution, verified model registry, production persistence, and update/migration.
- `src/components/ControlCenterModal.tsx` now opens to the readiness map by default, keeping public-server gaps visible while preserving the canvas-first rule because the control center remains a secondary modal.
- Local/mock `/api/session/login` and `/api/session/register` now ignore client-supplied `tier`. New accounts default to `user`, existing local users keep their stored tier, and only the reserved local bootstrap identity `local-admin` resolves to `host-admin` until a real bridge owns roles.
- `1.11.4` removes ambient latest-session fallback from the local/mock server skeleton. Browser calls must carry `x-vcanvas-session-id`; `x-vcanvas-user-id` is only a consistency guard, not a credential.
- `/api/session/logout` now follows the same explicit-session rule: no-header logout is a no-op, normal users can only remove their own active session/user sessions, and host-admin/admin can remove explicit target sessions.
- Workflow and asset import ownership now use a shared local/mock rule: only host-admin/admin can honor a requested `ownerId`; other callers are pinned to their authenticated actor id, while audit events always record the real actor.
- `src/lib/sessionClient.ts` stores the current local/mock session and attaches it to Control Center, Personal Settings, and Works Center requests without changing existing `vcanvas_*` canvas/provider storage keys.
- `server/services/workflowService.ts` is the first real service boundary for Generate/Refine/Plan records. It owns 24h retention, local context compression, hosting-policy selection, `executionPlan` metadata, and hosted-run quota debit while route files stay as HTTP adapters.
- `/api/assets/import` now has Fastify/lightweight parity as metadata-only asset intake with audit records. It intentionally does not store binary image/video files in local JSON.
- `scripts/serve-vcanvas.mjs` remains a compatibility deployment shim with mirrored workflow/asset logic; every workflow/security change must be smoke-tested against both Fastify and the lightweight service until the deployment path can load the TypeScript service bundle directly.
- `1.11.5` adds local provider-key custody for public-server channels. `apiKey` request bodies are encrypted with AES-256-GCM before JSON persistence, responses strip ciphertext, and `keyCustody` reports `none`, `masked-only`, or `encrypted-local`. This is still a local adapter; production deployments should set `VCANVAS_KEY_SECRET` and later replace it with KMS/key-vault custody.
- `/api/providers` write permissions are now explicit: guests cannot persist server-side channels, regular users can only edit owned channels, and site/built-in channels plus cross-owner edits require host-admin/admin. Fastify and the lightweight deployment service share the same behavior.
- `1.11.7` exposes the planned-only dispatch layer inside the secondary Control Center: Site Settings can edit weighted dispatch nodes as JSON, Ops previews selected/fallback routing state, and the Fastify/lightweight settings paths both preserve nested `dispatchPolicy` updates. This remains a contract-only opening until real queues and cross-server workers exist.
- `1.11.8` adds local-json-v1 data portability to Fastify and `scripts/serve-vcanvas.mjs`: host-admin/admin can fetch manifest counts, download a full local JSON bundle, dry-run pasted imports, and apply imports only after the configured confirmation phrase. Control Center exposes this through an admin-only Data tab without adding persistent canvas chrome.
- `1.11.9` adds read-only GitHub latest Release checks to Fastify and `scripts/serve-vcanvas.mjs`: host-admin/admin can inspect current/latest version status from the Control Center Data tab, and deployments can provide `GITHUB_TOKEN` or `GH_TOKEN` to avoid anonymous GitHub API rate limits. This is notice-only, not auto-update or rollback automation.
- `1.11.10` hardens release workflows after repeated Linux tag-build `npm ci` failures caused by Electron download `HTTP 504`: desktop and Pages workflows now use Electron mirror variables and retry dependency installation before failing.
- `1.11.15` completes release workflow hardening for the owner-cadence branch: Electron runtime packages resolve through `electronDownload.mirror`, Linux/Windows helper binaries stay scoped to their mirror, and macOS pre-warms the `dmg-builder` cache before DMG packaging.
- `1.11.16` keeps embedded typography runtime-safe by loading the SPA font styles from the Vite base URL resolved against `document.baseURI`, so `/fonts/*` works on normal HTTP hosting, GitHub Pages subpaths, and Electron `file://` without Vite build-time font warnings.
- `1.11.17` turns local/mock quota windows into real daily behavior: ledgers refresh at the next server-local midnight, daily check-in is idempotent, logged-in metered calls consume base quota, guest IP caps use a natural-day window, and disallowed server-managed heavy requests are downgraded before workflow records are saved.
- `1.11.18` adds local/mock redeem-code management to both Fastify and `scripts/serve-vcanvas.mjs`: admins can create/disable generated quota goods, ordinary users only redeem them, tier-upgrade rewards refresh active sessions, and the secondary Control Center Data area exposes the flow without adding canvas chrome.

## 2026-06-06 Verification Snapshot
- `npm run typecheck`
- `npm run typecheck:server`
- `node --check scripts/serve-vcanvas.mjs`
- `npm run build`
- Fastify smoke test: `/health`, `/_vcanvas_proxy`, `/`, `/share/:slug`, `/gallery`, `/api/session/register|login|me`, `/api/users`, `/api/security/blocked-ips`, `/api/providers`, `/api/settings/site`, `/api/notices`, `/api/quotas/sign-in|redeem`, `/api/works` CRUD/share/gallery-submit/delete, `/api/gallery`, `/api/workflows/generate|refine|plan`, `/api/remix/fetch`, `/api/ops/status`, `/api/maintenance/cleanup`, `/api/data/export|import`, `/api/updates/check`.
- Lightweight `scripts/serve-vcanvas.mjs` smoke test: same endpoint set as Fastify, including public `/share/:slug` and `/gallery`, with post-delete counts confirming no orphaned share/gallery records and parity for `/api/users`, `/api/security/blocked-ips`, `/api/data/export|import`, and `/api/updates/check`.
- Follow-up smoke test: admin user patch, forced warning notice payload, work-limit 409, delete-for-space, and re-save passed on both Fastify and lightweight services.
- Security follow-up smoke test: `/api/security/blocked-ips` list/block/self-block rejection/blocked request rejection/unblock passed on both Fastify and lightweight services.
- Browser/CDP screenshots reviewed at desktop `1440x960` and mobile `390x844`; opening the Control Center leaves `.workspace` dimensions unchanged (`1440x920` desktop, `390x804` mobile).
- Browser screenshot review for the security slice confirmed user search, blocked-IP state, and ops blocked-IP list render inside the secondary Control Center modal without changing `.workspace` size (`1440x920` before and after).
- Public-route smoke test passed on both Fastify and lightweight services: mock user login, work save, share creation, `/share/:slug`, gallery submission, `/gallery`, and `/api/gallery`.
- Public-page browser screenshot review passed for `/gallery` desktop `1440x960`, `/gallery` mobile `390x844`, and direct `/share/:slug` desktop `1440x960`.
- `1.10.11` final verification passed for embedded font loading, default Chinese, Header language toggle desktop/mobile, compact PromptBar/FramePicker/MessageStrip typography, public `/gallery` screenshots at `1440x960` and `390x844`, and `/api/dispatch/*` parity.
- Fastify static serving now streams real files from `VCANVAS_STATIC_DIR` before SPA fallback, so `/assets/*.js`, `/assets/*.css`, and `/fonts/*` no longer fall through to `index.html`.
- `1.11.3` validation adds `/api/platform/readiness` to the required Fastify/lightweight smoke set and includes a negative privilege test: posting `tier: "host-admin"` for an arbitrary user must still return `tier: "user"`.
- `1.11.4` validation adds explicit-session smoke tests: requests without a session header resolve to guest, requests with the saved login session resolve to that user, and user-id-only headers cannot authenticate.

## 2026-06-08 Verification Snapshot
- `1.11.9` validation adds `/api/updates/check` smoke coverage for Fastify and `scripts/serve-vcanvas.mjs`: host-admin login, authenticated GitHub latest-release lookup, current package version `1.11.9`, latest remote release `v1.11.8` before publishing, trailing-slash repo URL normalization, and Control Center Data tab screenshots at `1440x960` / `390x844` with no horizontal overflow.
- `1.11.15` GitHub Actions validation passed for `main` Pages, `main` Desktop, and tag-triggered Desktop release publishing.
- `1.11.16` validation passed for embedded font loading: `npm run build`, `npm run build:gh`, `npm run build:desktop`, `npm run dist:desktop:ci`, and lightweight `/fonts/*` static requests all succeeded without the previous unresolved font stylesheet warnings.
- `1.11.17` validation adds quota/traffic smoke coverage for Fastify and `scripts/serve-vcanvas.mjs`: daily check-in idempotence, base quota exhaustion, server-managed downgrade, guest natural-day rate metadata, and remix fetch traffic-guard parity.
- `1.11.18` validation adds redeem-code smoke coverage for Fastify and `scripts/serve-vcanvas.mjs`: admin create/list/disable, non-admin management rejection and list hiding, base/hosted/premium rewards, and tier-upgrade session refresh.

## Deferred Beyond This Commit
- Real auth on top of latest `newapi`, production key encryption, payment-grade quotas/redeem-code generation, PostgreSQL/Redis persistence, and external `newapi/subapi/octopus` bridges.
- Production-grade native Excalidraw embeddable element integration, deeper iframe-block detection, and persisted web-embed previews.
- Queue-backed screenshots, Redis, PostgreSQL, and worker orchestration.
- Verified official model catalogs and Asterbot-style model capability auto-detection across every provider channel.
- Production auto-update, backup/rollback, encrypted migration verification, cross-node restore, and database/queue migrations; `1.11.8` only covers the local JSON adapter and `1.11.9` only covers read-only GitHub Release checks.
- Real production readiness requires service extraction around `AuthService`, `WorkflowService`, `ModelRegistry`, `KeyVault`, `QuotaPolicy`, and durable store/queue adapters; the current local JSON stack is intentionally a zero-config development baseline, not the final 250-online architecture.
