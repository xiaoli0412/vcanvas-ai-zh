## 1.11.27 - 2026-06-09

### Features
- Added an admin quota-policy editor inside the secondary Control Center Site tab for works-per-owner limits and per-tier gallery submission limits, with blank values representing unlimited gallery capacity.
- Kept the new quota controls inside the existing modal flow so no persistent canvas chrome or drawing area is added.

### Fixes
- Restricted site-settings and notice writes to host-admin/admin users in both Fastify and the lightweight deployment server instead of relying on frontend visibility.
- Validated quota policy patches server-side and preserved `workLimitPerOwner: 0` as an intentional zero limit across quota summaries and work save/import checks.

## 1.11.26 - 2026-06-09

### Features
- Added a shared works/gallery quota summary contract so Fastify and the lightweight deployment server return visible work limits, gallery submission limits, remaining slots, and tier denial reasons with consistent `limit: null` unlimited semantics.
- Surfaced compact work and gallery quota pills inside the secondary Works Center modal, keeping limit status actionable without adding persistent canvas chrome.

### Fixes
- Included quota metadata in save/import/gallery-submit success and denial responses so the UI can explain over-limit states before users hit opaque errors.
- Brought the lightweight deployment server closer to Fastify parity for work detail metadata and work access checks.

## 1.11.25 - 2026-06-09

### Features
- Added an admin-only cleanup preview path for local/mock runtime data so operators can inspect stale workflow, session, rate-limit, and blocked-IP candidates before applying cleanup.
- Surfaced cleanup candidates, retention windows, preview counts, and applied removal counts in the secondary Control Center Ops tab without adding persistent canvas chrome.

### Fixes
- Restricted `/api/maintenance/cleanup` to host-admin/admin users in both Fastify and the lightweight deployment server, while keeping `/api/ops/status` read-only.
- Kept Fastify and `scripts/serve-vcanvas.mjs` cleanup reports aligned with the same `candidates`, `removed`, `before`, `after`, and retention metadata.

## 1.11.24 - 2026-06-09

### Features
- Added a 24h workflow resume surface in the secondary Control Center so retained Generate/Refine/Plan runs can be listed, inspected, cancelled, and copied without taking canvas space.
- Added Fastify and lightweight deployment parity for workflow list/detail/cancel APIs while keeping only Generate/Refine/Plan POST routes metered.
- Updated the platform readiness map so the local/mock workflow resume UI is marked implemented while real server-side workers and queues remain explicit gaps.

### Fixes
- Hidden expired workflow detail/cancel routes behind the same 24h retention boundary as the list API, and limited local/mock cancellation to queued or running workflow runs.
- Updated workflow copy/cancel controls to keep mobile actions wrapped, immediately reflect cancelled state, and fall back when clipboard writes are rejected on HTTP/IP deployments.

## 1.11.23 - 2026-06-09

### Fixes
- Updated the platform readiness map so the Works/Gallery/Share capability no longer lists public share rendering hardening as unfinished after the `1.11.22` safety gate.
- Mirrored the readiness wording in both Fastify and the lightweight deployment server, including the local/mock guest metered-route shutdown and base-quota guardrails.
- Returned the same `guest-access-disabled` reason code from both guest-session and metered-route shutdown responses.

## 1.11.22 - 2026-06-08

### Fixes
- Public share pages now re-check work and link safety state before rendering, so stale enabled slugs cannot expose a work after it becomes `blocked`.
- Public gallery pages and default gallery API reads now filter out `blocked` work, link, or entry safety state, even if an old entry still says `published`.
- Gallery review and safety-review routes now disable existing share links and demote published entries back to `pending-review` whenever a refreshed safety result is `blocked`.
- Works Center no longer displays a disabled or blocked stale share slug as if it were still active.

## 1.11.21 - 2026-06-08

### Features
- Promoted local/mock safety metadata from gallery-only entries to work records, so saved/imported/updated works carry a reusable safety status.
- Public sharing now runs the same local preflight and blocks `blocked` works with `409` before a share link is created.

### Fixes
- Existing share links are automatically disabled when a work edit refreshes safety status to `blocked`, preventing stale public links from exposing newly risky content.
- Works Center now shows compact safety status labels without adding persistent canvas chrome.

