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
