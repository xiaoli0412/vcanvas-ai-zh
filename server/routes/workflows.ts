import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { CanvasModeId, ExecutionMode, WorkflowAction, WorkflowContext } from '../../shared/contracts/publicServer'
import { getActor } from '../lib/platformPolicy'
import { createWorkflowRun } from '../services/workflowService'

async function handleWorkflow(action: WorkflowAction, request: any) {
  const body = (request.body || {}) as {
    ownerId?: string
    modeId?: CanvasModeId
    executionMode?: ExecutionMode
    prompt?: string
    context?: WorkflowContext
  }
  return localDataStore.update((data) => {
    const actor = getActor(data, request)
    const result = createWorkflowRun(data, {
      action,
      actor,
      ownerId: body.ownerId,
      modeId: body.modeId,
      executionMode: body.executionMode,
      prompt: body.prompt,
      context: body.context,
    })
    data.auditEvents.push({
      id: createId('audit'),
      actorId: actor.id,
      actorTier: actor.tier,
      action: `workflow.${action}`,
      ip: getClientIp(request),
      createdAt: new Date().toISOString(),
      metadata: {
        ownerId: result.run.ownerId,
        ownerResolution: result.ownerResolution,
        workflowRunId: result.run.id,
        executionMode: result.run.executionMode,
        hostingPolicy: result.hostingPolicy,
        executionPlan: result.executionPlan,
      },
    })
    return result
  })
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