## 1.11.20 - 2026-06-08

### Features
- Added local/mock gallery safety preflight records with `passed`, `needs-review`, and `blocked` states, risk scores, reason codes, and audit events.
- Added admin-only `/api/gallery/:id/safety-review` parity for Fastify and the lightweight deployment server, plus a compact Control Center recheck action.

### Fixes
- Publishing a gallery entry now reuses or runs safety preflight and blocks locally flagged `blocked` submissions before they can reach the public feed.
- Updating a gallery-submitted work now refreshes its safety preflight and moves already published entries back to `pending-review` if the new content needs review or is blocked.
- Control Center now surfaces safety status and reason labels in Chinese/English without adding persistent canvas chrome.

## 1.11.19 - 2026-06-08

### Features
- Added an admin-only local/mock gallery review workflow with publish, reject, and restore-to-pending actions in the secondary Control Center Gallery area.
- Added `/api/gallery/:id/review` parity to both Fastify and the lightweight deployment server, with audit events and matching work `galleryStatus` updates.

### Fixes
- Public `/gallery` now renders only approved `published` works; pending and rejected submissions stay visible only in owner/admin review contexts.
- Works Center now fetches the current user's own gallery queue explicitly, so personal pending/rejected status remains visible without leaking into the public feed.

## 1.11.18 - 2026-06-08

### Features
- Added local/mock redeem-code management for host-admin/admin users, including generated codes, enabled/disabled state, expiry, max uses, notes, tier upgrades, premium credits, base calls, and hosted-run rewards.
- Surfaced redeem-code creation and status in the secondary Control Center Data area, keeping ordinary user redemption in the Personal wallet area without adding persistent canvas chrome.

### Fixes
- Redeeming a tier-upgrade code now refreshes the user's active local/mock sessions as well as the stored user and quota ledger, so upgraded permissions apply without requiring a fresh login.
- Non-admin quota reads no longer expose the site redeem-code list.

## 1.11.17 - 2026-06-08

### Features
- Added local/mock natural-day quota windows for base calls and hosted runs, with same-day sign-in idempotence and visible reset times in the secondary Control Center.
- Hardened heavy-route governance so metered API calls return remaining/reset metadata, logged-in users consume daily base quota, and disallowed `server-managed` requests are downgraded to the policy-approved execution mode.

### Fixes
- Routed the lightweight deployment service's `/api/remix/fetch` through the same traffic guard as the Fastify server, preserving guest IP caps and API parity for web-copy requests.

## 1.11.16 - 2026-06-08

### Fixes
- Loaded embedded display font styles at runtime from the Vite base URL resolved against `document.baseURI`, keeping Noto Serif SC and Fusion Pixel available on web, GitHub Pages, and Electron `file://` builds.
- Removed the desktop-build font stylesheet resolution warning without changing the existing public `/fonts/*` asset layout.

## 1.11.15 - 2026-06-08

### Fixes
- Pre-warmed the macOS `dmg-builder@1.2.0` helper cache from a verified mirror before packaging, avoiding repeated GitHub `504` failures during DMG creation.
- Kept Electron runtime mirroring separate from helper binary caching so the macOS packaging pipeline does not redirect unrelated downloads.

## 1.11.14 - 2026-06-08

### Fixes
- Moved Electron runtime downloads into electron-builder's `electronDownload.mirror` configuration so all desktop platforms avoid transient GitHub `504` errors for Electron zip files.
- Kept electron-builder helper mirrors scoped to Linux and Windows only, preserving the macOS default helper path for `dmg-builder`.

### Notes
- This avoids using `ELECTRON_MIRROR` during macOS packaging, which previously polluted generic helper downloads.

## 1.11.13 - 2026-06-08

### Fixes
- Added the electron-builder binary mirror to Windows desktop packaging only, after the `1.11.12` main run passed Linux/macOS but Windows hit a GitHub `504` while downloading `nsis-resources`.

### Notes
- macOS remains on the default upstream helper path to avoid the `dmg-builder` mirror redirect that caused earlier failures.

## 1.11.12 - 2026-06-08

