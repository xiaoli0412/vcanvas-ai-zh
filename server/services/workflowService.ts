import type {
  CanvasModeId,
  ExecutionMode,
  UserTier,
  WorkflowAction,
  WorkflowContext,
  WorkflowExecutionPlan,
  WorkflowRun,
  WorkflowServiceResult,
} from '../../shared/contracts/publicServer'
import { createId, type PublicServerData } from '../data/localDataStore'
import { refreshQuotaLedger, resolveHostingPolicy, resolveOwnedTargetId, WORKFLOW_TTL_MS } from '../lib/platformPolicy'

interface WorkflowServiceInput {
  action: WorkflowAction
  actor: {
    id: string
    tier: UserTier
  }
  ownerId?: string
  modeId?: CanvasModeId
  executionMode?: ExecutionMode
  prompt?: string
  context?: WorkflowContext
}

function compressText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return { value, applied: false }
  if (value.length <= maxLength) return { value, applied: false }
  return {
    value: `${value.slice(0, maxLength)}\n...[compressed by inscanvas context v1]`,
    applied: true,
  }
}

function compressWorkflowContext(context: WorkflowContext | undefined) {
  if (!context) return { context, applied: false }
  let applied = false
  const currentOutputHtml = compressText(context.currentOutputHtml, 12000)
  const previousHtml = compressText(context.previousTurn?.html, 12000)
  const websiteHtml = compressText(context.websiteReference?.html, 16000)
  const rebasedHtml = compressText(context.websiteReference?.rebasedHtml, 16000)
  const stylesheetSnippets = context.websiteReference?.stylesheetSnippets?.map((snippet) => {
    const compressed = compressText(snippet, 4000)
    applied = applied || compressed.applied
    return compressed.value as string
  })

  applied = applied
    || currentOutputHtml.applied
    || previousHtml.applied
    || websiteHtml.applied
    || rebasedHtml.applied

  return {
    context: {
      ...context,
      currentOutputHtml: currentOutputHtml.value as string | undefined,
      previousTurn: context.previousTurn
        ? {
          ...context.previousTurn,
          html: previousHtml.value as string | undefined,
        }
        : context.previousTurn,
      websiteReference: context.websiteReference
        ? {
          ...context.websiteReference,
          html: websiteHtml.value as string,
          rebasedHtml: rebasedHtml.value as string | undefined,
          stylesheetSnippets: stylesheetSnippets || [],
        }
        : context.websiteReference,
    },
    applied,
  }
}

function defaultWorkflowContext(input: WorkflowServiceInput, modeId: CanvasModeId): WorkflowContext {
  return {
    modeId,
    prompt: input.prompt || '',
    carryPolicy: 'last-turn',
    currentCanvasLabels: [],
    includePreviousPrompt: true,
    includePreviousOutput: true,
    includePreviousScreenshot: false,
  }
}

function isHeavyMode(modeId: CanvasModeId) {
  return modeId === 'video' || modeId === 'web-copy'
}

export function createWorkflowRun(data: PublicServerData, input: WorkflowServiceInput): WorkflowServiceResult {
  const now = new Date()
  const ownerResolution = resolveOwnedTargetId(input.actor, input.ownerId)
  const ownerId = ownerResolution.ownerId
  const modeId = input.modeId || input.context?.modeId || 'custom'
  const hostingPolicy = resolveHostingPolicy(data, {
    modeId,
    actorId: ownerId,
    tier: input.actor.tier,
  })
  const policyExecutionMode = isHeavyMode(modeId) ? hostingPolicy.resourceHeavyModeDefault : hostingPolicy.defaultExecutionMode
  const requestedExecutionMode = input.executionMode
  const executionMode = requestedExecutionMode === 'server-managed' && policyExecutionMode !== 'server-managed'
    ? policyExecutionMode
    : (requestedExecutionMode || policyExecutionMode)
  const gatingReason = requestedExecutionMode === 'server-managed' && executionMode !== 'server-managed'
    ? (hostingPolicy.fallbackReason || 'server-managed-not-allowed')
    : hostingPolicy.fallbackReason
  const compressed = compressWorkflowContext(input.context)
  const context = compressed.context || defaultWorkflowContext(input, modeId)
  const run: WorkflowRun = {
    id: createId(`workflow-${input.action}`),
    ownerId,
    modeId,
    executionMode,
    prompt: input.prompt || input.context?.prompt || '',
    context,
    status: 'queued',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + WORKFLOW_TTL_MS).toISOString(),
  }

  const ledger = refreshQuotaLedger(data, ownerId, input.actor.tier)
  let hostedRunsDebited = 0
  if (isHeavyMode(modeId) && run.executionMode === 'server-managed' && typeof ledger.hostedRunsRemaining === 'number') {
    ledger.hostedRunsRemaining = Math.max(0, ledger.hostedRunsRemaining - 1)
    ledger.hostedRunsUsedToday = (ledger.hostedRunsUsedToday || 0) + 1
    hostedRunsDebited = 1
  }

  data.workflows = data.workflows.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > Date.now())
  data.workflows.push(run)

  const executionPlan: WorkflowExecutionPlan = {
    action: input.action,
    executor: run.executionMode,
    plannedOnly: run.executionMode === 'server-managed',
    reason: run.executionMode === 'server-managed'
      ? 'Workflow is queued in the server-managed contract; real model execution worker is the next adapter.'
      : 'Workflow metadata is retained while model execution remains browser-local.',
    contextCompression: {
      applied: compressed.applied,
      strategy: compressed.applied ? 'local-summary-v1' : 'none',
    },
    quota: {
      baseCallsDebited: input.actor.tier === 'user' || input.actor.tier === 'vip' ? 1 : 0,
      baseCallsRemaining: ledger.baseCallsRemaining,
      hostedRunsDebited,
      hostedRunsRemaining: ledger.hostedRunsRemaining,
      resetAt: ledger.resetAt,
      hostedResetAt: ledger.hostedResetAt,
      gatingReason,
    },
  }

  return {
    run,
    hostingPolicy,
    executionPlan,
    ownerResolution: {
      requestedOwnerId: ownerResolution.requestedOwnerId,
      ownerOverrideAccepted: ownerResolution.ownerOverrideAccepted,
    },
  }
}
