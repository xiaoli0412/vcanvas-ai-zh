import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { CanvasModeId, ExecutionMode, WorkflowContext, WorkflowRun } from '../../shared/contracts/publicServer'
import { getActor, resolveHostingPolicy, WORKFLOW_TTL_MS } from '../lib/platformPolicy'

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
  const data = await localDataStore.read()
  const actor = getActor(data, request)
  const ownerId = body.ownerId || actor.id
  const modeId = body.modeId || body.context?.modeId || 'custom'
  const hostingPolicy = resolveHostingPolicy(data, {
    modeId,
    actorId: ownerId,
    tier: actor.tier,
  })
  const requestedExecutionMode = body.executionMode
  const executionMode = requestedExecutionMode
    || (modeId === 'video' || modeId === 'web-copy'
      ? hostingPolicy.resourceHeavyModeDefault
      : hostingPolicy.defaultExecutionMode)
  const run: WorkflowRun = {
    id: createId(`workflow-${route}`),
    ownerId,
    modeId,
    executionMode,
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
    const ledger = data.quotaLedgers.find((item) => item.userId === ownerId)
    if ((modeId === 'video' || modeId === 'web-copy') && run.executionMode === 'server-managed' && ledger && typeof ledger.hostedRunsRemaining === 'number') {
      ledger.hostedRunsRemaining = Math.max(0, ledger.hostedRunsRemaining - 1)
    }
    data.workflows.push(run)
    data.auditEvents.push({
      id: createId('audit'),
      actorId: ownerId,
      actorTier: actor.tier,
      action: `workflow.${route}`,
      ip: getClientIp(request),
      createdAt: now.toISOString(),
      metadata: { workflowRunId: run.id, executionMode: run.executionMode, hostingPolicy },
    })
  })
  return { run, hostingPolicy }
}

export async function registerWorkflowRoutes(app: FastifyInstance) {
  app.post('/api/workflows/generate', async (request) => ({
    ok: true,
    route: 'generate',
    ...(await handleWorkflow('generate', request)),
  }))

  app.post('/api/workflows/refine', async (request) => ({
    ok: true,
    route: 'refine',
    ...(await handleWorkflow('refine', request)),
  }))

  app.post('/api/workflows/plan', async (request) => ({
    ok: true,
    route: 'plan',
    ...(await handleWorkflow('plan', request)),
  }))
}