### Fixes
- Scoped Electron mirror usage to dependency installation and Linux desktop packaging so macOS no longer redirects `dmg-builder` through the broken npmmirror path.
- Restored the electron-builder binary mirror only for Linux packaging, where AppImage helper downloads were hitting GitHub `504` errors.

### Notes
- Windows packaging already passed on `1.11.11`, so this release keeps Windows on the default upstream packaging path.

## 1.11.11 - 2026-06-08

### Fixes
- Removed the global electron-builder binary mirror from GitHub Actions so macOS DMG packaging can fetch `dmg-builder` from its expected upstream instead of the broken mirror path that returned `404`.

### Notes
- Kept the Electron runtime mirror and `npm ci` retry loops from `1.11.10`, preserving the Linux install hardening without redirecting macOS packaging helpers.

## 1.11.10 - 2026-06-08

### Fixes
- Hardened GitHub Actions dependency installation for desktop and Pages workflows with Electron download mirrors and retry loops, after the `v1.11.9` Linux tag build hit repeated Electron download `HTTP 504` failures during `npm ci`.

### Notes
- No runtime product behavior changed beyond the already released read-only update checks from `1.11.9`.

## 1.11.9 - 2026-06-08

### Highlights
- Added an admin-only read-only GitHub Release check at `/api/updates/check` for both Fastify and `scripts/serve-vcanvas.mjs`.
- Added optional `GITHUB_TOKEN` / `GH_TOKEN` support for authenticated GitHub API requests while keeping anonymous fallback and safe error reporting.
- Added a Control Center Data & Migration card that shows repository, current version, latest release, comparison status, and a direct release link without adding persistent canvas chrome.

### Notes
- This is an update notice/check only. It does not pull code, restart services, schedule low-traffic updates, or perform backup/rollback automation.

## 1.11.8 - 2026-06-08

### Highlights
- Added admin-only local JSON data portability v1 across both Fastify and `scripts/serve-vcanvas.mjs`: `/api/data/export` returns a manifest by default and can include local/mock site data with `includeData=true`.
- Added `/api/data/import` with dry-run summaries by default, explicit confirmation text for applied imports, migration-policy gating, and audit records for full export/import actions.
- Added a secondary Control Center `Data` tab so host-admin/admin users can inspect collection counts, download a full JSON bundle, dry-run pasted imports, and apply imports without adding persistent canvas chrome.

### Notes
- This is local/mock portability for the `.vcanvas-data` JSON adapter, not production encrypted backup, durable rollback, PostgreSQL migration, or a cross-node restore system.
- Exported bundles should be treated as sensitive because they may include sessions, audit history, rate-limit/security records, and encrypted provider custody metadata.

## 1.11.7 - 2026-06-08

### Highlights
- Added a secondary Control Center dispatch policy editor so admins can enable the planned-only multi-server routing preview and configure weighted candidate nodes without touching the canvas workspace.
- Added an Ops dispatch preview that shows the selected candidate node, fallback reason, planned-only status, and node load/weight details.
- Kept Fastify and `scripts/serve-vcanvas.mjs` aligned by merging nested `dispatchPolicy` settings consistently when site settings are saved.

### CI
- Opted GitHub workflows into the Node 24 JavaScript action runtime to avoid the upcoming Node 20 action deprecation warnings while keeping project builds on Node 22.

### Notes
- Dispatch remains a contract-only opening, not a real queue or cross-server executor. It is intentionally visible as a preview until telemetry, worker queues, and durable routing adapters are added.

## 1.11.6 - 2026-06-08

### Fixes
- Added repository owner and Linux maintainer metadata so the desktop workflow can build `.deb` packages without electron-builder rejecting the release.
- Changed the Pages workflow to publish the built site to the `gh-pages` branch, avoiding repeated GitHub Pages deployment API failures when Pages is not enabled for Actions deployment.

### Notes
- To expose the public Pages URL, the repository still needs GitHub Pages configured to serve the `gh-pages` branch. The workflow itself now publishes the branch artifact without requiring the Pages deployment API.

## 1.11.5 - 2026-06-07

