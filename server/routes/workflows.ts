import type { FastifyInstance } from 'fastify'
import { createId, getClientIp, localDataStore } from '../data/localDataStore'
import type { CanvasModeId, ExecutionMode, WorkflowAction, WorkflowContext } from '../../shared/contracts/publicServer'
import { canManageUsers, getActor, resolveOwnedTargetId } from '../lib/platformPolicy'
import { canCancelWorkflowRun, createWorkflowRun, isWorkflowRunExpired, summarizeWorkflowRun } from '../services/workflowService'

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
  app.get('/api/workflows', async (request) => {
    const query = (request.query || {}) as { ownerId?: string; includeExpired?: string; limit?: string }
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const ownerResolution = resolveOwnedTargetId(actor, query.ownerId)
    const now = Date.now()
    const includeExpired = query.includeExpired === 'true' && canManageUsers(actor.tier)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 40))
    const items = data.workflows
      .filter((workflow) => workflow.ownerId === ownerResolution.ownerId)
      .map((workflow) => summarizeWorkflowRun(workflow, now))
      .filter((workflow) => includeExpired || !workflow.expired)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, limit)

    return {
      ok: true,
      items,
      retentionHours: 24,
      ownerResolution,
    }
  })

  app.get('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = await localDataStore.read()
    const actor = getActor(data, request)
    const workflow = data.workflows.find((item) => item.id === id)
    if (!workflow || isWorkflowRunExpired(workflow) || (workflow.ownerId !== actor.id && !canManageUsers(actor.tier))) {
      reply.code(404).send({ ok: false, error: 'Workflow run not found.' })
      return
    }
    return {
      ok: true,
      run: workflow,
      summary: summarizeWorkflowRun(workflow),
    }
  })

  app.patch('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as { status?: string }
    const result = await localDataStore.update((data) => {
      const actor = getActor(data, request)
      const index = data.workflows.findIndex((item) => item.id === id)
      if (index < 0) return { status: 'missing' as const }
      const workflow = data.workflows[index]
      if (isWorkflowRunExpired(workflow) || (workflow.ownerId !== actor.id && !canManageUsers(actor.tier))) return { status: 'missing' as const }
      if (body.status !== 'cancelled') return { status: 'invalid' as const }
      if (!canCancelWorkflowRun(workflow)) return { status: 'not-cancellable' as const }
      const now = new Date().toISOString()
      data.workflows[index] = { ...workflow, status: 'cancelled', updatedAt: now }
      data.auditEvents.push({
        id: createId('audit'),
        actorId: actor.id,
        actorTier: actor.tier,
        action: 'workflow.cancel',
        ip: getClientIp(request),
        createdAt: now,
        metadata: { workflowRunId: id, ownerId: workflow.ownerId },
      })
      return { status: 'ok' as const, run: data.workflows[index] }
    })
    if (result.status === 'missing') {
      reply.code(404).send({ ok: false, error: 'Workflow run not found.' })
      return
    }
    if (result.status === 'invalid') {
      reply.code(400).send({ ok: false, error: 'Only cancelling workflow runs is supported in local/mock mode.' })
      return
    }
    if (result.status === 'not-cancellable') {
      reply.code(400).send({ ok: false, error: 'Only queued or running workflow runs can be cancelled.' })
      return
    }
    return {
      ok: true,
      run: result.run,
      summary: summarizeWorkflowRun(result.run),
    }
  })

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
