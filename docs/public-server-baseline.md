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
- `src/lib/canvasModes.ts` now carries the 12-mode Canvas 2.0 state model, including legacy-mode migration from the earlier six-mode branch.
- `src/lib/workflowContext.ts` introduces explicit workflow context composition for previous-turn carryover and remix references.
- `src/lib/websiteReference.ts` introduces client-side remix reference fetching against `/api/remix/fetch`.
- `src/components/ModePanel.tsx` and `src/components/PromptBar.tsx` now keep modes, website remix input, and fine-tune controls in secondary UI so the canvas remains first.
- `src/components/PreviewAnnotations.tsx` adds right-side preview annotations that feed location-aware notes into refine and plan-refine prompts.
- `src/lib/videoReferences.ts` extracts local video keyframes for video mode and sends selected frames as visual anchors across generate/refine/plan flows.
- `src/components/WebEmbedPanel.tsx` and `src/lib/webEmbeds.ts` add Web Embed v1: URL placeholder frames, edit/replace/remove controls, compact iframe preview, visible fallback, save/load support, and prompt metadata.
- `server/routes/providers.ts` and `server/routes/notices.ts` add phase-1 public-server contracts for model channel governance and site notice delivery without claiming unverified model capability data.
- Session, settings, and works routes now expose the planned phase-1 mock surface for guest/server-managed execution, personal/site settings, and works CRUD.

## Deferred Beyond This Commit
- Real auth, RBAC, quotas, persistence, gallery, admin settings, and external `newapi/subapi/octopus` bridges.
- Production-grade native Excalidraw embeddable element integration, deeper iframe-block detection, and persisted web-embed previews.
- Queue-backed screenshots, Redis, PostgreSQL, and worker orchestration.