### Highlights
- Added local AES-256-GCM provider-key custody for server-side provider channels; plaintext API keys are encrypted before local JSON persistence and stripped from API responses.
- Hardened `/api/providers` write access: guests cannot save server-side channels, regular users can only edit their own channels, and site/built-in channels require host-admin/admin.
- Added provider key custody metadata so the UI can distinguish `none`, `masked-only`, and `encrypted-local` without exposing ciphertext.
- Kept Fastify and `scripts/serve-vcanvas.mjs` behavior aligned for provider permissions, encrypted local key storage, and masked provider responses.

### Notes
- This is still local/mock custody, not a production KMS. Set `VCANVAS_KEY_SECRET` before real deployment and replace the fallback key material with a production vault adapter before server-managed provider execution is enabled by default.

## 1.11.4 - 2026-06-07

### Highlights
- Removed ambient latest-session fallback from the public-server skeleton; authenticated platform routes now require an explicit inscanvas session header.
- Hardened `/api/session/logout` so anonymous/no-header calls can no longer clear every local/mock session; users can only logout themselves unless an admin session is present.
- Hardened workflow and asset ownership so non-admin callers cannot forge `ownerId`; audits now record the real actor and keep requested ownership as metadata.
- Added a frontend session helper so Control Center, Personal Settings, and Works Center send the current session without touching legacy canvas/provider storage keys.
- Extracted workflow run creation into a server-side `WorkflowService` boundary covering retention, hosting policy, context compression, execution plan metadata, and hosted-run quota debit.
- Upgraded `/api/assets/import` from a placeholder to metadata-only asset intake with audit records and Fastify/lightweight server parity.

### Notes
- Server-managed model execution is still a queued contract, not a real worker yet. This release makes the boundary cleaner so the next adapter can attach without further route sprawl.

## 1.11.3 - 2026-06-07

### Highlights
- Added a Canvas 2.0 platform readiness endpoint and Control Center tab that clearly separates production-ready work from local/mock, contract-only, and missing public-server capabilities.
- Hardened local/mock session flows so browser requests can no longer self-assign admin tiers during login or registration.
- Kept Fastify and the lightweight deployment server aligned by exposing `/api/platform/readiness` in both runtimes.

### Notes
- This release is an architecture-boundary pass, not a claim that `newapi` auth, encrypted key custody, server-managed model execution, PostgreSQL/Redis persistence, or worker queues are complete.

## 1.11.2 - 2026-06-06

### Fixes
- Hardened the standalone `18087` server against malformed double-slash request paths such as `//data:,` so direct public-port access no longer crashes with an empty response.

## 1.11.0 - 2026-05-31

### Highlights
- Rebuilt VCanvas around a more canvas-first workflow while keeping the new creative-lab architecture in place.
- Added six differentiated creation modes, including the new `Remix` homepage reconstruction mode.
- Promoted `Compatible OpenAI` to the primary provider path and expanded built-in provider coverage.

### Canvas And Workflow
- Added mode-aware generation, refine, and plan pipelines so each mode produces meaningfully different prompt context.
- Added optional previous-round context carry-over for refine flows, including the previous prompt and previous HTML output.
- Added HTML export directly from the live preview toolbar.
- Added web embed editing inside the canvas toolbar.
- Added image import and first-frame video import as first-class canvas reference inputs.

### Provider And API
- Renamed the custom connection entry to `Compatible OpenAI` in the UI while preserving storage compatibility.
- Added dedicated `ChatGPT` and `Kimi` provider cards.
- Reordered provider priority so `Compatible OpenAI` comes first, followed by `ChatGPT` and `Kimi`.
- Tightened compatible-provider validation so endpoint, model ID, and API key are all required before generation.
- Fixed legacy `z.ai` fallback behavior so unconfigured users return cleanly to `Compatible OpenAI`.

### UI And Experience
- Moved the mode picker to a fixed portal popover to avoid clipping over the workspace.
- Restored classic mode as the default entry point.
- Converted classic mode controls into a secondary drawer so the canvas keeps visual priority.
- Pulled the theme back toward the darker blue and muted purple direction.
- Reduced bottom control typography to better match the original compact feel.

### Desktop And Release Foundation
- Includes the desktop packaging, asset, and CI/tag publishing work that landed after `v1.10.8`.
- Keeps Electron packaging support for Windows, macOS, and Linux in the same release line.
