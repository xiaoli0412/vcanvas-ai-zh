import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { CanvasModeId, ExecutionMode, WorkflowContext, WorkflowRun } from '../../shared/contracts/publicServer'

const WORKFLOW_TTL_MS = 24 * 60 * 60 * 1000

function compressText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return value
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}\n...[compressed by inscanvas context v1]`
}

function compressWorkflowContext(context: WorkflowContext | undefined): WorkflowContext | undefined {
  if (!context) return context
  return {
    ...context,
    currentOutputHtml: compressText(context.currentOutputHtml, 12000) as string | undefined,
    previousTurn: context.previousTurn
      ? {
        ...context.previousTurn,
        html: compressText(context.previousTurn.html, 12000) as string | undefined,
      }
      : context.previousTurn,
    websiteReference: context.websiteReference
      ? {
        ...context.websiteReference,
        html: compressText(context.websiteReference.html, 16000) as string,
        rebasedHtml: compressText(context.websiteReference.rebasedHtml, 16000) as string | undefined,
        stylesheetSnippets: context.websiteReference.stylesheetSnippets.map((snippet) => compressText(snippet, 4000) as string),
      }
      : context.websiteReference,
  }
}

async function handleWorkflow(route: 'generate' | 'refine' | 'plan', request: any) {
  const body = (request.body || {}) as {
    ownerId?: string
    modeId?: CanvasModeId
    executionMode?: ExecutionMode
    prompt?: string
    context?: WorkflowContext
  }
  const now = new Date()
  const ownerId = body.ownerId || 'guest-local'
  const run: WorkflowRun = {
    id: createId(`workflow-${route}`),
    ownerId,
    modeId: body.modeId || body.context?.modeId || 'custom',
    executionMode: body.executionMode || (ownerId === 'guest-local' ? 'browser-local' : 'server-managed'),
    prompt: body.prompt || body.context?.prompt || '',
    context: compressWorkflowContext(body.context) || {
      modeId: body.modeId || 'custom',
      prompt: body.prompt || '',
      carryPolicy: 'last-turn',
      currentCanvasLabels: [],
      includePreviousPrompt: true,
      includePreviousOutput: true,
      includePreviousScreenshot: false,
    },
    status: 'queued',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WORKFLOW_TTL_MS).toISOString(),
  }
  await localDataStore.update((data) => {
    const cutoff = Date.now()
    data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > cutoff)
    data.workflows.push(run)
    data.auditEvents.push({
      id: createId('audit'),
      actorId: ownerId,
      actorTier: ownerId === 'guest-local' ? 'guest' : 'user',
      action: `workflow.${route}`,
      ip: getClientIp(request),
      createdAt: now.toISOString(),
      metadata: { workflowRunId: run.id, executionMode: run.executionMode },
    })
  })
  return run
}

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.post('/api/workflows/generate', async (request) => ({
    ok: true,
    route: 'generate',
    run: await handleWorkflow('generate', request),
  }))

  app.post('/api/workflows/refine', async (request) => ({
    ok: true,
    route: 'refine',
    run: await handleWorkflow('refine', request),
  }))

  app.post('/api/workflows/plan', async (request) => ({
    ok: true,
    route: 'plan',
    run: await handleWorkflow('plan', request),
  }))
}
